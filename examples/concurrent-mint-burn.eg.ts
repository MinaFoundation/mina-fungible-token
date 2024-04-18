import { AccountUpdate, Mina, PrivateKey, PublicKey, TokenId, UInt64 } from "o1js"
import { FungibleToken } from "../index.js"

const url = "https://proxy.devnet.minaexplorer.com/graphql"
const archive = "https://api.minascan.io/archive/devnet/v1/graphql/"
const fee = 1e8

type KeyPair = { publicKey: PublicKey; privateKey: PrivateKey }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getInferredNonce(publicKey: string) {
  const query = `
query {
  account(publicKey: "${publicKey}") {
    inferredNonce
  }
}`

  const json = await fetch(
    url,
    {
      method: "POST",
      body: JSON.stringify({ operationName: null, query, variables: {} }),
      headers: { "Content-Type": "application/json" },
    },
  ).then((v) => v.json())
  return Number(json.data.account.inferredNonce)
}

async function mintNoWait(
  feepayer: KeyPair,
  to: PublicKey,
  amount: number,
) {
  const nonce = await getInferredNonce(feepayer.publicKey.toBase58())
  console.log("feepayer nonce:", nonce)
  const transferTx = await Mina.transaction({
    sender: feepayer.publicKey,
    fee,
    nonce,
  }, async () => {
    await token.dispatchMint(to, new UInt64(amount))
  })
  await transferTx.prove()

  transferTx.sign([feepayer.privateKey])
  const result = await transferTx.send()
  console.log("Mint tx:", result.hash)

  // 3 sec for node to update nonce
  await sleep(3000)
}

Mina.setActiveInstance(Mina.Network({ mina: url, archive }))

const feePayerKey = PrivateKey.fromBase58("EKE5nJtRFYVWqrCfdpqJqKKdt2Sskf5Co2q8CWJKEGSg71ZXzES7")
const [contract1, feepayer, alexa, billy, jackie] = [
  PrivateKey.randomKeypair(),
  {
    privateKey: feePayerKey,
    publicKey: feePayerKey.toPublicKey(),
  },
  PrivateKey.randomKeypair(),
  PrivateKey.randomKeypair(),
  PrivateKey.randomKeypair(),
]

const contract = {
  publicKey: PublicKey.fromBase58("B62qkNUzrxRj9AdtjN7nnbhaxuqvc5kt26SxZky9Lff2jqAwPQeY4i2"),
}

console.log(`
alexa ${alexa.privateKey.toBase58()} ${alexa.publicKey.toBase58()}
billy ${billy.privateKey.toBase58()} ${billy.publicKey.toBase58()}
jackie ${jackie.privateKey.toBase58()} ${jackie.publicKey.toBase58()}
contract ${contract.publicKey.toBase58()}
`)

await FungibleToken.compile()
const token = new FungibleToken(contract.publicKey)

let nonce = await getInferredNonce(feepayer.publicKey.toBase58())

// console.log("Deploying token contract.")
// const deployTx = await Mina.transaction({
//   sender: feepayer.publicKey,
//   fee,
//   nonce,
// }, async () => {
//   AccountUpdate.fundNewAccount(feepayer.publicKey, 1)
//   await token.deploy({
//     owner: feepayer.publicKey,
//     supply: UInt64.from(10_000_000_000_000),
//     symbol: "abc",
//     src: "https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts",
//   })
// })
// await deployTx.prove()
// deployTx.sign([feepayer.privateKey, contract.privateKey])
// const deployTxResult = await deployTx.send().then((v) => v.wait())
// console.log("Deploy tx:", deployTxResult.hash)

// await mintNoWait(feepayer, alexa.publicKey, 10e9)
// await mintNoWait(feepayer, billy.publicKey, 10e9)
// await mintNoWait(feepayer, jackie.publicKey, 10e9)

// nonce = await getInferredNonce(feepayer.publicKey.toBase58())

console.log("Reduce actions")
const reduceTx = await Mina.transaction({
  sender: feepayer.publicKey,
  fee,
  nonce,
}, async () => {
  // TODO: dynamically infer the number of new accounts created
  AccountUpdate.fundNewAccount(feepayer.publicKey, 3)
  await token.reduceActions()
})
await reduceTx.prove()
reduceTx.sign([feepayer.privateKey])
const reduceTxResult = await reduceTx.send()
console.log("Deploy tx:", reduceTxResult.hash)
await reduceTxResult.wait()
