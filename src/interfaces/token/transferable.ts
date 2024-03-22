/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { PublicKey, UInt64, AccountUpdate } from 'o1js';

interface Transferable {
    transfer(from: PublicKey | AccountUpdate,
             to: PublicKey | AccountUpdate,
             amount: UInt64): void;
    }

export {Transferable};
