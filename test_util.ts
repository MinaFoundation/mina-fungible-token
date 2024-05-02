import { PrivateKey, PublicKey } from "o1js"
import { TestPublicKey } from "o1js/dist/node/lib/mina/local-blockchain"

/** Creates a {@link TestPublicKey} that does not have an account on the chain yet.
 * This is used for non-min accounts
 */
export function newTestPublicKey(): TestPublicKey {
  const keyPair = PrivateKey.randomKeypair()
  let pubKey = keyPair.publicKey as TestPublicKey
  pubKey.key = keyPair.privateKey
  return pubKey
}

export type TestPublicKeys = ArrayOfLength<TestPublicKey, 10>

type ArrayOfLength<T, L extends number, A extends T[] = []> = number extends L ? T[]
  : L extends A["length"] ? A
  : ArrayOfLength<T, L, [...A, T]>
