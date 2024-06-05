import { Mina, PrivateKey } from "o1js"

/** Creates a {@link TestPublicKey} that does not have an account on the chain yet.
 * This is used for non-min accounts
 */
export function newTestPublicKey(): Mina.TestPublicKey {
  const keyPair = PrivateKey.randomKeypair()
  let pubKey = keyPair.publicKey as Mina.TestPublicKey
  pubKey.key = keyPair.privateKey
  return pubKey
}
