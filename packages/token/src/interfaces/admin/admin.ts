/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { Bool } from 'o1js';

import type { AdminAction } from '../token/adminable';

interface Admin {
  /**
   * Check whether you have permission to perform a given {@link AdminAction}.
   *
   * @param action
   * @returns A {@link Bool} which is `true` iff you have the right to
   *   perform `action`.
   */
  canAdmin: (action: AdminAction) => Bool;
}

export default Admin;
