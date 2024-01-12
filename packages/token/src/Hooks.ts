/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable new-cap */
import {
  Bool,
  PublicKey,
  State,
  state,
  SmartContract,
  method,
  AccountUpdate,
} from 'o1js';

import type _Hooks from './interfaces/hookHandler/hooks';
import { AdminAction } from './interfaces/token/adminable';
import type { ViewableOptions } from './interfaces/token/viewable';
import { TransferFromToOptions } from './interfaces/token/transferable';

class Hooks extends SmartContract implements _Hooks {
  public static defaultViewableOptions: ViewableOptions = {
    preconditions: { shouldAssertEquals: true },
  };

  @state(PublicKey) public admin = State<PublicKey>();

  @method public initialize(admin: PublicKey) {
    super.init();
    this.admin.getAndAssertEquals();
    this.admin.set(admin);
  }

  public getAdmin(
    { preconditions }: ViewableOptions = Hooks.defaultViewableOptions
  ): PublicKey {
    const admin = this.admin.get();

    if (preconditions.shouldAssertEquals) {
      this.admin.assertEquals(admin);
    }

    return admin;
  }

  @method
  public canAdmin(action: AdminAction): Bool {
    const admin = this.admin.get();
    this.admin.assertEquals(admin);

    //  If you want to disallow some AdminActions, you can do
    //  that via an assert statement like this:
    //const actionPossible = action.type
    //  .equals(AdminAction.types.setPaused)
    //  .equals(Bool(false));
    //actionPossible.assertTrue();
    //  This would check that the action is not setPaused,
    //  and thus disallow pausing/unpausing token transfers.

    // If you want to allow any AdminAction, unconditioanlly return true.
    const actionPossible = Bool(true);

    // Require a signature from the admin
    const adminAccountUpdate = AccountUpdate.create(admin);
    adminAccountUpdate.requireSignature();

    return actionPossible;
  }
}

export default Hooks;
