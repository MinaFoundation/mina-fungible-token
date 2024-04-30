import { PrivateKey, PublicKey } from "o1js"
import { TestPublicKey } from "o1js/dist/node/lib/mina/local-blockchain"

export type TestAccount = {
  publicKey: PublicKey
  privateKey: PrivateKey
}

export type TestPublicKeys = ArrayOfLength<TestPublicKey, 10>

type ArrayOfLength<T, L extends number, A extends T[] = []> = number extends L ? T[]
  : L extends A["length"] ? A
  : ArrayOfLength<T, L, [...A, T]>
