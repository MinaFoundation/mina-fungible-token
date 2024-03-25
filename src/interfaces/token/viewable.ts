/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { PublicKey, UInt64 } from 'o1js';

interface Viewable {
  getBalanceOf: (address: PublicKey) => UInt64;
  getTotalSupply: () => UInt64;
  getCirculatingSupply: () => UInt64;
  getDecimals: () => UInt64;
}

export default Viewable;
