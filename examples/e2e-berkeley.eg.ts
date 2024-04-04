import { equal } from "node:assert"
import { AccountUpdate, Mina, PrivateKey, UInt64 } from "o1js"
import { FungibleToken } from "../index.js"

const url = "https://proxy.berkeley.minaexplorer.com/graphql"

// we use it here because some transactions from sender may be already in a mempool,
// resulting in rejection of a transaction with same nonce
// this is demonstrated in mint phase (we don't wait after first mint to include a second one)
async function getInferredNonce(publicKey: string) {
  const query = `
query {
  account(publicKey: "${publicKey}") {
    inferredNonce
  }
}`

  const response = await fetch(
    url,
    {
      method: "POST",
      body: JSON.stringify({ operationName: null, query, variables: {} }),
      headers: { "Content-Type": "application/json" },
    },
  )
  const json = await response.json()
  return Number(json.data.account.inferredNonce)
}

const berkeley = Mina.Network(url)
Mina.setActiveInstance(berkeley)

const fee = 1e8

const deployerKey = PrivateKey.fromBase58("EKE5nJtRFYVWqrCfdpqJqKKdt2Sskf5Co2q8CWJKEGSg71ZXzES7")
const deployer = {
  publicKey: deployerKey.toPublicKey(),
  privateKey: deployerKey,
}

const [alexa, billy, contract] = [
  PrivateKey.randomKeypair(),
  PrivateKey.randomKeypair(),
  PrivateKey.randomKeypair(),
]

await FungibleToken.compile()
const token = new FungibleToken(contract.publicKey)

let nonce = await getInferredNonce(deployer.publicKey.toBase58())
console.log("Deploying token contract.")
console.log("Nonce:", nonce)
const deployTx = await Mina.transaction({
  sender: deployer.publicKey,
  fee,
  nonce,
}, () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 1)
  token.deploy({
    owner: deployer.publicKey,
    supply: UInt64.from(10_000_000_000_000),
    symbol: "abc",
    src: "https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts",
  })
})
await deployTx.prove()
deployTx.sign([deployer.privateKey, contract.privateKey])
const deployTxResult = await deployTx.send().then((v) => v.wait())
console.log("Deploy tx:", deployTxResult.hash)
equal(deployTxResult.status, "included")

const alexaBalanceBeforeMint = token.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance before mint:", alexaBalanceBeforeMint)
equal(alexaBalanceBeforeMint, 0n)

console.log("[1] Minting new tokens to Alexa.")
nonce = await getInferredNonce(deployer.publicKey.toBase58())
console.log("Nonce:", nonce)
const mintTx1 = await Mina.transaction({
  // using deployer to pay fees because this is the only one who has tokens
  sender: deployer.publicKey,
  fee,
  nonce,
}, () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 1)
  token.mint(alexa.publicKey, new UInt64(1e9))
})
await mintTx1.prove()
mintTx1.sign([deployer.privateKey])
const mintTxResult1 = await mintTx1.send()
console.log("Mint tx 1:", mintTxResult1.hash)

console.log("[2] Minting new tokens to Alexa.")
nonce = await getInferredNonce(deployer.publicKey.toBase58())
console.log("Nonce:", nonce)
const mintTx2 = await Mina.transaction({
  // using deployer to pay fees because this is the only one who has tokens
  sender: deployer.publicKey,
  fee,
  nonce,
}, () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 1)
  token.mint(alexa.publicKey, new UInt64(1e9))
})
await mintTx2.prove()
mintTx2.sign([deployer.privateKey])
const mintTxResult2 = await mintTx2.send().then((v) => v.wait())
console.log("Mint tx 2:", mintTxResult2.hash)
equal(mintTxResult2.status, "included")

const alexaBalanceAfterMint = token.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance after mint:", alexaBalanceAfterMint)
equal(alexaBalanceAfterMint, BigInt(2e9))

const billyBalanceBeforeMint = token.getBalanceOf(billy.publicKey)
console.log("Billy balance before transfer:", billyBalanceBeforeMint.toBigInt())
equal(alexaBalanceBeforeMint, 0n)

console.log("Transferring tokens from Alexa to Billy")
nonce = await getInferredNonce(deployer.publicKey.toBase58())
console.log("Nonce:", nonce)
const transferTx = await Mina.transaction({
  // using deployer to pay fees because this is the only one who has tokens
  sender: deployer.publicKey,
  fee,
  nonce,
}, () => {
  AccountUpdate.fundNewAccount(billy.publicKey, 1)
  token.transfer(alexa.publicKey, billy.publicKey, new UInt64(1e9))
})
await transferTx.prove()
transferTx.sign([alexa.privateKey, deployer.privateKey])
const transferTxResult = await transferTx.send().then((v) => v.wait())
console.log("Transfer tx:", transferTxResult.hash)
equal(transferTxResult.status, "included")

const alexaBalanceAfterTransfer = token.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance after transfer:", alexaBalanceAfterTransfer)
equal(alexaBalanceAfterTransfer, BigInt(1e9))

const billyBalanceAfterTransfer = token.getBalanceOf(billy.publicKey).toBigInt()
console.log("Billy balance after transfer:", billyBalanceAfterTransfer)
equal(billyBalanceAfterTransfer, BigInt(1e9))

console.log("Burning Billy's tokens")
nonce = await getInferredNonce(deployer.publicKey.toBase58())
console.log("Nonce:", nonce)
const burnTx = await Mina.transaction({
  // using deployer to pay fees because this is the only one who has tokens
  sender: deployer.publicKey,
  fee,
  nonce,
}, () => {
  token.burn(billy.publicKey, new UInt64(6e8))
})
await burnTx.prove()
burnTx.sign([billy.privateKey, deployer.privateKey])
const burnTxResult = await burnTx.send().then((v) => v.wait())
console.log("Burn tx:", burnTxResult.hash)
equal(burnTxResult.status, "included")

const billyBalanceAfterBurn = token.getBalanceOf(billy.publicKey).toBigInt()
console.log("Billy balance after burn:", billyBalanceAfterBurn)
equal(billyBalanceAfterBurn, BigInt(4e8))
