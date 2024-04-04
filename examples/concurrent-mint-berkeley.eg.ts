import { equal } from "node:assert"
import { AccountUpdate, Mina, PrivateKey, PublicKey, Transaction, UInt64, fetchAccount } from "o1js"
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

async function tweakMintPrecondition(mintAmount: number, mempoolMintAmount: number, mintTx: Transaction, tokenPublicKey: PublicKey) {
  for (let au of mintTx.transaction.accountUpdates) {
    if (au.publicKey === tokenPublicKey) {
      const prevPreconditionVal = au.body.preconditions.account.state[3]!.value
      au.body.preconditions.account.state[3]!.value = prevPreconditionVal.add(mempoolMintAmount)
      const newPreconditionVal = au.body.preconditions.account.state[3]!.value
      au.body.update.appState[3]!.value = newPreconditionVal.add(mintAmount)
    }
  }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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

contract.publicKey = PublicKey.fromBase58('B62qjUrGPK1vePNUNkKfnNfxoAodfdzesBBwHfRfeQuBdxWp9kVMy7n')

console.log(`
alexa ${alexa.publicKey.toBase58()}
billy ${billy.publicKey.toBase58()}
contract ${contract.publicKey.toBase58()}
`)

await FungibleToken.compile()
const token = new FungibleToken(contract.publicKey)
await fetchAccount({publicKey: contract.publicKey})
// let nonce = await getInferredNonce(deployer.publicKey.toBase58())
// console.log("Deploying token contract.")
// console.log("Nonce:", nonce)
// const deployTx = await Mina.transaction({
//   sender: deployer.publicKey,
//   fee,
//   nonce,
// }, () => {
//   AccountUpdate.fundNewAccount(deployer.publicKey, 1)
//   token.deploy({
//     owner: deployer.publicKey,
//     supply: UInt64.from(10_000_000_000_000),
//     symbol: "abc",
//     src: "https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts",
//   })
// })
// await deployTx.prove()
// deployTx.sign([deployer.privateKey, contract.privateKey])
// const deployTxResult = await deployTx.send().then((v) => v.wait())
// console.log("Deploy tx:", deployTxResult.hash)
// equal(deployTxResult.status, "included")

const alexaBalanceBeforeMint = token.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance before mint:", alexaBalanceBeforeMint)
equal(alexaBalanceBeforeMint, 0n)

console.log("[1] Minting new tokens to Alexa.")
let nonce = await getInferredNonce(deployer.publicKey.toBase58())
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

// small delay here is needed to wait for GraphQL mempool to be updated
await sleep(1000)

console.log("[2] Minting new tokens to Alexa.")
nonce = await getInferredNonce(deployer.publicKey.toBase58())
console.log("Nonce:", nonce)

const mintTx2 = await Mina.transaction({
  // using deployer to pay fees because this is the only one who has tokens
  sender: deployer.publicKey,
  fee,
  nonce,
}, () => {
  token.mint(alexa.publicKey, UInt64.from(2e9))
})

console.log('AU before tweak')
for (let au of mintTx2.transaction.accountUpdates) {
  if (au.publicKey === contract.publicKey) {
    console.log(au.toPretty().update)
    console.log(au.toPretty().preconditions)
  }
}
tweakMintPrecondition(2e9, 1e9, mintTx2, contract.publicKey)
console.log('AU after tweak')
for (let au of mintTx2.transaction.accountUpdates) {
  if (au.publicKey === contract.publicKey) {
    console.log(au.toPretty().update)
    console.log(au.toPretty().preconditions)
  }
}

await mintTx2.prove()
mintTx2.sign([deployer.privateKey])
const mintTxResult2 = await mintTx2.send().then((v) => v.wait())
console.log("Mint tx 2:", mintTxResult2.hash)
equal(mintTxResult2.status, "included")


const alexaBalanceAfterMint = token.getBalanceOf(alexa.publicKey).toBigInt()
console.log("Alexa balance after mint:", alexaBalanceAfterMint)
equal(alexaBalanceAfterMint, BigInt(2e9))
