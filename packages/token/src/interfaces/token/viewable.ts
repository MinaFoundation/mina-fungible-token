/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { PublicKey, Account, UInt64, Bool } from 'o1js';

interface ViewableOptions {
  preconditions: {
    shouldAssertEquals: boolean;
  };
}

interface Viewable {
  // eslint-disable-next-line no-warning-comments
  // TODO: is there a better return type for `Account`?
  getAccountOf: (address: PublicKey) => ReturnType<typeof Account>;
  getBalanceOf: (address: PublicKey, options: ViewableOptions) => UInt64;
  getTotalSupply: (options: ViewableOptions) => UInt64;
  getCirculatingSupply: (options: ViewableOptions) => UInt64;
  getDecimals: () => UInt64;
  getPaused: (options: ViewableOptions) => Bool;
  getHooks: (options: ViewableOptions) => PublicKey;
}

export default Viewable;
export type { ViewableOptions };
