# FungibleTokenBase API overview

The token standard implementation is a Token Manager zkApp that is splitted in 2 parts: low-level and high-level one.

The low-level implementation is included in `o1js` library `TokenContract` abstract class. See the overview in the o1js [Custom Tokens tutorial](https://docs.minaprotocol.com/zkapps/o1js/custom-tokens)

> [!WARNING]
> Please note that this is a beta release. The implementation will change soon. The API may also change in future.

The high-level part inherts from the `TokenContract` class and has following user-facing features:

## On-chain State, `decimals` and deploy arguments

The on-chain state is defined as follows:

```ts
@state(PublicKey) public owner = State<PublicKey>();
@state(UInt64) public supply = State<UInt64>();
@state(UInt64) public circulating = State<UInt64>();
```

- `owner` is set on deployment, and some of token functionality requires an admin signature.

    If you want to implement admin-only method, just call `this.ensureOwnerSignature()` helper in the method you want to protect.

- `supply` defines a maximum amount of tokens to exist. It is set on deployment and can be modified with `setSupply()` function (can be called by admin only)

- `circulating` tracks the total amount in circulation. When new tokens are minted, the `circulating` increases by an amount minted.

- The `decimals` is a constant, that defines where to place the decimal comma in the token amounts.

- The `deploy()` function requires `owner` and `supply` to be passed as parameters.

- Along with state variables initial values, the `deploy()` function also takes `symbol` (to set `account.tokenSymbol`) and `src` (to set `account.zkappUri`)

## Methods

Methods that can be called only by admin are:

```ts
mint(address: PublicKey, amount: UInt64)
setTotalSupply(amount: UInt64)
setOwner(owner: PublicKey)
```

Transfer and burn functionality is available by following methods:

```ts
transfer(from: PublicKey, to: PublicKey, amount: UInt64)
burn(from: PublicKey, amount: UInt64)
```

Helper methods for reading state variables and account balance

```ts
getBalanceOf(address: PublicKey)
getSupply()
getCirculating()
getDecimals()
```

## Events

On each token operation, the event is emitted.
The events are declared as follows:

```ts
events = {
  SetOwner: PublicKey,
  Mint: MintEvent,
  SetSupply: UInt64,
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

That completes a review of a fungible token. 
