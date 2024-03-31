import { PrivateKey, PublicKey } from "o1js"

export const lightnetConfig = {
  mina: "http://localhost:8080/graphql",
  archive: "http://localhost:8282",
  lightnetAccountManager: "http://localhost:8181",
}

export type TestAccount = {
  publicKey: PublicKey
  privateKey: PrivateKey
}
