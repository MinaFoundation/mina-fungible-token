/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import {
  AccountUpdate,
  Bool,
  Circuit,
  Experimental,
  Int64,
  method,
  Permissions,
  PublicKey,
  SmartContract,
  UInt64,
  VerificationKey,
} from 'snarkyjs';
import { shareSnarkyMetadata } from '../utils.js';

type SmartContractConstructor = new (...args: any[]) => SmartContract;

interface Approvable {
  approveCallback: (callback: Experimental.Callback<unknown>) => void;
  approveAccountUpdate: (accountUpdate: AccountUpdate) => void;
}

function approvable<BaseClass extends SmartContractConstructor>(
  base: BaseClass
): BaseClass & {
  new(...args: any[]): Approvable;
  prototype: Approvable;
} {
  class Approvals extends base implements Approvable {
    public hasNoBalanceChange(accountUpdate: AccountUpdate): Bool {
      // all balance changes of children
      const balanceChanges = accountUpdate.children.accountUpdates.map(
        ({ body: { balanceChange } }) => balanceChange
      );

      // add the self balance change
      balanceChanges.push(accountUpdate.body.balanceChange);

      const balanceChange = balanceChanges.reduce(
        (accumulatedBalanceChange, currentBalanceChange) =>
          Int64.fromObject(accumulatedBalanceChange).add(
            Int64.fromObject(currentBalanceChange)
          ),
        Int64.zero
      );

      return Int64.fromObject(balanceChange).equals(UInt64.zero);
    }

    public assertHasNoBalanceChange(accountUpdate: AccountUpdate) {
      this.hasNoBalanceChange(accountUpdate).assertTrue(
        'Account update has a non-zero balance change'
      );
    }

    @method
    public approveCallback(callback: Experimental.Callback<unknown>) {
      const approvedAccountUpdate = this.approve(
        callback,
        AccountUpdate.Layout.AnyChildren
      );
      this.assertHasNoBalanceChange(approvedAccountUpdate);
    }

    @method
    public approveAccountUpdate(accountUpdate: AccountUpdate) {
      const approvedAccountUpdate = this.approve(
        accountUpdate,

        // We can start working with static children during prove
        // once this is fixed:
        // https://github.com/o1-labs/snarkyjs/issues/706
        // AccountUpdate.Layout.StaticChildren(AccountUpdate.Layout.NoChildren)
        AccountUpdate.Layout.AnyChildren
      );
      //this.assertHasNoBalanceChange(approvedAccountUpdate);
    }
  }

  return shareSnarkyMetadata(Approvals, base);
}

export type { Approvable };
export default approvable;
