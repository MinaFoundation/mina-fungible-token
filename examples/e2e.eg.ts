import { equal } from "node:assert"
import { AccountUpdate, Field, Mina, PrivateKey, UInt64 } from "o1js"
import { FungibleToken } from "../index.js"
import type { TestAccounts } from "../util/index.js"

const Local = Mina.LocalBlockchain({ proofsEnabled: false })
Mina.setActiveInstance(Local)

const [deployer, owner, alexa, billy] = Local.testAccounts as TestAccounts
const contractAccount = PrivateKey.randomKeypair()

const contract = new FungibleToken(contractAccount.publicKey)

const deployTx = await Mina.transaction(deployer.publicKey, () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 1)
  contract.deploy({
    adminPublicKey: owner.publicKey,
    totalSupply: UInt64.from(10_000_000_000_000),
    tokenSymbol: "abc",
    zkAppURI: "https://github.com/MinaFoundation/mina-fungible-token.git",
  })
})
await deployTx.prove()
const deployTxPending = await deployTx
  .sign([deployer.privateKey, contractAccount.privateKey])
  .send()
const deployTxResult = await deployTxPending.wait()
console.log("Deploy tx result:", deployTxResult)
equal(deployTxResult.status, "included")

const alexaBalanceBeforeMint = contract.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance before mint:", alexaBalanceBeforeMint)
equal(alexaBalanceBeforeMint, 0n)

const mintTx = await Mina.transaction(owner.publicKey, () => {
  AccountUpdate.fundNewAccount(owner.publicKey, 1)
  contract.mint(alexa.publicKey, new UInt64(2e9))
})
await mintTx.prove()
const mintTxPending = await mintTx.sign([owner.privateKey]).send()
const mintTxResult = await mintTxPending.wait()
console.log("Mint tx result:", mintTxResult)
equal(mintTxResult.status, "included")

const alexaBalanceAfterMint = contract.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance after mint:", alexaBalanceAfterMint)
equal(alexaBalanceAfterMint, BigInt(2e9))

const billyBalanceBeforeMint = contract.getBalanceOf(billy.publicKey)
console.log("Billy balance before mint:", billyBalanceBeforeMint.toBigInt())
equal(alexaBalanceBeforeMint, 0n)

const transferTx = await Mina.transaction(alexa.publicKey, () => {
  AccountUpdate.fundNewAccount(billy.publicKey, 1)
  contract.transfer(alexa.publicKey, billy.publicKey, new UInt64(1e9))
})
await transferTx.prove()
const transferTxPending = await transferTx.sign([alexa.privateKey, billy.privateKey]).send()
const transferTxResult = await transferTxPending.wait()
console.log("Transfer tx result:", transferTxResult)
equal(transferTxResult.status, "included")

const alexaBalanceAfterTransfer = contract.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance after transfer:", alexaBalanceAfterTransfer)
equal(alexaBalanceAfterTransfer, BigInt(1e9))

const billyBalanceAfterTransfer = contract.getBalanceOf(billy.publicKey).toBigInt()
console.log("Billy balance after transfer:", billyBalanceAfterTransfer)
equal(billyBalanceAfterTransfer, BigInt(1e9))