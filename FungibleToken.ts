import {
  Account,
  AccountUpdate,
  AccountUpdateForest,
  Bool,
  DeployArgs,
  Field,
  Int64,
  method,
  Provable,
  PublicKey,
  Reducer,
  Signature,
  State,
  state,
  Struct,
  TokenContract,
  UInt64,
} from "o1js"
import type { FungibleTokenLike } from "./FungibleTokenLike.js"

export interface FungibleTokenDeployProps extends Exclude<DeployArgs, undefined> {
  /** The initial administrator of the token contract. */
  owner: PublicKey
  /** The max supply of the token. */
  supply: UInt64
  /** The token symbol. */
  symbol: string
  /** A source code reference, which is placed within the `zkappUri` of the contract account. */
  src: string
}

class MintOrBurnAction extends Struct({
  isMint: Bool,
  publicKey: PublicKey,
  amount: UInt64,
}) {}

export class FungibleToken extends TokenContract implements FungibleTokenLike {
  decimals = UInt64.from(9)

  @state(PublicKey)
  private owner = State<PublicKey>()
  @state(UInt64)
  private supply = State<UInt64>()
  @state(UInt64)
  private circulating = State<UInt64>()
  @state(Field)
  private actionState = State<Field>()

  readonly events = {
    SetOwner: PublicKey,
    Mint: MintEvent,
    SetSupply: UInt64,
    Burn: BurnEvent,
    Transfer: TransferEvent,
  }

  reducer = Reducer({ actionType: MintOrBurnAction })

  init() {
    super.init();
    this.actionState.set(Reducer.initialActionState)
  }

  @method
  async dispatchBurn(from: PublicKey, amount: UInt64, signature: Signature) {
    signature.verify(
      from,
      this.sender.self.account.nonce.getAndRequireEquals().toFields().concat(amount.toFields()),
    )
    this.reducer.dispatch(
      new MintOrBurnAction({
        isMint: Bool(false),
        publicKey: from,
        amount,
      }),
    )
  }

  @method
  async dispatchMint(from: PublicKey, amount: UInt64) {
    this.ensureOwnerSignature()
    this.reducer.dispatch(
      new MintOrBurnAction({
        isMint: Bool(true),
        publicKey: from,
        amount,
      }),
    )
  }

  @method
  async reduceActions() {
    const circulating = this.circulating.getAndRequireEquals()
    const supply = this.supply.getAndRequireEquals()
    const actionState = this.actionState.getAndRequireEquals()

    let pendingActions = this.reducer.getActions({
      fromActionState: actionState,
    })

    let { state: newCirculating, actionState: newActionState } = this.reducer.reduce(
      pendingActions,
      UInt64,
      (state: UInt64, action: MintOrBurnAction) => {
        const newStateField = Provable.if(
          action.isMint.not(),
          Field,
          state.value.sub(action.amount.value),
          Provable.if(
            state.add(action.amount).lessThanOrEqual(supply),
            UInt64,
            state.add(action.amount),
            state,
          ).value,
        )
        const newState = UInt64.Unsafe.fromField(newStateField)
        UInt64.check(newState)

        // ensure that the account update is a "dummy" if there was no circulating supply change
        // => dummies are filtered out before creating the final transaction
        const shouldSkip = newState.equals(state);
        const publicKey = Provable.if(shouldSkip, PublicKey.empty(), action.publicKey);
        const au = AccountUpdate.create(publicKey, this.deriveTokenId());

        au.balanceChange = Provable.if(
          action.isMint,
          Int64,
          au.balanceChange.add(action.amount),
          au.balanceChange.add(action.amount).neg(),
        )

        return newState
      },
      { state: circulating, actionState },
      { maxTransactionsWithActions: 5 },
    )

    // update on-chain state
    this.circulating.set(newCirculating)
    this.actionState.set(newActionState)
  }

  async deploy(props: FungibleTokenDeployProps) {
    await super.deploy(props)

    this.owner.set(props.owner)
    this.supply.set(props.supply)
    this.circulating.set(UInt64.from(0))

    this.account.tokenSymbol.set(props.symbol)
    this.account.zkappUri.set(props.src)
  }

  private ensureOwnerSignature() {
    const owner = this.owner.getAndRequireEquals()
    return AccountUpdate.createSigned(owner)
  }

  @method
  async setOwner(owner: PublicKey) {
    this.ensureOwnerSignature()
    this.owner.set(owner)
    this.emitEvent("SetOwner", owner)
  }

  @method.returns(AccountUpdate)
  async mint(recipient: PublicKey, amount: UInt64) {
    this.ensureOwnerSignature()
    const supply = this.supply.getAndRequireEquals()
    const circulating = this.circulating.getAndRequireEquals()
    const nextCirculating = circulating.add(amount)
    // TODO: is this where we'd use `Provable.if` and witness creation?
    nextCirculating.assertLessThanOrEqual(
      supply,
      "Minting the provided amount would overflow the total supply.",
    )
    this.circulating.set(nextCirculating)
    const accountUpdate = this.internal.mint({ address: recipient, amount })
    this.emitEvent("Mint", new MintEvent({ recipient, amount }))
    return accountUpdate
  }

  @method
  async setSupply(amount: UInt64): Promise<void> {
    this.ensureOwnerSignature()
    this.circulating.getAndRequireEquals().assertLessThanOrEqual(amount)
    this.supply.set(amount)
    this.emitEvent("SetSupply", amount)
  }

  @method.returns(AccountUpdate)
  async burn(from: PublicKey, amount: UInt64) {
    this.circulating.set(this.circulating.getAndRequireEquals().sub(amount))
    const accountUpdate = this.internal.burn({ address: from, amount })
    this.emitEvent("Burn", new BurnEvent({ from, amount }))
    return accountUpdate
  }

  @method
  async transfer(from: PublicKey, to: PublicKey, amount: UInt64) {
    this.internal.send({ from, to, amount })
    this.emitEvent("Transfer", new TransferEvent({ from, to, amount }))
  }

  @method
  async approveBase(updates: AccountUpdateForest): Promise<void> {
    this.checkZeroBalanceChange(updates)
    // TODO: event emission here
  }

  @method.returns(UInt64)
  async getBalanceOf(address: PublicKey): Promise<UInt64> {
    const account = Account(address, this.deriveTokenId())
    const balance = account.balance.get()
    account.balance.requireEquals(balance)
    return balance
  }

  @method.returns(UInt64)
  async getSupply() {
    return this.supply.getAndRequireEquals()
  }

  @method.returns(UInt64)
  async getCirculating(): Promise<UInt64> {
    return this.circulating.getAndRequireEquals()
  }

  @method.returns(UInt64)
  async getDecimals() {
    return this.decimals
  }
}

export class MintEvent extends Struct({
  recipient: PublicKey,
  amount: UInt64,
}) {}

export class BurnEvent extends Struct({
  from: PublicKey,
  amount: UInt64,
}) {}

export class TransferEvent extends Struct({
  from: PublicKey,
  to: PublicKey,
  amount: UInt64,
}) {}
