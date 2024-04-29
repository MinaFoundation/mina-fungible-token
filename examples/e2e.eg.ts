import { equal } from "node:assert"
import { AccountUpdate, Mina, PrivateKey, UInt64 } from "o1js"
import { FungibleToken, FungibleTokenAdmin } from "../index.js"
import { TestAccounts } from "../test_util.js"

const devnet = Mina.LocalBlockchain({
  proofsEnabled: false,
  enforceTransactionLimits: false,
})
Mina.setActiveInstance(devnet)

const fee = 1e8

const [deployer, owner, alexa, billy] = devnet.testAccounts as TestAccounts
const contract = PrivateKey.randomKeypair()
const admin = PrivateKey.randomKeypair()

const token = new FungibleToken(contract.publicKey)
const adminContract = new FungibleTokenAdmin(admin.publicKey)

console.log("Deploying token contract.")
const deployTx = await Mina.transaction({
  sender: deployer.publicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 2)
  await adminContract.deploy({ adminPublicKey: admin.publicKey })
  await token.deploy({
    admin: admin.publicKey,
    supply: UInt64.from(10_000_000_000_000),
    symbol: "abc",
    src: "https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts",
  })
})
await deployTx.prove()
deployTx.sign([deployer.privateKey, contract.privateKey, admin.privateKey])
const deployTxResult = await deployTx.send().then((v) => v.wait())
console.log("Deploy tx result:", deployTxResult.toPretty())
equal(deployTxResult.status, "included")

const alexaBalanceBeforeMint = (await token.getBalanceOf(alexa.publicKey)).toBigInt()
console.log("Alexa balance before mint:", alexaBalanceBeforeMint)
equal(alexaBalanceBeforeMint, 0n)

console.log("Minting new tokens to Alexa.")
const mintTx = await Mina.transaction({
  sender: owner.publicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(owner.publicKey, 1)
  await token.mint(alexa.publicKey, new UInt64(2e9))
})
await mintTx.prove()
mintTx.sign([owner.privateKey])
const mintTxResult = await mintTx.send().then((v) => v.wait())
console.log("Mint tx result:", mintTxResult.toPretty())
equal(mintTxResult.status, "included")

const alexaBalanceAfterMint = (await token.getBalanceOf(alexa.publicKey)).toBigInt()
console.log("Alexa balance after mint:", alexaBalanceAfterMint)
equal(alexaBalanceAfterMint, BigInt(2e9))

const billyBalanceBeforeMint = await token.getBalanceOf(billy.publicKey)
console.log("Billy balance before mint:", billyBalanceBeforeMint.toBigInt())
equal(alexaBalanceBeforeMint, 0n)

console.log("Transferring tokens from Alexa to Billy")
const transferTx = await Mina.transaction({
  sender: alexa.publicKey,
  fee,
}, async () => {
  AccountUpdate.fundNewAccount(alexa.publicKey, 1)
  await token.transfer(alexa.publicKey, billy.publicKey, new UInt64(1e9))
})
await transferTx.prove()
transferTx.sign([alexa.privateKey])
const transferTxResult = await transferTx.send().then((v) => v.wait())
console.log("Transfer tx result:", transferTxResult.toPretty())
equal(transferTxResult.status, "included")

const alexaBalanceAfterTransfer = (await token.getBalanceOf(alexa.publicKey)).toBigInt()
console.log("Alexa balance after transfer:", alexaBalanceAfterTransfer)
equal(alexaBalanceAfterTransfer, BigInt(1e9))

const billyBalanceAfterTransfer = (await token.getBalanceOf(billy.publicKey)).toBigInt()
console.log("Billy balance after transfer:", billyBalanceAfterTransfer)
equal(billyBalanceAfterTransfer, BigInt(1e9))

console.log("Burning Billy's tokens")
const burnTx = await Mina.transaction({
  sender: billy.publicKey,
  fee,
}, async () => {
  await token.burn(billy.publicKey, new UInt64(6e8))
})
await burnTx.prove()
burnTx.sign([billy.privateKey])
const burnTxResult = await burnTx.send().then((v) => v.wait())
console.log("Burn tx result:", burnTxResult.toPretty())
equal(burnTxResult.status, "included")

const billyBalanceAfterBurn = (await token.getBalanceOf(billy.publicKey)).toBigInt()
console.log("Billy balance after burn:", billyBalanceAfterBurn)
equal(billyBalanceAfterBurn, BigInt(4e8))
