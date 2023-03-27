/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable putout/putout */
/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { PublicKey, SmartContract, UInt64, method } from 'snarkyjs';
import { shareSnarkyMetadata } from '../utils.js';

// TODO: find out why can't we re-use and export this type?
type SmartContractConstructor = new (...args: any[]) => SmartContract;

interface Mintable {
  mint: (to: PublicKey, amount: UInt64) => void;
}

function mintable<BaseClass extends SmartContractConstructor>(
  base: BaseClass
): BaseClass & {
  new (...args: any[]): Mintable;
  prototype: Mintable;
} {
  class Mint extends base implements Mintable {
    @method
    public mint(to: PublicKey, amount: UInt64) {
      this.token.mint({ address: to, amount });
    }
  }

  return shareSnarkyMetadata(Mint, base);
}

interface Burnable {
  burn: (from: PublicKey, amount: UInt64) => void;
}

function burnable<BaseClass extends SmartContractConstructor>(
  base: BaseClass
): BaseClass & {
  new (...args: any[]): Burnable;
  prototype: Burnable;
} {
  class Burn extends base implements Burnable {
    @method
    public burn(from: PublicKey, amount: UInt64) {
      this.token.burn({ address: from, amount });
    }
  }

  return shareSnarkyMetadata(Burn, base);
}

export type { Mintable, Burnable };
export { mintable, burnable };
