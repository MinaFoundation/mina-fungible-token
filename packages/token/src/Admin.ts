/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable new-cap */
import {
  AccountUpdate,
  Bool,
  PublicKey,
  SmartContract,
  State,
  method,
  state,
} from 'snarkyjs';

import { AdminAction } from './interfaces/token/adminable.js';
import type _Admin from './interfaces/admin/admin.js';

class Admin extends SmartContract implements _Admin {
  @state(PublicKey) public admin = State<PublicKey>();

  @method
  public canAdmin(action: AdminAction) {
    const admin = this.admin.get();
    this.admin.assertEquals(admin);

    // example of disabling `setPaused`
    const actionPossible = action.type
      .equals(AdminAction.types.setPaused)
      .equals(Bool(false));

    actionPossible.assertTrue();

    const adminAccountUpdate = AccountUpdate.create(admin);
    adminAccountUpdate.requireSignature();
  }
}

export default Admin;
