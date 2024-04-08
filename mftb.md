# Mina Fungible Tokenbase[^tokenbase] Discussion

> WIP –– please don't read this quite yet!

This document is part specification and part meta-discussion. The specification portion touches on a
design for a "Fungible Tokenbase", which outline common actions, state reduction and lifecycle of an
approach to fungible tokens on Mina. The aim is to describe the minimum functionality necessary in a
common-good contract that enables dependents to compose use-case-specific fungible tokens while
still providing a common interface against which the community can develop (ie. exchanges, DAOs,
wallets, indexers and other programs). The process of speccing led to critical questions about not
only the implementation, but also the ultimate purpose of the specification itself.

## Purpose of Specification

Typically a specification would describe all the constraints that affect how one integrates with the
specified software. In the context of Ethereum, [EIPs](https://eips.ethereum.org/) provide a source
of truth on how to implement contracts and front-end clients such that they are interoperable with
other implementors. This is possible largely due to the fact that each contract is a service, the
instructions of which live in on-chain storage as ABIs. **This is not true of Mina**. To interact
with a Mina contract, one needs to run the contract code themselves. Each instuction affects how
contract results are ultimately proven. If the user executes seemingly spec–compliant contract
methods––even if those methods' signatures are aligned with the spec types––the result may vary from
that of other implementations. In the world of Mina, the implementation is––more or less––the spec.
This complicates the creation of tools that need to interact with the contract, as these tools need
to know more than just the spec/capabilities of the contract (they need the actual contract).

Some missing pieces need to come into place before we can develop contract standards which solve the
problems that standards are meant to solve. The first piece is a system for sharing metadata about
the provable properties of a contract. The second missing piece is tools for asserting that a given
unknown contract has the specified / expected provable properties.

### North Star

To be clear: I don't believe that a specification as TypeScript declarations would benefit the
community. I do however believe that we can implement and deploy a contract and corresponding
service that satisfy common fungible-token-related needs (including those of tool builders). This
will be the focus of the rest of this document.

## Design

### Goals

#### Simplicity

- custom token types can be created without the deployment of a custom contract.

#### Programmability

#### Timelessness

### Non-goals

#### Access Patterns

#### Authorization

#### Purging

- hence no minimum balance

### Actions

It seems that actions and reducers are the recommended path for new contracts, as this enables
multiple actions to be queued in a single block. Therefore, the Fungible Tokenbase API is typed as
actions ([see actions drawbacks](#actions-and-reducers)).

#### `Create`

Our first action is to create a new token type. Anyone can dispatch this action. It will fail if the
specified ID already exists.

> Alternatively, the method could increment a counter state and return it as the ID. However, this
> requires an unreleased o1js feature `@method.returns`. Also, it breaks the rollup reduction's
> commutativity.

```ts
interface Create {
  /** A unique ID of TBD type––perhaps a `UInt64`. */
  id: TokenId
  /** The initial amount of the new token. */
  supply: UInt64
  /** The account that administrates this token (can ultimately be contract). */
  admin: PublicKey
  /** The merkle root of some off-chain metadata (for instance, the token symbol). */
  metadata: Field
  /** The number of decimal places for which to account. */
  decimals: UInt8
}
```

Off-chain, this action should result in the addition of a new entry to a mapping from token ID to
`TokenInfo`.

```ts
interface TokenInfo {
  /** The current admin of the token. */
  admin: AccountId
  /** The current supply of the token */
  supply: UInt64
  /** The merkle root representing the accounts holding the current token. */
  accounts: Field
  /** The merkle root representing the metadata. */
  metadata: Field
}
```

This action should also initialize the admin account within the token info. Aka.
`TokenInfo["accounts"]` must also correspond to an off-chain mapping (in this case from `PublicKey`
to `AccountInfo`).

```ts
export interface AccountInfo {
  /** The balance of the current user in the current token. */
  balance: UInt64
  /** Whether the current account is frozen for the current token. */
  frozen: Bool
}
```

#### `Destroy`

The inverse of `Create` is `Destroy`, which accepts a single prop `token`, the ID of the token to
destroy.

> Note: this action should result in failure if the token supply is greater than zero.

```ts
interface Destroy {
  /** The ID of the token to destroy */
  token: TokenId
}
```

#### `SetAdmin`

The admin of a token has the ability to...

- Set a new admin.
- Mint and burn tokens to and from any account.
- Transfer between any two accounts.
- Freeze and thaw any accounts.
- Destroy the token of which they are admin.
- Allocate and deallocate funds between any two accounts.

Contracts can administrate a token type / implement their own behavior around authorization and the
dispatching of actions.

```ts
interface SetAdmin {
  /** The ID of the token on which to set the admin. */
  token: TokenId
  /** The new token admin. */
  admin: PublicKey
}
```

#### `Mint`

An admin can dispatch the `Mint` action, which adds the specified amount to the admin's account for
the given token. This also adds to the token supply in the token info.

```ts
interface Mint {
  /** The ID of the token we want to mint. */
  token: TokenId
  /** The beneficiary of the new tokens. */
  to: PublicKey
  /** The amount of the new token we want to mint. */
  amount: UInt64
}
```

#### `Burn`

```ts
interface Burn {
  /** The ID of the token to burn. */
  token: TokenId
  /** The account from which to burn. */
  from: PublicKey
  /** The amount to burn. */
  amount: UInt64
}
```

#### `Transfer`

```ts
export interface Transfer {
  /** The ID of the token to transfer. */
  token: TokenId
  /** The account from which to transfer the tokens. */
  from: PublicKey
  /** The account which should receive the tokens. */
  to: PublicKey
  /** The amount of tokens to transfer. */
  amount: UInt64
}
```

#### `Allocate`

Allocating is similar to transferring, except that the funds remain under the control of the `from`
account until the `to` account explicitly transfers out those funds. This also ensures that the
funds remain untouched should the `from` account balance dip beneath the amount of the allocation.
In a sense, it creates a pot and sets it to the side for a particular purpose / account.

```ts
interface Allocate {
  /** The unique ID of the allocation. */
  id: AllocationId
  /** The ID of the token.  */
  token: TokenId
  /** The account from which the allocation is made. */
  from: PublicKey
  /** The account which has the ability to transfer out the allocation. */
  to: PublicKey
  /** The amount to allocate. */
  amount: UInt64
}
```

#### `Deallocate`

The `from` account can reclaim the funds by dispatching a deallocation.

```ts
interface Deallocate {
  /** The ID of the allocation to deallocate. */
  allocation: AllocationId
}
```

#### `Freeze`

In some cases, the token administrator may want to freeze an account, thereby disabling transfers
and allocations.

```ts
interface Freeze {
  /** The ID of the token of the target account. */
  token: TokenId
  /** The account to be frozen. */
  who: PublicKey
}
```

#### `Thaw`

To thaw an account means to reenable transfers and allocations after freezing has occurred. The
action payload is identical to its counterpart `Freeze`.

```ts
interface Freeze {
  /** The ID of the token of the target account. */
  token: TokenId
  /** The account to be thawed. */
  who: PublicKey
}
```

#### `SetMetadata`

This action lets you associate the token with some arbitrary `Field`, which could be a merkle root.

```ts
interface SetMetadata {
  /** The token, the metadata of which is to be set. */
  token: TokenId
  /** The metadata. */
  metadata: Field
}
```

#### `SetAdmin`

```ts
interface SetAdmin {
  /** The token, the admin of which is to be set. */
  token: TokenId
  /** The new admin to set. */
  admin: PublicKey
}
```

## Architecture

### Actions and Reducers

There are several drawbacks, namely the need for a rollup method to reduce the actions and previous
state into the next state. Another drawback is that the action sequence must be processed in such a
way as to preserve commutativity, which is difficult for the use cases of a fungible token account
manager. Users may submit actions which touch on the same state. Even if this was not a constraint,
there is another constraint: operations involving the merkle root representing the accounts map must
be atomic (cc @kantp). With all of this in mind, I'd imagine much of the following API will take
shape off-chain. However, this API can serve as a north star for what we'd like to be able to
express with ZK.

### Representing Mappings

### Native Token Mechanism

[^tokenbase]: _Tokenbase_ is not a standard term, yet it seemed fitting for this system. That being
said, alternative (and perhaps more standard) terminology might be better.
