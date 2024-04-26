import {
  AccountUpdate,
  Bool,
  DeployArgs,
  method,
  PublicKey,
  SmartContract,
  State,
  state,
} from "o1js"
import { AdminAction } from "./AdminAction.js"

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
export class FungibleTokenAdmin extends SmartContract {
  @state(PublicKey)
  private adminPublicKey = State<PublicKey>()

  async deploy(props: FungibleTokenAdminDeployProps) {
    await super.deploy(props)
    this.adminPublicKey.set(props.adminPublicKey)
  }

  @method.returns(Bool)
  public async canAdmin(action: AdminAction): Promise<Bool> {
    // require signature from the admin
    const admin = this.adminPublicKey.getAndRequireEquals()
    AccountUpdate.createSigned(admin)
    // if you want to further restrict certain actions, do so below
    return (Bool(true))
  }
}
