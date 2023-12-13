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

import type _Hooks from './interfaces/hookHandler/hooks.js';
import { AdminAction } from './interfaces/token/adminable.js';
import type { ViewableOptions } from './interfaces/token/viewable.js';
import { TransferFromToOptions } from './interfaces/token/transferable.js';

class Hooks extends SmartContract implements _Hooks {
  public static defaultViewableOptions: ViewableOptions = {
    preconditions: { shouldAssertEquals: true },
  };

  @state(PublicKey) public admin = State<PublicKey>();

  @method
  public initialize(admin: PublicKey) {
    const provedState = this.account.provedState.get();
    this.account.provedState.assertEquals(provedState);
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

    // example of disabling `setPaused`
    const actionPossible = action.type
      .equals(AdminAction.types.setPaused)
      .equals(Bool(false));

    actionPossible.assertTrue();

    const adminAccountUpdate = AccountUpdate.create(admin);
    adminAccountUpdate.requireSignature();

    return actionPossible;
  }
}

export default Hooks;
