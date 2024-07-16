import {
  AccountUpdate,
  AccountUpdateForest,
  assert,
  Bool,
  DeployArgs,
  Field,
  Int64,
  method,
  Permissions,
  Provable,
  PublicKey,
  State,
  state,
  Struct,
  TokenContract,
  Types,
  UInt64,
  UInt8,
} from "o1js"
import { FungibleTokenAdmin, FungibleTokenAdminBase } from "./FungibleTokenAdmin.js"

interface FungibleTokenDeployProps extends Exclude<DeployArgs, undefined> {
  /** Address of the contract controlling permissions for administrative actions */
  admin: PublicKey
  /** The token symbol. */
  symbol: string
  /** A source code reference, which is placed within the `zkappUri` of the contract account.
   * Typically a link to a file on github. */
  src: string
  /** Number of decimals in a unit */
  decimals: UInt8
  /** Unless this is set to `true`, the tokens will start in paused mode,
   * and will need to be explicitly resumed by calling the `resume()` method.
   * You should only set this to `true` in atomic deploys. */
  startUnpaused?: boolean
}

export class FungibleToken extends TokenContract {
  @state(UInt8)
  decimals = State<UInt8>()
  @state(PublicKey)
  admin = State<PublicKey>()
  @state(Bool)
  paused = State<Bool>()

  // This defines the type of the contract that is used to control access to administrative actions.
  // If you want to have a custom contract, overwrite this by setting FungibleToken.AdminContract to
  // your own implementation of FungibleTokenAdminBase.
  static AdminContract: new(...args: any) => FungibleTokenAdminBase = FungibleTokenAdmin

  readonly events = {
    SetAdmin: SetAdminEvent,
    Pause: PauseEvent,
    Mint: MintEvent,
    Burn: BurnEvent,
    BalanceChange: BalanceChangeEvent,
  }

  async deploy(props: FungibleTokenDeployProps) {
    await super.deploy(props)

    this.admin.set(props.admin)
    this.decimals.set(props.decimals)
    this.paused.set(Bool(false))

    this.account.tokenSymbol.set(props.symbol)
    this.account.zkappUri.set(props.src)

    if (props.startUnpaused) {
      this.paused.set(Bool(false))
    } else {
      this.paused.set(Bool(true))
    }
  }

  // ** Initializes the account for tracking total circulation. */
  @method
  async initialize() {
    const accountUpdate = AccountUpdate.createSigned(this.address, this.deriveTokenId())
    let permissions = Permissions.default()
    // This is necessary in order to allow token holders to burn.
    permissions.send = Permissions.none()
    accountUpdate.account.permissions.set(permissions)
  }

  public async getAdminContract(): Promise<FungibleTokenAdminBase> {
    const admin = await Provable.witnessAsync(PublicKey, async () => {
      let pk = await this.admin.fetch()
      assert(pk !== undefined, "could not fetch admin contract key")
      return pk
    })
    this.admin.requireEquals(admin)
    return (new FungibleToken.AdminContract(admin))
  }

  @method
  async setAdmin(admin: PublicKey) {
    const adminContract = await this.getAdminContract()
    const canChangeAdmin = await adminContract.canChangeAdmin(admin)
    canChangeAdmin.assertTrue()
    this.admin.set(admin)
    this.emitEvent("SetAdmin", new SetAdminEvent({ adminKey: admin }))
  }

  @method.returns(AccountUpdate)
  async mint(recipient: PublicKey, amount: UInt64): Promise<AccountUpdate> {
    this.paused.getAndRequireEquals().assertFalse()
    const accountUpdate = this.internal.mint({ address: recipient, amount })
    const adminContract = await this.getAdminContract()
    const canMint = await adminContract.canMint(accountUpdate)
    canMint.assertTrue()
    this.approve(accountUpdate)
    this.emitEvent("Mint", new MintEvent({ recipient, amount }))
    const circulationUpdate = AccountUpdate.create(this.address, this.deriveTokenId())
    circulationUpdate.balanceChange = Int64.fromUnsigned(amount)
    return accountUpdate
  }

