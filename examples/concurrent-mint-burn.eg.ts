import { equal } from "node:assert"
import { AccountUpdate, fetchAccount, Mina, PrivateKey, PublicKey, TokenId, UInt64 } from "o1js"
import { FungibleToken } from "../index.js"

const url = "https://proxy.devnet.minaexplorer.com/graphql"
const archive = "https://api.minascan.io/archive/devnet/v1/graphql/"
const fee = 1e8

type KeyPair = { publicKey: PublicKey; privateKey: PrivateKey }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getCurrentHeight() {
  const query = `
query {
  daemonStatus {
    blockchainLength
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
  return Number(json.data.daemonStatus.blockchainLength)
}

async function waitBlock() {
  const height = await getCurrentHeight()
  while (true) {
    if ((await getCurrentHeight()) > height) {
      break
    }
  }
}

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
  amount: number | UInt64,
) {
  const nonce = await getInferredNonce(feepayer.publicKey.toBase58())
  console.log("feepayer nonce:", nonce)
  const mintTx = await Mina.transaction({
    sender: feepayer.publicKey,
    fee,
    nonce,
  }, async () => {
    await token.dispatchMint(to, new UInt64(amount))
  })
  await mintTx.prove()

  mintTx.sign([feepayer.privateKey])
  const result = await mintTx.send()
  console.log("Mint tx:", result.hash)

  // 3 sec for node to update nonce
  await sleep(3000)
}

async function burnNoWait(
  feepayer: KeyPair,
  from: KeyPair,
  amount: number,
) {
  const nonce = await getInferredNonce(feepayer.publicKey.toBase58())
  console.log("feepayer nonce:", nonce)
  const burnTx = await Mina.transaction({
    sender: feepayer.publicKey,
    fee,
    nonce,
  }, async () => {
    await token.dispatchBurn(from.publicKey, new UInt64(amount))
  })
  await burnTx.prove()

  burnTx.sign([feepayer.privateKey, from.privateKey])
  const result = await burnTx.send()
  console.log("Burn tx:", result.hash)

  // 3 sec for node to update nonce
  await sleep(3000)
}

Mina.setActiveInstance(Mina.Network({ mina: url, archive }))

const feePayerKey = PrivateKey.fromBase58("EKE5nJtRFYVWqrCfdpqJqKKdt2Sskf5Co2q8CWJKEGSg71ZXzES7")
const [contract, feepayer, alexa, billy, jackie] = [
  PrivateKey.randomKeypair(),
  {
    privateKey: feePayerKey,
    publicKey: feePayerKey.toPublicKey(),
  },
  PrivateKey.randomKeypair(),
  PrivateKey.randomKeypair(),
  PrivateKey.randomKeypair(),
]

console.log(`
alexa ${alexa.privateKey.toBase58()} ${alexa.publicKey.toBase58()}
billy ${billy.privateKey.toBase58()} ${billy.publicKey.toBase58()}
jackie ${jackie.privateKey.toBase58()} ${jackie.publicKey.toBase58()}
contract ${contract.publicKey.toBase58()}
`)

await FungibleToken.compile()
const token = new FungibleToken(
  PublicKey.fromBase58("B62qqzUqqEuUZxFffTTjRcT2pYRJgUaL5uGhirkD52HsdduoXZhpkjf"),
)

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

console.log("Doing batch mint to 3 addresses and waiting a block")
await mintNoWait(feepayer, alexa.publicKey, 100e9)
await mintNoWait(feepayer, billy.publicKey, 10e9)
await mintNoWait(feepayer, jackie.publicKey, 5e9)
await waitBlock()

console.log("Reduce mints and wait")
nonce = await getInferredNonce(feepayer.publicKey.toBase58())
const reduceTx1 = await Mina.transaction({
  sender: feepayer.publicKey,
  fee,
  nonce,
}, async () => {
  // TODO: dynamically infer the number of new accounts created
  AccountUpdate.fundNewAccount(feepayer.publicKey, 3)
  await token.reduceActions()
})
await reduceTx1.prove()
reduceTx1.sign([feepayer.privateKey])
const reduceTxResult1 = await reduceTx1.send()
console.log("Reduce tx:", reduceTxResult1.hash)
await reduceTxResult1.wait()

console.log("Doing a batch with mints, burns and erroring mint + waiting a block")
await mintNoWait(feepayer, alexa.publicKey, 1e9)
await mintNoWait(feepayer, jackie.publicKey, 3e9)
await burnNoWait(feepayer, billy, 4e9)
await mintNoWait(feepayer, billy.publicKey, await token.getSupply())
await mintNoWait(feepayer, billy.publicKey, 1e9)

await waitBlock()

console.log("Reducing actions")
nonce = await getInferredNonce(feepayer.publicKey.toBase58())
const reduceTx2 = await Mina.transaction({
  sender: feepayer.publicKey,
  fee,
  nonce,
}, async () => {
  await token.reduceActions()
})
await reduceTx2.prove()
reduceTx2.sign([feepayer.privateKey])
const reduceTxResult2 = await reduceTx2.send()
console.log("Reduce tx:", reduceTxResult2.hash)
await reduceTxResult2.wait()

// wait
await sleep(10000)

await fetchAccount({ publicKey: alexa.publicKey, tokenId: token.deriveTokenId() })
await fetchAccount({ publicKey: billy.publicKey, tokenId: token.deriveTokenId() })
await fetchAccount({ publicKey: jackie.publicKey, tokenId: token.deriveTokenId() })

const alexaBalance = (await token.getBalanceOf(alexa.publicKey)).toBigInt()
const billyBalance = (await token.getBalanceOf(billy.publicKey)).toBigInt()
const jackieBalance = (await token.getBalanceOf(jackie.publicKey)).toBigInt()

console.log("alexa billy jackie balance:", alexaBalance, billyBalance, jackieBalance)
equal(alexaBalance, BigInt(101e9))
equal(billyBalance, BigInt(7e9))
equal(jackieBalance, BigInt(8e9))
