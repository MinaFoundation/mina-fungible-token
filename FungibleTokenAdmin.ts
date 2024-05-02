import {
  AccountUpdate,
  Bool,
  DeployArgs,
  method,
  PublicKey,
  SmartContract,
  State,
  state,
  UInt64,
} from "o1js"

export type FungibleTokenAdminBase = SmartContract & {
  canMint(accountUpdate: AccountUpdate): Promise<Bool>
  canChangeAdmin(admin: PublicKey): Promise<Bool>
  canSetSupply(supply: UInt64): Promise<Bool>
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

  private ensureAdminSignature() {
    const admin = this.adminPublicKey.getAndRequireEquals()
    return AccountUpdate.createSigned(admin)
  }

  @method.returns(Bool)
  public async canMint(_accountUpdate: AccountUpdate) {
    this.ensureAdminSignature()
    return Bool(true)
  }

  @method.returns(Bool)
  public async canChangeAdmin(_admin: PublicKey) {
    this.ensureAdminSignature()
    return Bool(true)
  }

  @method.returns(Bool)
  public async canSetSupply(_supply: UInt64) {
    this.ensureAdminSignature()
    return Bool(true)
  }
}
