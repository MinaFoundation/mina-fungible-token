import { AccountUpdate, PublicKey, UInt64 } from "o1js";

interface Burnable {
    burn: (from: PublicKey, amount: UInt64) => AccountUpdate;
}

export type { Burnable };
