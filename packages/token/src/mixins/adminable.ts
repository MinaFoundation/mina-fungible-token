/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable putout/putout */
/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import {
  Field,
  PublicKey,
  SmartContract,
  Struct,
  UInt64,
  method,
} from 'snarkyjs';
import { SmartContractConstructor, shareSnarkyMetadata } from '../utils.js';

interface Mintable {
  mint: (to: PublicKey, amount: UInt64) => void;
}

class AdminState extends Struct({
  admin: Field,
}) {}

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

  Mint.state = AdminState;

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
