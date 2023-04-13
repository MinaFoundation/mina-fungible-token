/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { AccountUpdate, UInt64 } from 'snarkyjs';

interface Depositable {
  deposit: (amount: UInt64) => AccountUpdate;
}

export default Depositable;
