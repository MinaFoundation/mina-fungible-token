/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable new-cap */
import { Account, type PublicKey, SmartContract, type UInt64 } from 'snarkyjs';
import { shareSnarkyMetadata } from '../utils.js';

type SmartContractConstructor = new (...args: any[]) => SmartContract;

interface Viewable {
  balanceOf: (account: PublicKey) => UInt64;
}

function viewable<BaseClass extends SmartContractConstructor>(
  base: BaseClass
): BaseClass & {
  new (...args: any[]): Viewable;
  prototype: Viewable;
} {
  class Views extends base implements Viewable {
    public balanceOf(account: PublicKey) {
      return Account(account, this.token.id).balance.get();
    }
  }

  return shareSnarkyMetadata(Views, base);
}

export type { Viewable };
export default viewable;
