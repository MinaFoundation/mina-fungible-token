import {
  AccountUpdate,
  AccountUpdateForest,
  Bool,
  DeployArgs,
  Field,
  Int64,
  MerkleList,
  method,
  PublicKey,
  Reducer,
  State,
  state,
  Struct,
  TokenContract,
  UInt64,
  UInt8,
} from "o1js"
import { FungibleTokenAdmin, FungibleTokenAdminBase } from "./FungibleTokenAdmin.js"
import type { FungibleTokenLike } from "./FungibleTokenLike.js"

export interface FungibleTokenDeployProps extends Exclude<DeployArgs, undefined> {
  /** Address of the contract controlling permissions for administrative actions */
  admin: PublicKey
  /** The token symbol. */
  symbol: string
  /** A source code reference, which is placed within the `zkappUri` of the contract account. */
  src: string
  /** Number of decimals in a unit */
  decimals: UInt8
}

export class FungibleToken extends TokenContract implements FungibleTokenLike {
  @state(UInt8)
  decimals = State<UInt8>() // UInt64.from(9)
  @state(PublicKey)
  admin = State<PublicKey>()
  @state(UInt64)
  private circulating = State<UInt64>()
  @state(Field)
  actionState = State<Field>()
  @state(Bool)
  paused = State<Bool>()

  // This defines the type of the contract that is used to control access to administrative actions.
  // If you want to have a custom contract, overwrite this by setting FungibleToken.adminContract to
  // your own implementation of FungibleTokenAdminBase.
  static adminContract: new(...args: any) => FungibleTokenAdminBase = FungibleTokenAdmin

  readonly events = {
    SetAdmin: PublicKey,
    Mint: MintEvent,
    Burn: BurnEvent,
    Transfer: TransferEvent,
  }

  // We use actions and reducers for changing the circulating supply. That is to allow multiple mints/burns in a single block, which would not work if those would alter the contract state directly.
  // Minting will emit an action with a positive number corresponding to the amount of tokens minted, burning will emit a negative value.
  reducer = Reducer({ actionType: Int64 })

  async deploy(props: FungibleTokenDeployProps) {
    await super.deploy(props)

    this.admin.set(props.admin)
    this.circulating.set(UInt64.from(0))
    this.decimals.set(props.decimals)
    this.paused.set(Bool(false))

    this.account.tokenSymbol.set(props.symbol)
    this.account.zkappUri.set(props.src)

    this.actionState.set(Reducer.initialActionState)
  }

  public getAdminContract(): FungibleTokenAdminBase {
    return (new FungibleToken.adminContract(this.admin.getAndRequireEquals()))
  }

  @method
  async setAdmin(admin: PublicKey) {
    const canChangeAdmin = await this.getAdminContract().canChangeAdmin(admin)
    canChangeAdmin.assertTrue()
    this.admin.set(admin)
    this.emitEvent("SetAdmin", admin)
  }

  @method.returns(AccountUpdate)
  async mint(recipient: PublicKey, amount: UInt64) {
    this.paused.getAndRequireEquals().assertFalse()
    const accountUpdate = this.internal.mint({ address: recipient, amount })
    const canMint = await this.getAdminContract()
      .canMint(accountUpdate)
    canMint.assertTrue()
    this.approve(accountUpdate)
    this.emitEvent("Mint", new MintEvent({ recipient, amount }))
    this.reducer.dispatch(Int64.fromUnsigned(amount))
    return accountUpdate
  }

  @method.returns(AccountUpdate)
  async burn(from: PublicKey, amount: UInt64) {
    this.paused.getAndRequireEquals().assertFalse()
    const accountUpdate = this.internal.burn({ address: from, amount })
    this.emitEvent("Burn", new BurnEvent({ from, amount }))
    this.reducer.dispatch(Int64.fromUnsigned(amount).neg())
    return accountUpdate
  }

  @method
  async pause() {
    const canPause = await this.getAdminContract().canPause()
    canPause.assertTrue()
    this.paused.set(Bool(true))
  }

  @method
  async resume() {
    const canResume = await this.getAdminContract().canResume()
    canResume.assertTrue()
    this.paused.set(Bool(false))
  }

  @method
  async transfer(from: PublicKey, to: PublicKey, amount: UInt64) {
    this.paused.getAndRequireEquals().assertFalse()
    this.internal.send({ from, to, amount })
    this.emitEvent("Transfer", new TransferEvent({ from, to, amount }))
  }

  @method
  async approveBase(updates: AccountUpdateForest): Promise<void> {
    this.paused.getAndRequireEquals().assertFalse()
    this.checkZeroBalanceChange(updates)
  }

  @method.returns(UInt64)
  async getBalanceOf(address: PublicKey): Promise<UInt64> {
    const account = AccountUpdate.create(address, this.deriveTokenId()).account
    const balance = account.balance.get()
    account.balance.requireEquals(balance)
    return balance
  }

  /** This function is used to fold the actions from minting/burning */
  private calculateCirculating(
    oldCirculating: UInt64,
    pendingActions: MerkleList<MerkleList<Int64>>,
  ): UInt64 {
    let newCirculating: Int64 = this.reducer.reduce(
      pendingActions,
      Int64,
      (circulating: Int64, action: Int64) => {
        return circulating.add(action)
      },
      Int64.from(oldCirculating),
      { maxUpdatesWithActions: 500 },
    )
    newCirculating.isPositive().assertTrue()
    return newCirculating.magnitude
  }

  /** Reports the current circulating supply
   * This does take into account currently unreduced actions.
   */
  @method.returns(UInt64)
  async getCirculating(): Promise<UInt64> {
    let oldCirculating = this.circulating.getAndRequireEquals()
    let actionState = this.actionState.getAndRequireEquals()
    let pendingActions = this.reducer.getActions({ fromActionState: actionState })

    let newCirculating = this.calculateCirculating(oldCirculating, pendingActions)
    return newCirculating
  }

  /** Aggregate actions from minting and burning to update the circulating supply */
  @method
  async updateCirculating() {
    let oldCirculating = this.circulating.getAndRequireEquals()
    let actionState = this.actionState.getAndRequireEquals()
    let pendingActions = this.reducer.getActions({ fromActionState: actionState })

    let newCirculating = this.calculateCirculating(oldCirculating, pendingActions)

    this.circulating.set(newCirculating)
    this.actionState.set(pendingActions.hash)
  }

  @method.returns(UInt8)
  async getDecimals() {
    return this.decimals.getAndRequireEquals()
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
