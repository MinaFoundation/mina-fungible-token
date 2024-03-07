/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { Bool } from 'o1js';

import type { AdminAction } from '../token/adminable';
import type { TransferFromToOptions } from '../token/transferable';

interface Hooks {
  canAdmin: (action: AdminAction) => Bool;
  //canTransfer: ({ from, to, amount }: TransferFromToOptions) => Bool;
}

export default Hooks;