  @method.returns(AccountUpdate)
  async burn(from: PublicKey, amount: UInt64): Promise<AccountUpdate> {
    this.paused.getAndRequireEquals().assertFalse()
    const accountUpdate = this.internal.burn({ address: from, amount })
    const circulationUpdate = AccountUpdate.create(this.address, this.deriveTokenId())
    circulationUpdate.balanceChange = Int64.fromUnsigned(amount).negV2()
    this.emitEvent("Burn", new BurnEvent({ from, amount }))
    return accountUpdate
  }

  @method
  async pause() {
    const adminContract = await this.getAdminContract()
    const canPause = await adminContract.canPause()
    canPause.assertTrue()
    this.paused.set(Bool(true))
    this.emitEvent("Pause", new PauseEvent({ isPaused: Bool(true) }))
  }

  @method
  async resume() {
    const adminContract = await this.getAdminContract()
    const canResume = await adminContract.canResume()
    canResume.assertTrue()
    this.paused.set(Bool(false))
    this.emitEvent("Pause", new PauseEvent({ isPaused: Bool(false) }))
  }

  @method
  async transfer(from: PublicKey, to: PublicKey, amount: UInt64) {
    this.paused.getAndRequireEquals().assertFalse()
    this.internal.send({ from, to, amount })
  }

  private checkPermissionsUpdate(update: AccountUpdate) {
    let permissions = update.update.permissions

    let { access, receive } = permissions.value
    let accessIsNone = Provable.equal(Types.AuthRequired, access, Permissions.none())
    let receiveIsNone = Provable.equal(Types.AuthRequired, receive, Permissions.none())
    let updateAllowed = accessIsNone.and(receiveIsNone)

    assert(updateAllowed.or(permissions.isSome.not()))
  }

  @method
  async approveBase(updates: AccountUpdateForest): Promise<void> {
    this.paused.getAndRequireEquals().assertFalse()
    let totalBalance = Int64.from(0)
    this.forEachUpdate(updates, (update, usesToken) => {
      // Make sure that the account permissions are not changed
      this.checkPermissionsUpdate(update)
      this.emitEventIf(
        usesToken,
        "BalanceChange",
        new BalanceChangeEvent({ address: update.publicKey, amount: update.balanceChange }),
      )
      // Don't allow transfers to/from the account that's tracking circulation
      update.publicKey.equals(this.address).and(usesToken).assertFalse(
        "Can't transfer to/from the circulation account",
      )
      totalBalance = Provable.if(usesToken, totalBalance.add(update.balanceChange), totalBalance)
      totalBalance.isPositiveV2().assertFalse(
        "Flash-minting detected. Please make sure that your `AccountUpdate`s are ordered properly, so that tokens are not received before they are sent.",
      )
    })
    totalBalance.assertEquals(Int64.zero)
  }

  @method.returns(UInt64)
  async getBalanceOf(address: PublicKey): Promise<UInt64> {
    const account = AccountUpdate.create(address, this.deriveTokenId()).account
    const balance = account.balance.get()
    account.balance.requireEquals(balance)
    return balance
  }

  /** Reports the current circulating supply
   * This does take into account currently unreduced actions.
   */
  async getCirculating(): Promise<UInt64> {
    let circulating = await this.getBalanceOf(this.address)
    return circulating
  }

  @method.returns(UInt8)
  async getDecimals(): Promise<UInt8> {
    return this.decimals.getAndRequireEquals()
  }
}

export class SetAdminEvent extends Struct({
  adminKey: PublicKey,
}) {}

export class PauseEvent extends Struct({
  isPaused: Bool,
}) {}

export class MintEvent extends Struct({
  recipient: PublicKey,
  amount: UInt64,
}) {}

export class BurnEvent extends Struct({
  from: PublicKey,
  amount: UInt64,
}) {}

export class BalanceChangeEvent extends Struct({
  address: PublicKey,
  amount: Int64,
}) {}
