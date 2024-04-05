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

function tweakMintPrecondition(token: FungibleToken, mempoolMintAmount: number) {
  console.log('####', token.self.body.preconditions.account.state[3]?.value)
  const prevPreconditionVal = token.self.body.preconditions.account.state[3]!.value
  token.self.body.preconditions.account.state[3]!.value = prevPreconditionVal.add(mempoolMintAmount)
  console.log('####', token.self.body.preconditions.account.state[3]?.value)
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

console.log("Minting new tokens to Alexa.")
let nonce = await getInferredNonce(deployer.publicKey.toBase58())
console.log("Nonce:", nonce)
const mintTx1 = await Mina.transaction({
  // using deployer to pay fees because this is the only one who has tokens
  sender: deployer.publicKey,
  fee,
  nonce,
}, () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 1)
  token.mint(deployer.publicKey, new UInt64(2e9))
})

// console.log('AU 1')
// for (let au of mintTx1.transaction.accountUpdates) {
//   if (au.publicKey === contract.publicKey) {
//     console.log(au.toPretty().preconditions)
//     console.log(au.toPretty().update)
//   }
// }

await mintTx1.prove()
mintTx1.sign([deployer.privateKey])
const mintTxResult1 = await mintTx1.send()
console.log("Mint tx 1:", mintTxResult1.hash)
await mintTxResult1.wait()

// small delay is needed to wait for graphQL database update
await sleep(1000)

const alexaBalanceAfterMint = token.getBalanceOf(deployer.publicKey).toBigInt()
console.log("Alexa balance after mint:", alexaBalanceAfterMint)
// equal(alexaBalanceAfterMint, BigInt(2e9))

console.log("[1] Transfer tokens to Billy.")
nonce = await getInferredNonce(deployer.publicKey.toBase58())
console.log("Nonce:", nonce)

const transferTx1 = await Mina.transaction({
  // using deployer to pay fees because this is the only one who has tokens
  sender: deployer.publicKey,
  fee,
  nonce,
}, () => {
  AccountUpdate.fundNewAccount(deployer.publicKey, 1)
  token.transfer(deployer.publicKey, billy.publicKey, UInt64.from(1e9))
})

await transferTx1.prove()
transferTx1.sign([deployer.privateKey])
const transferTxResult1 = await transferTx1.send()
console.log("Transfer tx 1:", transferTxResult1.hash)

console.log('Transfer tx 1 Account Updates')
for (let au of transferTx1.transaction.accountUpdates) {
  console.log(au.publicKey.toBase58())
  console.log(au.toPretty().preconditions)
  console.log(au.toPretty().update)
}

console.log("[2] Transfer tokens to Billy.")
nonce += 1
console.log("Nonce:", nonce)

const transferTx2 = await Mina.transaction({
  // using deployer to pay fees because this is the only one who has tokens
  sender: deployer.publicKey,
  fee,
  nonce,
}, () => {
  token.transfer(deployer.publicKey, billy.publicKey, UInt64.from(1e9))
})

await transferTx2.prove()
transferTx2.sign([deployer.privateKey])
const transferTxResult2 = await transferTx2.send()
console.log("Transfer tx 2:", transferTxResult2.hash)

console.log('Transfer tx 2 Account Updates')
for (let au of transferTx2.transaction.accountUpdates) {
  console.log(au.publicKey.toBase58())
  console.log(au.toPretty().preconditions)
  console.log(au.toPretty().update)
}

const transferTx2Included = await transferTxResult2.wait()
equal(transferTx2Included.status, "included")

const alexaBalanceAfter2Transfers = token.getBalanceOf(deployer.publicKey).toBigInt()
console.log("Alexa balance after 2 transfers:", alexaBalanceAfter2Transfers)
// equal(alexaBalanceAfter2Transfers, BigInt(0))

const billyBalanceAfter2Transfers = token.getBalanceOf(billy.publicKey).toBigInt()
console.log("Alexa balance after 2 transfers:", billyBalanceAfter2Transfers)
// equal(billyBalanceAfter2Transfers, BigInt(2e9))