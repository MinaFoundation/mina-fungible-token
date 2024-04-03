# Deploy

To create a token manager smart contract, inherit your smart contract from base custom token
implementation, or use the `FungibleToken` directly

```ts
import { FungibleToken } from "mina-fungible-token"

class MyToken extends FungibleToken {}
```

> [!NOTE] If you inherit from `FungibleToken` to override some functionality, you will need to
> compile both parent and child contracts to be able to prove code for both of them

To deploy a token manager contract, create and compile the token contract instance, then create,
prove and sign the deploy transaction:

```ts
await FungibleToken.compile()
await MyToken.compile()

const {
  privateKey: tokenKey,
  publicKey: tokenAddress,
} = PrivateKey.randomKeypair()
const token = new MyToken(tokenAddress)

// paste the private key of the deployer and admin account here
const deployerKey = PrivateKey.fromBase58("...")
const ownerKey = PrivateKey.fromBase58("...")
const owner = PublicKey.fromPrivateKey(ownerKey)
const deployer = PublicKey.fromPrivateKey(deployerKey)

const supply = UInt64.from(21_000_000)
const symbol = "MYTKN"
const src = "https://github.com/MinaFoundation/mina-fungible-token/blob/main/FungibleToken.ts"

const fee = 1e8

const tx = await Mina.transaction({ sender: deployer, fee }, () => {
  AccountUpdate.fundNewAccount(deployer, 1)
  token.deploy(owner, supply, symbol, src)
})

tx.sign([deployerKey, tokenKey])
await tx.prove()
await tx.send()
```

For this and following samples to work, make sure you have enough funds on deployer and admin
accounts.

Refer to
[examples/e2e.eg.ts](https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts)
to see executable end to end example.
