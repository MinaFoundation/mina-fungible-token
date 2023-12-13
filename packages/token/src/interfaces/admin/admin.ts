/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { Bool } from 'o1js';

import type { AdminAction } from '../token/adminable.js';

interface Admin {
  canAdmin: (action: AdminAction) => Bool;
}

export default Admin;
