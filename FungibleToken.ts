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
  TokenContractV2,
  Types,
  UInt64,
  UInt8,
  VerificationKey,
} from "o1js"
import { FungibleTokenAdmin, FungibleTokenAdminBase } from "./FungibleTokenAdmin.js"

interface FungibleTokenDeployProps extends Exclude<DeployArgs, undefined> {
  /** The token symbol. */
  symbol: string
  /** A source code reference, which is placed within the `zkappUri` of the contract account.
   * Typically a link to a file on github. */
  src: string
}

export const FungibleTokenErrors = {
  noAdminKey: "could not fetch admin contract key",
  noPermissionToChangeAdmin: "Not allowed to change admin contract",
  tokenPaused: "Token is currently paused",
  noPermissionToMint: "Not allowed to mint tokens",
  noPermissionToPause: "Not allowed to pause token",
  noPermissionToResume: "Not allowed to resume token",
  noTransferFromCirculation: "Can't transfer to/from the circulation account",
  noPermissionChangeAllowed: "Can't change permissions for access or receive on token accounts",
  flashMinting:
    "Flash-minting or unbalanced transaction detected. Please make sure that your transaction is balanced, and that your `AccountUpdate`s are ordered properly, so that tokens are not received before they are sent.",
  unbalancedTransaction: "Transaction is unbalanced",
}

export class FungibleToken extends TokenContractV2 {
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
    this.paused.set(Bool(true))
    this.account.zkappUri.set(props.src)
    this.account.tokenSymbol.set(props.symbol)

