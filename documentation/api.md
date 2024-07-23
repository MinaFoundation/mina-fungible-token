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
@state(Bool) paused = State<Bool>()
```

The `deploy()` function takes as arguments

- A string to use as the token symbol
- A string pointing to the source code of the contract -- when following the standard, this should
  point to the source of the standard implementation on github

Immediately after deploying the contract -- ideally, in the same transaction -- the contract needs
to be initialized via the `initialize()` method. Its arguments are

- The public key of the account that the admin contract has been deployed to
- A `UInt8` for the number of decimals
- A `Bool` to determine whether the token contract should start in paused mode. whether token
  transfers should be enabled immediately. If set to `Bool(true)`, the token contract will be in a
  paused state initially, and the `resume()` method will need to be called before tokens can be
  minted or transferred. This is safer if you have a non-atomic deploy (i.e., if you do not have the
  admin contract deployed in the same transaction as the token contract is itself is deployed and
  initialized).

This method initializes the state of the contract. Initially, the circulating supply is set to zero,
as no tokens have been created yet.

## Methods

The user facing methods of `FungibleToken` are

```ts
@method.returns(AccountUpdate) async burn(from: PublicKey, amount: UInt64): Promise<AccountUpdate>

@method async transfer(from: PublicKey, to: PublicKey, amount: UInt64)
@method async approveBase(updates: AccountUpdateForest): Promise<void>
@method.returns(UInt64) async getBalanceOf(address: PublicKey): Promise<UInt64>
@method.returns(UInt64) async getCirculating(): Promise<UInt64>
@method async updateCirculating()
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

### Minting, burning, and keeping track of the circulating supply

In order to allow multiple minting/burning transactions in a single block, we do not tally the
circulating supply as part of the contract state. Instead, we use a special account, the balance of
which always corresponds to the total number of tokens in other accounts. The balance of this
account is updated in the `mint()` and `burn()` methods. Transfers to and from this account are not
possible. The `getCirculating()` method reports the balance of the account.

Note that if you want to require certain limits on the circulation, you should express your
constraints using `requireBetween()` rather than `requireEquals()`. This is more robust against
minting or burning transactions in the same block invalidating your preconditions.

## Events

The following events are emitted from `FungibleToken` when appropriate:

```ts
events = {
  SetAdmin: SetAdminEvent,
  Pause: PauseEvent,
  Mint: MintEvent,
  Burn: BurnEvent,
  BalanceChange: BalanceChangeEvent,
}

export class SetAdminEvent extends Struct({
  adminKey: PublicKey,
}) {}

export class PauseEvent extends Struct({
  isPaused: Bool,
}) {}

class MintEvent extends Struct({
  recipient: PublicKey,
  amount: UInt64,
}) {}

class BurnEvent extends Struct({
  from: PublicKey,
  amount: UInt64,
}) {}

export class BalanceChangeEvent extends Struct({
  address: PublicKey,
  amount: Int64,
}) {}
```

Note that `MintEvent`, `BurnEvent`, and `BalanceChangeEvent` each signal that the balance of an
account changes. The difference is that `MintEvent` and `BurnEvent` are emitted when tokens are
minted/burned, and `BalanceChangeEvent` is emitted when a transaction takes tokens from some
addresses, and sends them to others.

[!NOTE] Note that `MintEvent`, `BurnEvent`, and `BalanceChangeEvent` events can be emitted with
`amount = 0`. If you want to track "true" mints/burns/transfers (for example, to maintain a list of
depositors), you will need to filter for non-zero values of `amount`.
