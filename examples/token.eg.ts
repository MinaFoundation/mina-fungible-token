/**
 * This file contains parameters for an example token
 */
import { FungibleToken } from "FungibleToken.js"
import { Mina } from "o1js"

export { token, tokenAccount, tokenId }

let tokenAccount = Mina.TestPublicKey.random()
let token = new FungibleToken(tokenAccount)
let tokenId = token.deriveTokenId()
