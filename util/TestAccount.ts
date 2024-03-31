import type { PrivateKey, PublicKey } from "o1js"

export type TestAccount = {
  publicKey: PublicKey
  privateKey: PrivateKey
}

export type TestAccounts = ArrayOfLength<TestAccount, 10>

type ArrayOfLength<T, L extends number, A extends T[] = []> = number extends L ? T[]
  : L extends A["length"] ? A
  : ArrayOfLength<T, L, [...A, T]>
