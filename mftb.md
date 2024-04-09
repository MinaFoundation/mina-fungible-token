# Mina Fungible Tokenbase[^tokenbase] Discussion

> WIP –– please don't read this quite yet!

This document is part specification and part meta-discussion. The specification portion touches on a
design for a "Fungible Tokenbase", which outlines an approach to modeling fungible tokens on Mina.
This includes interfaces for common actions, descriptions of how actions should be reduced into
subsequent states, and the fungible token lifecycle. It describes the minimum functionality
necessary in a common-good contract which enables dependents to compose use-case-specific fungible
tokens while still providing a common interface against which the community (namely wallets) can
develop. The process of speccing this out led to critical questions about not only the possibility
of implementation, but also the ultimate purpose of the specification itself.

## Purpose of Specification

Typically a specification would describe all the constraints that affect how one integrates with the
specified software. In the context of Ethereum, [EIPs](https://eips.ethereum.org/) specify how to
implement contracts and contract consumers such that they are interoperable with other
implementations of the target spec. This is possible because contract instructions live in on-chain
storage as ABIs. **This is not true of Mina**. To interact with a Mina contract, one needs to run
the contract code. Each instruction affects how contract results are ultimately proven. If the user
executes seemingly spec–compliant contract methods––even if those methods' type signatures are
aligned with those of the spec––the results may vary from that of other implementations. In the
world of Mina, the implementation is––more or less––the spec. This complicates the creation of tools
that need to interact with contracts, as these tools need to know more than just the types and
capabilities of the contract; they need the actual contract.

### Long-term Consideration

Some missing pieces need to come into place before we can design contract specs which solve the
problems that specs are meant to solve: the first step is to build a system for extracting and
sharing metadata about the provable properties of a contract. The second step is to create a tool
which asserts that a given unknown contract has the specified properties. This would enable the
creation and confirmation of "spec"-compliant contracts in the Mina sense of the word "spec."

## Near-term Recommendation

I don't believe that speccing via TypeScript interfaces alone will benefit the community. To deliver
a worthwhile fungible-token solution, we could create and deploy a contract and corresponding
service that satisfy common use cases. Although not a "spec", this contract and service could
provide common APIs with which developers could manage fungible tokens and administrate those tokens
from their own, use-case-specific contracts. Exploring this possibility will be the focus of the
remainder of this document.

## Design

### Goals

- **Wallet-friendly**: wallets should be able to display and prove data of `FungibleTokenbase`s
  without needing to dynamically import the code of token admin contracts.
- **Forgo Deployment**: it should be possible to create custom token types without the deployment of
  a custom fungible token contract. Token types are just data after all; token-type-specific
  contracts––at least for basic functionality––is unnecessary.
- **Extensible**: the token contract should offer all functionality necessary for 3rd-party
  contracts to become token admins and craft use-case-specific functionality.
- **Scalable**: the contract should support concurrent transactions.
- **Access Patterns**: the contract-accompanying service should facilitate interaction with
  persisted off-chain state (computing new merkle roots, paginating lists of tokens and token
  accounts, misc.).

### Non-goals

- **Fine-grained Authorization**: there is no separation of administrative role by action. The token
  admin can perform all actions. Meanwhile accounts can manipulate their token-specific accounts
  (unless frozen by the token admin). To implement more advanced authorization, developers can
  create and set as admin a contract that delegates back to the token base.
- **Account Purging or "Sufficiency"**: the fungible token base does not seek to represent
  existential deposits nor weight custom tokens against native tokens such as Mina. There is no
  minimum balance. When a token account has no funds, it is no longer represented in state. If it
  "receives" funds (either from a transfer or from allocation) it exists.

### Actions

It seems that actions and reducers are the recommended path for new o1js contracts, as this enables
multiple actions to be queued in a single block. Therefore, the Fungible Tokenbase API is typed as
actions ([see actions drawbacks](#actions-and-reducers)). These actions are used to reduce a new
state whenever a `Commit` action is dispatched. This means that users can run many commands in rapid
succession while still ensuring inclusion later. This lazy state model is seemingly key to
scalability.

> Note: actions/reducers have [drawbacks](#actions-and-reducers).

#### `Create`

Our first action is to create a new token type. Everyone is authorized to dispatch this action.

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

**Successful State Change:**

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

**Errors**

- `TokenIdAlreadyExistsError` – The ID specified in the``create` call already exists.

#### `Destroy`

The inverse of the `Create` action is `Destroy`, which accepts a single prop `token`, the ID of the
token to destroy.

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

## Architecture

### Actions and Reducers

There are several drawbacks to the actions/reducers approach. Namely the need for a commit method to
reduce the actions and previous state into the next state. Another drawback is that the action
sequence must be processed in such a way as to preserve commutativity, which is difficult for the
use cases of a fungible token account manager. Users may submit actions which touch on the same
state. Even if this was not a constraint, there is another constraint: operations involving the
merkle root representing the accounts map must be atomic (cc @kantp). With all of this in mind, I'd
imagine much of the following API will take shape off-chain. However, this API can serve as a north
star for what we'd like to be able to express with ZK.

### Representing Mappings

### Native Token Mechanism

[^tokenbase]: _Tokenbase_ is not a standard term, yet it seemed fitting for this system. That being
said, alternative terminology might be better.
