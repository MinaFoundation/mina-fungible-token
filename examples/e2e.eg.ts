import { equal } from "node:assert"
import { AccountUpdate, Mina, PrivateKey, UInt64 } from "o1js"
import { FungibleToken } from "../index.js"
import { TestAccounts } from "../test_util.js"

const local = Mina.LocalBlockchain({ proofsEnabled: false })
Mina.setActiveInstance(local)

const [deployer, owner, alexa, billy] = local.testAccounts as TestAccounts
const contract = PrivateKey.randomKeypair()

const token = new FungibleToken(contract.publicKey)

console.log("Deploying token contract.")
const deployTx = await Mina.transaction({
  sender: deployer.publicKey,
  fee: 1e8,
}, () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 1)
  token.deploy({
    owner: owner.publicKey,
    supply: UInt64.from(10_000_000_000_000),
    symbol: "abc",
    src: "https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts",
  })
})
await deployTx.prove()
deployTx.sign([deployer.privateKey, contract.privateKey])
const deployTxResult = await deployTx.send().then((v) => v.wait())
console.log("Deploy tx result:", deployTxResult)
equal(deployTxResult.status, "included")

const alexaBalanceBeforeMint = token.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance before mint:", alexaBalanceBeforeMint)
equal(alexaBalanceBeforeMint, 0n)

console.log("Minting new tokens to Alexa.")
const mintTx = await Mina.transaction({
  sender: owner.publicKey,
  fee: 1e9,
}, () => {
  AccountUpdate.fundNewAccount(owner.publicKey, 1)
  token.mint(alexa.publicKey, new UInt64(2e9))
})
await mintTx.prove()
mintTx.sign([owner.privateKey])
const mintTxResult = await mintTx.send().then((v) => v.wait())
console.log("Mint tx result:", mintTxResult)
equal(mintTxResult.status, "included")

const alexaBalanceAfterMint = token.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance after mint:", alexaBalanceAfterMint)
equal(alexaBalanceAfterMint, BigInt(2e9))

const billyBalanceBeforeMint = token.getBalanceOf(billy.publicKey)
console.log("Billy balance before mint:", billyBalanceBeforeMint.toBigInt())
equal(alexaBalanceBeforeMint, 0n)

console.log("Transferring tokens from Alexa to Billy")
const transferTx = await Mina.transaction({
  sender: alexa.publicKey,
  fee: 1e9,
}, () => {
  AccountUpdate.fundNewAccount(billy.publicKey, 1)
  token.transfer(alexa.publicKey, billy.publicKey, new UInt64(1e9))
})
await transferTx.prove()
transferTx.sign([alexa.privateKey, billy.privateKey])
const transferTxResult = await transferTx.send().then((v) => v.wait())
console.log("Transfer tx result:", transferTxResult)
equal(transferTxResult.status, "included")

const alexaBalanceAfterTransfer = token.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance after transfer:", alexaBalanceAfterTransfer)
equal(alexaBalanceAfterTransfer, BigInt(1e9))

const billyBalanceAfterTransfer = token.getBalanceOf(billy.publicKey).toBigInt()
console.log("Billy balance after transfer:", billyBalanceAfterTransfer)
equal(billyBalanceAfterTransfer, BigInt(1e9))