    this.account.permissions.set({
      ...Permissions.default(),
      setVerificationKey: Permissions.VerificationKey.impossibleDuringCurrentVersion(),
      setPermissions: Permissions.impossible(),
      access: Permissions.proof(),
    })
  }

  /** Update the verification key.
   * Note that because we have set the permissions for setting the verification key to `impossibleDuringCurrentVersion()`, this will only be possible in case of a protocol update that requires an update.
   */
  @method
  async updateVerificationKey(vk: VerificationKey) {
    this.account.verificationKey.set(vk)
  }

  /** Initializes the account for tracking total circulation.
   * @argument {PublicKey} admin - public key where the admin contract is deployed
   * @argument {UInt8} decimals - number of decimals for the token
   * @argument {Bool} startPaused - if set to `Bool(true), the contract will start in a mode where token minting and transfers are paused. This should be used for non-atomic deployments
   */
  @method
  async initialize(
    admin: PublicKey,
    decimals: UInt8,
    startPaused: Bool,
  ) {
    this.account.provedState.requireEquals(Bool(false))

    this.admin.set(admin)
    this.decimals.set(decimals)
    this.paused.set(Bool(false))

    this.paused.set(startPaused)

    const accountUpdate = AccountUpdate.createSigned(this.address, this.deriveTokenId())
    let permissions = Permissions.default()
    // This is necessary in order to allow token holders to burn.
    permissions.send = Permissions.none()
    permissions.setPermissions = Permissions.impossible()
    accountUpdate.account.permissions.set(permissions)
  }

  public async getAdminContract(): Promise<FungibleTokenAdminBase> {
    const admin = await Provable.witnessAsync(PublicKey, async () => {
      let pk = await this.admin.fetch()
      assert(pk !== undefined, FungibleTokenErrors.noAdminKey)
      return pk
    })
    this.admin.requireEquals(admin)
    return (new FungibleToken.AdminContract(admin))
  }

  @method
  async setAdmin(admin: PublicKey) {
    const adminContract = await this.getAdminContract()
    const canChangeAdmin = await adminContract.canChangeAdmin(admin)
    canChangeAdmin.assertTrue(FungibleTokenErrors.noPermissionToChangeAdmin)
    this.admin.set(admin)
    this.emitEvent("SetAdmin", new SetAdminEvent({ adminKey: admin }))
  }

  @method.returns(AccountUpdate)
  async mint(recipient: PublicKey, amount: UInt64): Promise<AccountUpdate> {
    this.paused.getAndRequireEquals().assertFalse(FungibleTokenErrors.tokenPaused)
    const accountUpdate = this.internal.mint({ address: recipient, amount })
    const adminContract = await this.getAdminContract()
    const canMint = await adminContract.canMint(accountUpdate)
    canMint.assertTrue(FungibleTokenErrors.noPermissionToMint)
    recipient.equals(this.address).assertFalse(
      FungibleTokenErrors.noTransferFromCirculation,
    )
    this.approve(accountUpdate)
    this.emitEvent("Mint", new MintEvent({ recipient, amount }))
    const circulationUpdate = AccountUpdate.create(this.address, this.deriveTokenId())
    circulationUpdate.balanceChange = Int64.fromUnsigned(amount)
    return accountUpdate
  }

  @method.returns(AccountUpdate)
  async burn(from: PublicKey, amount: UInt64): Promise<AccountUpdate> {
    this.paused.getAndRequireEquals().assertFalse(FungibleTokenErrors.tokenPaused)
    const accountUpdate = this.internal.burn({ address: from, amount })
    const circulationUpdate = AccountUpdate.create(this.address, this.deriveTokenId())
    from.equals(this.address).assertFalse(
      FungibleTokenErrors.noTransferFromCirculation,
    )
    circulationUpdate.balanceChange = Int64.fromUnsigned(amount).negV2()
    this.emitEvent("Burn", new BurnEvent({ from, amount }))
    return accountUpdate
  }

  @method
  async pause() {
    const adminContract = await this.getAdminContract()
    const canPause = await adminContract.canPause()
    canPause.assertTrue(FungibleTokenErrors.noPermissionToPause)
    this.paused.set(Bool(true))
    this.emitEvent("Pause", new PauseEvent({ isPaused: Bool(true) }))
  }

  @method
  async resume() {
    const adminContract = await this.getAdminContract()
    const canResume = await adminContract.canResume()
    canResume.assertTrue(FungibleTokenErrors.noPermissionToResume)
    this.paused.set(Bool(false))
    this.emitEvent("Pause", new PauseEvent({ isPaused: Bool(false) }))
  }

  @method
  async transfer(from: PublicKey, to: PublicKey, amount: UInt64) {
    this.paused.getAndRequireEquals().assertFalse(FungibleTokenErrors.tokenPaused)
    from.equals(this.address).assertFalse(
      FungibleTokenErrors.noTransferFromCirculation,
    )
    to.equals(this.address).assertFalse(
      FungibleTokenErrors.noTransferFromCirculation,
    )
    this.internal.send({ from, to, amount })
  }

  private checkPermissionsUpdate(update: AccountUpdate) {
    let permissions = update.update.permissions

    let { access, receive } = permissions.value
    let accessIsNone = Provable.equal(Types.AuthRequired, access, Permissions.none())
    let receiveIsNone = Provable.equal(Types.AuthRequired, receive, Permissions.none())
    let updateAllowed = accessIsNone.and(receiveIsNone)

    assert(
      updateAllowed.or(permissions.isSome.not()),
      FungibleTokenErrors.noPermissionChangeAllowed,
    )
  }

  /** Approve `AccountUpdate`s that have been created outside of the token contract.
   *
   * @argument {AccountUpdateForest} updates - The `AccountUpdate`s to approve. Note that the forest size is limited by the base token contract, @see TokenContractV2.MAX_ACCOUNT_UPDATES The current limit is 9.
   */
  @method
  async approveBase(updates: AccountUpdateForest): Promise<void> {
    this.paused.getAndRequireEquals().assertFalse(FungibleTokenErrors.tokenPaused)
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
        FungibleTokenErrors.noTransferFromCirculation,
      )
      totalBalance = Provable.if(usesToken, totalBalance.add(update.balanceChange), totalBalance)
      totalBalance.isPositiveV2().assertFalse(
        FungibleTokenErrors.flashMinting,
      )
    })
    totalBalance.assertEquals(Int64.zero, FungibleTokenErrors.unbalancedTransaction)
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
