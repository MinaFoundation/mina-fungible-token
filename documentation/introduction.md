# Introduction

Mina natively supports custom tokens
([MIP-4](https://github.com/MinaProtocol/MIPs/blob/main/MIPS/mip-zkapps.md#token-mechanics)). Each
account on Mina can correspond to a custom token.

To create a new token, one creates a smart contract, which becomes the manager for the token, and
uses that contract to set the rules around how the token can be minted, burned and transferred. The
contract may also set a token symbol. Uniqueness is not enforced for token names. Instead the public
key of the contract is used to derive the token's unique identifier.

## SHOW ME THE CODE

The
[`mina-fungible-token` repo's e2e example](https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts)
showcases the entire lifecycle of a token.

After running `npm i mina-fungible-token`, import the `FungibleToken` contract and deploy it like
so.

```ts
const token = new FungibleToken(contract.publicKey)

const deployTx = await Mina.transaction({
  sender: deployer.publicKey,
  fee,
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
await deployTx.send()
```

> Note: this example assumes that `contract` and `deployer` are valid key pairs in scope.

## How?

How is this custom token mechanism implemented in Mina?

### Token Manager

The token manager account is a contract with the following capabilities.

- Set a token symbol (also called token name) for its token. Uniqueness is not enforced for token
  names because the public key of the manager account is used to derive a unique identifier for each
  token.
- Mint new tokens. The zkApp updates an account's balance by adding the newly created tokens to it.
  You can send minted tokens to any existing account in the network.
- Burn tokens (the opposite of minting). Burning tokens deducts the balance of a certain address by
  the specified amount. A zkApp cannot burn more tokens than the specified account has.
- Send tokens between two accounts. Any account can initiate a transfer, and the transfer must be
  approved by a Token Manager zkApp (see [Approval mechanism](#approval-mechanism)).

### Token Account

Token accounts are like regular accounts, but they hold a balance of a specific custom token instead
of MINA. A token account is created from an existing account and is specified by a public key _and_
a token id.

Token accounts are specific for each type of custom token, so a single public key can have many
different token accounts.

A token account is automatically created for a public key whenever an existing account receives a
transaction denoted with a custom token.

> [!IMPORTANT] When a token account is created for the first time, an account creation fee must be
> paid the same as creating a new standard account.

### Token ID

Token ids are unique identifiers that distinguish between different types of custom tokens. Custom
token identifiers are globally unique across the entire network.

Token ids are derived from a Token Manager zkApp. Use `deriveTokenId()` function to get id of a
token.

### Approval mechanism

Sending tokens between two accounts must be approved by a Token Manager zkApp. This can be done with
`approveBase()` method of the custom token standard reference implementation.

If you customize the `transfer()` function or constructing `AccountUpdate`s for sending tokens
manually, don't forget to call `approveBase()`.
