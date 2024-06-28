# Token Operations

In this section, we will explore the various token operations represented by the standard, which
include:

- Minting
- Burning
- Transferring between users

## Mint tokens

To mint tokens to some address:

```ts
// paste the address where you want to mint tokens to
const mintTo = PublicKey.fromBase58("...")
const mintAmount = UInt64.from(1000)

const mintTx = await Mina.transaction({
  sender: owner,
  fee,
}, async () => {
  // remove this line if a receiver already has token account
  AccountUpdate.fundNewAccount(owner, 1)
  await token.mint(mintTo, new UInt64(2e9))
})
mintTx.sign([owner.privateKey, admin.privateKey])
await mintTx.prove()
await mintTx.send()
```

> [!IMPORTANT] When a token account is created for the first time, an account creation fee must be
> paid the same as creating a new standard account.

## Burn tokens

To burn tokens owned by some address:

```ts
// paste the address where you want to burn tokens from
const burnFrom = PublicKey.fromBase58("...")
const burnAmount = UInt64.from(1000)

const tx = await Mina.transaction({ sender: burnFrom, fee }, () => {
  token.burn(burnFrom, burnAmount)
})

tx.sign([burnFromKey])
await tx.prove()
await tx.send()
```

## Transfer tokens between user accounts

To transfer tokens between two user accounts:

```ts
// paste the private key of the sender and the address of the receiver
const sendFrom = PublicKey.fromBase58("...")
const sendFromKey = Private.fromPublicKey(sendFrom)
const sendTo = PublicKey.fromBase58("...")

const sendAmount = UInt64.from(1)

const tx = await Mina.transaction({ sender: sendFrom, fee }, () => {
  token.transfer(sendFrom, sendTo, sendAmount)
})
tx.sign([sendFromKey])
await tx.prove()
await tx.send()
```

## Fetch token balance of the account

To get token balance of some account:

```ts
// paste the address of the account you want to read balance of
const anyAccount = PublicKey.fromBase58("...")
const balance = token.getBalanceOf(anyAccount)
```

Refer to
[examples/e2e.eg.ts](https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts)
to see executable end to end example.
