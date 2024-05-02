import {
  AccountUpdate,
  AccountUpdateForest,
  DeployArgs,
  method,
  PublicKey,
  State,
  state,
  Struct,
  TokenContract,
  UInt64,
} from "o1js"
import { FungibleTokenAdmin, FungibleTokenAdminBase } from "./FungibleTokenAdmin.js"
import type { FungibleTokenLike } from "./FungibleTokenLike.js"

export interface FungibleTokenDeployProps extends Exclude<DeployArgs, undefined> {
  /** Address of the contract controlling permissions for administrative actions */
  admin: PublicKey
  /** The max supply of the token. */
  supply: UInt64
  /** The token symbol. */
  symbol: string
  /** A source code reference, which is placed within the `zkappUri` of the contract account. */
  src: string
}

export class FungibleToken extends TokenContract implements FungibleTokenLike {
  decimals = UInt64.from(9)

  @state(PublicKey)
  admin = State<PublicKey>()
  @state(UInt64)
  private supply = State<UInt64>()
  @state(UInt64)
  private circulating = State<UInt64>()

  readonly events = {
    SetAdmin: PublicKey,
    Mint: MintEvent,
    SetSupply: UInt64,
    Burn: BurnEvent,
    Transfer: TransferEvent,
  }

  async deploy(props: FungibleTokenDeployProps) {
    await super.deploy(props)

    this.admin.set(props.admin)
    this.supply.set(props.supply)
    this.circulating.set(UInt64.from(0))

    this.account.tokenSymbol.set(props.symbol)
    this.account.zkappUri.set(props.src)
  }

  public getAdminContract(): FungibleTokenAdminBase {
    return (new FungibleTokenAdmin(this.admin.getAndRequireEquals()))
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
    const canMint = await this.getAdminContract()
      .canMint(accountUpdate)
    canMint.assertTrue()
    this.approve(accountUpdate)
    this.emitEvent("Mint", new MintEvent({ recipient, amount }))
    return accountUpdate
  }

  @method
  async setSupply(supply: UInt64): Promise<void> {
    const canSetSupply = await this.getAdminContract()
      .canSetSupply(supply)
    canSetSupply.assertTrue()
    this.circulating.getAndRequireEquals().assertLessThanOrEqual(supply)
    this.supply.set(supply)
    this.emitEvent("SetSupply", supply)
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
    const account = AccountUpdate.create(address, this.deriveTokenId()).account
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
