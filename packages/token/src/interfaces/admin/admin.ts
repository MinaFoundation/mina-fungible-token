/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { AdminAction } from '../token/adminable.js';

interface Admin {
  canAdmin: (action: AdminAction) => void;
}

export default Admin;
