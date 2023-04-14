/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { Bool } from 'snarkyjs';

import type { AdminAction } from '../token/adminable.js';
import type { TransferFromToOptions } from '../token/transferable.js';

interface Hooks {
  canAdmin: (action: AdminAction) => Bool;
  canTransfer: ({ from, to, amount }: TransferFromToOptions) => Bool;
}

export default Hooks;
