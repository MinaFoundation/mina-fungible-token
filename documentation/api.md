# API overview

The token standard implementation provides a smart contract `FungibleToken` that can be deployed as
the token owner for a new token. It provides all the user facing functionality that is expected of a
fungible token: creating, transferring, and destroying tokens, as well as querying balances and the
overall amount of tokens.

Using the standard means using this particular, unmodified, contract. The reason that altering the
contract is considered deviating from the standard is the off-chain execution model of MINA: a third
party (wallet, exchange, etc.) that wants to integrate a token needs to have access to and execute
the code of the token owner contract in order to interact with the token. Agreeing on one particular
implementation reduces the burden of integration significantly.

In order to allow for some customization without changing the token owner contract, we delegate some
functionality to a secondary admin contract, called `FungibleTokenAdmin`. This contract controls
access to privileged operations such as minting, pausing/resuming transfers, or changing the admin
contract itself. This construction allows you to set the rules for monetary expansion, without
changing the token owner contract itself. Since the admin contract will only be called from methods
of the token contract that are not meant to be called by regular users, the code of the admin
contract does not need to be integrated into wallets or other third party applications.

is a Token Manager zkApp that is split in 2 parts: low-level and high-level one.

## The `FungibleToken` contract

## On-chain State and deploy arguments

The on-chain state is defined as follows:

```ts
@state(UInt8) decimals = State<UInt8>()
@state(PublicKey) admin = State<PublicKey>()
@state(UInt64) private circulating = State<UInt64>()
@state(Field) actionState = State<Field>()
@state(Bool) paused = State<Bool>()
```

The `deploy` function takes as arguments

- The public key of the account that the admin contract has been deployed to
- A symbol to use as the token symbol
- A string pointing to the source code of the contract -- when following the standard, this should
  point to the source of the standard implementation on github
- A `UInt8` for the number of decimals

and initializes the state of the contract. Initially, the circulating supply is set to zero, as no
tokens have been created yet.

## Methods

The user facing methods of `FungibleToken` are

```ts
@method.returns(AccountUpdate) async burn(from: PublicKey, amount: UInt64): Promise<AccountUpdate>

@method async transfer(from: PublicKey, to: PublicKey, amount: UInt64)
@method async approveBase(updates: AccountUpdateForest): Promise<void>
@method.returns(UInt64) async getBalanceOf(address: PublicKey): Promise<UInt64>
@method.returns(UInt64) async getCirculating(updateContractState: Bool): Promise<UInt64>
@method.returns(UInt8) async getDecimals(): Promise<UInt8>
```

The following methods call the admin account for permission, and are not supposed to be called by
regular users

```ts
@method async setAdmin(admin: PublicKey)
@method.returns(AccountUpdate) async mint(recipient: PublicKey, amount: UInt64): Promise<AccountUpdate>
@method async pause()
@method async resume()
```

### Minting, burning, and updating the circulating supply

In order to allow multiple minting/burning transactions in a single block, we use the
actions/reducer model of MINA. The `mint` and `burn` methods will modify the token balance in the
specified account. But instead of directly modifying the value of `circulating` in the contract
state, they will instead dispatches an action that instructs the reducer to modify the state. The
method `getCirculating(updateContractState:Bool)`, when supplied with
`updateContractState:Bool(true)`, collects all the actions and updates the state of the contract.

## Events

The following events are emitted from `FungibleToken` when appropriate:

```ts
events = {
  SetAdmin: PublicKey,
  Mint: MintEvent,
  Burn: BurnEvent,
  Transfer: TransferEvent,
}

class MintEvent extends Struct({
  recipient: PublicKey,
  amount: UInt64,
}) {}

class BurnEvent extends Struct({
  from: PublicKey,
  amount: UInt64,
}) {}

class TransferEvent extends Struct({
  from: PublicKey,
  to: PublicKey,
  amount: UInt64,
}) {}
```

Note that `approveBase` does not emit an event. Thus, transfers where the account updates have been
constructed externally to `FungibleToken` will not have an event emitted by the `FungibleToken`
contract.
