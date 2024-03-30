import { PrivateKey, PublicKey } from "o1js"

export async function testAccounts<N extends number>(
  count: N,
): Promise<ArrayOfLength<TestAccount, N>> {
  const testAccountsPending: Promise<TestAccount>[] = []
  for (let i = 0; i < count; i++) {
    testAccountsPending.push((async () => {
      const { pk, sk } = await fetch("http://localhost:8181/acquire-account?unlockedAccount=true")
        .then((v) => v.json())
      return {
        publicKey: PublicKey.fromBase58(pk),
        privateKey: PrivateKey.fromBase58(sk),
      }
    })())
  }
  return Promise.all(testAccountsPending) as any
}

export type TestAccount = {
  publicKey: PublicKey
  privateKey: PrivateKey
}

type ArrayOfLength<T, L extends number, A extends T[] = []> = number extends L ? T[]
  : L extends A["length"] ? A
  : ArrayOfLength<T, L, [...A, T]>
