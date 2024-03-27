/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { PublicKey, UInt64,
  type State,
  Struct,
  UInt8,
} from 'o1js';


class MintData extends Struct({
  methodId: UInt8,
  addressTo: PublicKey,
  amount: UInt64
}) {}

class BurnData extends Struct({
  methodId: UInt8,
  addressFrom: PublicKey,
  amount: UInt64
}) {}

interface Mintable {
  totalSupply: State<UInt64>;
  circulatingSupply: State<UInt64>;
  mint: (to: PublicKey, amount: UInt64) => MintData;
  setTotalSupply: (amount: UInt64) => void;
}

interface Burnable {
  burn: (from: PublicKey, amount: UInt64) => BurnData;
}

export { type Mintable, type Burnable, MintData, BurnData };
