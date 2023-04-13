/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { PublicKey, Account, UInt64, Bool } from 'snarkyjs';

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
  getAdmin: (options: ViewableOptions) => PublicKey;
  getDecimals: () => UInt64;
  getPaused: (options: ViewableOptions) => Bool;
}

export default Viewable;
export type { ViewableOptions };
