/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable new-cap */
import { Account, type PublicKey, type UInt64 } from 'snarkyjs';

import {
  type SmartContractConstructor,
  shareSnarkyMetadata,
} from '../utils.js';

interface Viewable {
  balanceOf: (address: PublicKey) => UInt64;
}

function viewable<BaseClass extends SmartContractConstructor>(
  base: BaseClass
): BaseClass & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): Viewable;
  prototype: Viewable;
} {
  class Views extends base implements Viewable {
    public balanceOf(address: PublicKey): UInt64 {
      const account = Account(address, this.token.id);
      const balance = account.balance.get();

      // create a precondition, to cover a case where the
      // return balance is consumed in another contract
      account.balance.assertEquals(balance);

      return balance;
    }
  }

  return shareSnarkyMetadata(Views, base);
}

export type { Viewable };
export default viewable;
