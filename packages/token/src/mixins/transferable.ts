/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { SmartContract, method, PublicKey, UInt64, Circuit } from 'snarkyjs';
import { shareSnarkyMetadata } from '../utils.js';

interface Transferable {
  transfer: (from: PublicKey, to: PublicKey, amount: UInt64) => void;
}

type Constructor = new (...args: any[]) => SmartContract;
function transferable<BaseClass extends Constructor>(
  base: BaseClass
): BaseClass & {
  new (...args: any[]): Transferable;
  prototype: Transferable;
} {
  class Transfers extends base implements Transferable {
    @method
    public transfer(from: PublicKey, to: PublicKey, amount: UInt64) {
      this.token.send({
        from,
        to,
        amount,
      });
    }
  }

  return shareSnarkyMetadata(Transfers, base);
}

export type { Transferable };
export default transferable;
