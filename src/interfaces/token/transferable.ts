/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { PublicKey, UInt64, AccountUpdate, Struct } from 'o1js';

type MayUseToken =
  | typeof AccountUpdate.MayUseToken.InheritFromParent
  | typeof AccountUpdate.MayUseToken.ParentsOwnToken;

interface TransferOptions {
  from?: PublicKey;
  to?: PublicKey;
  amount: UInt64;
  mayUseToken?: MayUseToken;
}

class TransferFromToOptions extends Struct({
  from: PublicKey,
  to: PublicKey,
  amount: UInt64,
}) {}

type FromTransferReturn = [AccountUpdate, undefined];
type ToTransferReturn = [undefined, AccountUpdate];
type FromToTransferReturn = [AccountUpdate, AccountUpdate];
type TransferReturn =
  | FromToTransferReturn
  | FromTransferReturn
  | ToTransferReturn;

interface Transferable {
  transferFromTo: (options: TransferFromToOptions) => FromToTransferReturn;
  transfer: (options: TransferOptions) => TransferReturn;
  transferFrom: (
    from: PublicKey,
    amount: UInt64,
    mayUseToken: MayUseToken
  ) => FromTransferReturn;
  transferTo: (
    to: PublicKey,
    amount: UInt64,
    mayUseToken: MayUseToken
  ) => ToTransferReturn;
}

export default Transferable;
export { TransferFromToOptions };
export type {
  TransferOptions,
  TransferReturn,
  FromTransferReturn,
  ToTransferReturn,
  FromToTransferReturn,
  MayUseToken,
};
