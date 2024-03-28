import {
  type PublicKey,
  type UInt64,
  type AccountUpdate,
  type State,
} from 'o1js';

interface Mintable {
  totalSupply: State<UInt64>;
  circulatingSupply: State<UInt64>;
  mint: (to: PublicKey, amount: UInt64) => AccountUpdate;
  setTotalSupply: (amount: UInt64) => void;
}

export type { Mintable };
