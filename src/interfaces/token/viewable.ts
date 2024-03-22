/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { PublicKey, Account, UInt64 } from 'o1js';

interface Viewable {
  // eslint-disable-next-line no-warning-comments
  // TODO: is there a better return type for `Account`?
  getAccountOf: (address: PublicKey) => ReturnType<typeof Account>;
  getBalanceOf: (address: PublicKey) => UInt64;
  getTotalSupply: () => UInt64;
  getCirculatingSupply: () => UInt64;
  getDecimals: () => UInt64;
}

export default Viewable;
