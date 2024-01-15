/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import {
  type PublicKey,
  type UInt64,
  type AccountUpdate,
  type State,
  Struct,
  Field,
  Bool,
  VerificationKey,
} from 'o1js';

class AdminAction extends Struct({
  type: Field,
}) {
  public static types = {
    mint: 0,
    burn: 1,
    setTotalSupply: 2,
    setPaused: 3,
    setVerificationKey: 4,
  };

  public static fromType(type: number): AdminAction {
    return new AdminAction({ type: Field(type) });
  }
}

interface Mintable {
  totalSupply: State<UInt64>;
  circulatingSupply: State<UInt64>;
  mint: (to: PublicKey, amount: UInt64) => AccountUpdate;
  setTotalSupply: (amount: UInt64) => void;
}

interface Burnable {
  burn: (from: PublicKey, amount: UInt64) => AccountUpdate;
}

interface Pausable {
  paused: State<Bool>;
  setPaused: (paused: Bool) => void;
}

interface Upgradable {
  setVerificationKey: (verificationKey: VerificationKey) => void;
}

export type { Mintable, Burnable, Pausable, Upgradable };
export { AdminAction };
