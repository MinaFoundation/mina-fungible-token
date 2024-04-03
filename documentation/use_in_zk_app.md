# Use in a ZkApp

With zkApps, you can also build smart contracts that interact with tokens. For example, a simple
escrow contract, where tokens can be deposited to and withdrawn from.

## Escrow contract code

Interacting with tokens from a zkApp is as simple as writing off-chain code (same code like in
previous chapter is executed from within zkApp methods):

```ts
export class TokenEscrow extends SmartContract {
  @state(PublicKey)
  tokenAddress = State<PublicKey>()
  @state(UInt64)
  total = State<UInt64>()

  deploy(args: DeployArgs & { tokenAddress: PublicKey }) {
    super.deploy(args)
    this.tokenAddress.set(args.tokenAddress)
    this.total.set(UInt64.zero)
  }

  @method
  deposit(from: PublicKey, amount: UInt64) {
    const token = new FungibleToken(this.tokenAddress.getAndRequireEquals())
    token.transfer(from, this.address, amount)
    const total = this.total.getAndRequireEquals()
    this.total.set(total.add(amount))
  }

  @method
  withdraw(to: PublicKey, amount: UInt64) {
    const token = new FungibleToken(this.tokenAddress.getAndRequireEquals())
    const total = this.total.getAndRequireEquals()
    total.greaterThanOrEqual(amount)
    this.total.set(total.sub(amount))
    token.transfer(this.address, to, amount)
  }
}
```

## Interacting with token escrow

Refer to
[examples/escrow.eg.ts](https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/escrow.eg.ts)
to see executable `TokenEscrow` example.
