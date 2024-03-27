import { PublicKey, UInt64, AccountUpdate, Struct, UInt8 } from 'o1js';


class TransferData extends Struct({
    methodId: UInt8,
    addressFrom: PublicKey,
    addressTo: PublicKey,
    amount: UInt64
  }) {}

interface Transferable {
    transfer(from: PublicKey | AccountUpdate,
             to: PublicKey | AccountUpdate,
             amount: UInt64): TransferData;
    }

export { type Transferable, TransferData };
