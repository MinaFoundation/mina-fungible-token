import {
  AccountUpdate,
  assert,
  Bool,
  DeployArgs,
  method,
  Provable,
  PublicKey,
  SmartContract,
  State,
  state,
} from "o1js"

export type FungibleTokenAdminBase = SmartContract & {
  canMint(accountUpdate: AccountUpdate): Promise<Bool>
  canChangeAdmin(admin: PublicKey): Promise<Bool>
  canPause(): Promise<Bool>
  canResume(): Promise<Bool>
}

export interface FungibleTokenAdminDeployProps extends Exclude<DeployArgs, undefined> {
  adminPublicKey: PublicKey
}

/** A contract that grants permissions for administrative actions on a token.
 *
 * We separate this out into a dedicated contract. That way, when issuing a token, a user can
 * specify their own rules for administrative actions, without changing the token contract itself.
 *
 * The advantage is that third party applications that only use the token in a non-privileged way
 * can integrate against the unchanged token contract.
 */
export class FungibleTokenAdmin extends SmartContract implements FungibleTokenAdminBase {
  @state(PublicKey)
  private adminPublicKey = State<PublicKey>()

  async deploy(props: FungibleTokenAdminDeployProps) {
    await super.deploy(props)
    this.adminPublicKey.set(props.adminPublicKey)
  }

  private async ensureAdminSignature() {
    const admin = await Provable.witnessAsync(PublicKey, async () => {
      let pk = await this.adminPublicKey.fetch()
      assert(pk !== undefined, "could not fetch admin public key")
      return pk
    })
    this.adminPublicKey.requireEquals(admin)
    return AccountUpdate.createSigned(admin)
  }

  @method.returns(Bool)
  public async canMint(_accountUpdate: AccountUpdate) {
    await this.ensureAdminSignature()
    return Bool(true)
  }

  @method.returns(Bool)
  public async canChangeAdmin(_admin: PublicKey) {
    await this.ensureAdminSignature()
    return Bool(true)
  }

  @method.returns(Bool)
  public async canPause(): Promise<Bool> {
    await this.ensureAdminSignature()
    return Bool(true)
  }

  @method.returns(Bool)
  public async canResume(): Promise<Bool> {
    await this.ensureAdminSignature()
    return Bool(true)
  }
}
