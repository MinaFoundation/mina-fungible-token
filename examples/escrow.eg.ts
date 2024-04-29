import { equal } from "node:assert"
import {
  AccountUpdate,
  DeployArgs,
  method,
  Mina,
  PrivateKey,
  PublicKey,
  SmartContract,
  State,
  state,
  UInt64,
} from "o1js"
import { TestAccounts } from "test_util.js"
import { FungibleToken, FungibleTokenAdmin } from "../index.js"

export class TokenEscrow extends SmartContract {
  @state(PublicKey)
  tokenAddress = State<PublicKey>()
  @state(UInt64)
  total = State<UInt64>()

  async deploy(args: DeployArgs & { tokenAddress: PublicKey }) {
    await super.deploy(args)

    this.tokenAddress.set(args.tokenAddress)
    this.total.set(UInt64.zero)
  }

  @method
  async deposit(from: PublicKey, amount: UInt64) {
    const token = new FungibleToken(this.tokenAddress.getAndRequireEquals())
    await token.transfer(from, this.address, amount)
    const total = this.total.getAndRequireEquals()
    this.total.set(total.add(amount))
  }

  @method
  async withdraw(to: PublicKey, amount: UInt64) {
    const token = new FungibleToken(this.tokenAddress.getAndRequireEquals())
    const total = this.total.getAndRequireEquals()
    total.greaterThanOrEqual(amount)
    this.total.set(total.sub(amount))
    await token.transfer(this.address, to, amount)
  }
}

const devnet = Mina.LocalBlockchain({
  proofsEnabled: false,
  enforceTransactionLimits: false,
})
Mina.setActiveInstance(devnet)

const fee = 1e8

const [deployer, owner, alexa, billy, jackie] = devnet.testAccounts as TestAccounts
const tokenContract = PrivateKey.randomKeypair()
const escrowContract = PrivateKey.randomKeypair()
const admin = PrivateKey.randomKeypair()
console.log(`
  deployer ${deployer.publicKey.toBase58()}
  owner ${owner.publicKey.toBase58()}
  alexa ${alexa.publicKey.toBase58()}
  billy ${billy.publicKey.toBase58()}
  jackie ${jackie.publicKey.toBase58()}

  token ${tokenContract.publicKey.toBase58()}
  escrow ${escrowContract.publicKey.toBase58()}
  admin ${admin.publicKey.toBase58()}
`)
const token = new FungibleToken(tokenContract.publicKey)
const escrow = new TokenEscrow(escrowContract.publicKey)
const adminContract = new FungibleTokenAdmin(admin.publicKey)

console.log("Deploying token contract.")
const deployTokenTx = await Mina.transaction({
  sender: deployer.publicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 2)
  await adminContract.deploy({ adminPublicKey: admin.publicKey })
  await token.deploy({
    admin: admin.publicKey,
    supply: UInt64.from(10_000_000_000_000),
    symbol: "abc",
    src: "https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/escrow.eg.ts",
  })
})
await deployTokenTx.prove()
deployTokenTx.sign([deployer.privateKey, tokenContract.privateKey, admin.privateKey])
const deployTokenTxResult = await deployTokenTx.send().then((v) => v.wait())
console.log("Deploy tx result:", deployTokenTxResult.toPretty())
equal(deployTokenTxResult.status, "included")

console.log("Deploying escrow contract.")
const deployEscrowTx = await Mina.transaction({
  sender: deployer.publicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 1)
  await escrow.deploy({
    tokenAddress: tokenContract.publicKey,
  })
})
await deployEscrowTx.prove()
deployEscrowTx.sign([deployer.privateKey, escrowContract.privateKey])
const deployEscrowTxResult = await deployEscrowTx.send().then((v) => v.wait())
console.log("Deploy tx result:", deployEscrowTxResult.toPretty())
equal(deployEscrowTxResult.status, "included")

console.log("Minting new tokens to Alexa and Billy.")
const mintTx1 = await Mina.transaction({
  sender: owner.publicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(owner.publicKey, 1)
  await token.mint(alexa.publicKey, new UInt64(2e9))
})
await mintTx1.prove()
mintTx1.sign([owner.privateKey])
const mintTxResult1 = await mintTx1.send().then((v) => v.wait())
console.log("Mint tx result 1:", mintTxResult1.toPretty())
equal(mintTxResult1.status, "included")

const mintTx2 = await Mina.transaction({
  sender: owner.publicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(owner.publicKey, 1)
  await token.mint(billy.publicKey, new UInt64(3e9))
})
await mintTx2.prove()
mintTx2.sign([owner.privateKey])
const mintTxResult2 = await mintTx2.send().then((v) => v.wait())
console.log("Mint tx result 2:", mintTxResult2.toPretty())
equal(mintTxResult2.status, "included")

console.log("Alexa deposits tokens to the escrow.")
const depositTx1 = await Mina.transaction({
  sender: alexa.publicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(alexa.publicKey, 1)
  await escrow.deposit(alexa.publicKey, new UInt64(2e9))
})
await depositTx1.prove()
depositTx1.sign([alexa.privateKey])
const depositTxResult1 = await depositTx1.send().then((v) => v.wait())
console.log("Deposit tx result 1:", depositTxResult1.toPretty())
equal(depositTxResult1.status, "included")

const escrowBalanceAfterDeposit1 = (await token.getBalanceOf(escrowContract.publicKey)).toBigInt()
console.log("Escrow balance after deposit:", escrowBalanceAfterDeposit1)
equal(escrowBalanceAfterDeposit1, BigInt(2e9))

console.log("Billy deposits tokens to the escrow.")
const depositTx2 = await Mina.transaction({
  sender: billy.publicKey,
  fee,
}, async () => {
  // note that there is no need to fund escrow token account as its already exists
  await escrow.deposit(billy.publicKey, new UInt64(3e9))
})
await depositTx2.prove()
depositTx2.sign([billy.privateKey])
const depositTxResult2 = await depositTx2.send().then((v) => v.wait())
console.log("Deposit tx result 2:", depositTxResult2.toPretty())
equal(depositTxResult2.status, "included")

const escrowBalanceAfterDeposit2 = (await token.getBalanceOf(escrowContract.publicKey)).toBigInt()
console.log("Escrow balance after deposit:", escrowBalanceAfterDeposit2)
equal(escrowBalanceAfterDeposit2, BigInt(5e9))

const escrowTotalAfterDeposits = escrow.total.get()
equal(escrowTotalAfterDeposits.toBigInt(), escrowBalanceAfterDeposit2)

console.log("Escrow deployer withdraws portion of tokens to Jackie.")
const withdrawTx = await Mina.transaction({
  sender: deployer.publicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 1)
  await escrow.withdraw(jackie.publicKey, new UInt64(4e9))
})
await withdrawTx.prove()
withdrawTx.sign([deployer.privateKey, escrowContract.privateKey])
const withdrawTxResult = await withdrawTx.send().then((v) => v.wait())
console.log("Withdraw tx result:", withdrawTxResult.toPretty())
equal(withdrawTxResult.status, "included")

const escrowBalanceAfterWithdraw = (await token.getBalanceOf(escrowContract.publicKey)).toBigInt()
console.log("Escrow balance after deposit:", escrowBalanceAfterDeposit2)
equal(escrowBalanceAfterWithdraw, BigInt(1e9))

const escrowTotalAfterWithdraw = escrow.total.get()
equal(escrowTotalAfterWithdraw.toBigInt(), escrowBalanceAfterWithdraw)
