/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { AccountUpdate, UInt64 } from 'o1js';

interface Withdrawable {
  withdraw: (amount: UInt64) => AccountUpdate;
}

export default Withdrawable;
