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

class Hooks extends SmartContract implements _Hooks {

  @state(PublicKey) public admin = State<PublicKey>();

  @method public initialize(admin: PublicKey) {
    super.init();
    this.admin.getAndRequireEquals();
    this.admin.set(admin);
  }

  public getAdmin(): PublicKey {
    const admin = this.admin.get();
    this.admin.requireEquals(admin);

    return admin;
  }

  @method
  public canAdmin(action: AdminAction): Bool {
    const admin = this.admin.get();
    this.admin.requireEquals(admin);

    const adminAccountUpdate = AccountUpdate.create(admin);
    adminAccountUpdate.requireSignature();

    return Bool(true);
  }
}

export default Hooks;
