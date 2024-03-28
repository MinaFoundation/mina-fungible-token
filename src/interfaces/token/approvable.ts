import { AccountUpdate, AccountUpdateForest, AccountUpdateTree } from 'o1js';

interface Approvable {
  approveBase(forest: AccountUpdateForest): void;
  approveAccountUpdate(accountUpdate: AccountUpdate | AccountUpdateTree): void;
  approveAccountUpdates(accountUpdates: (AccountUpdate | AccountUpdateTree)[]): void;
}

export type { Approvable };
