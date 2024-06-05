/**
 * This file contains parameters for an example token
 */
import { FungibleToken } from "FungibleToken.js"
import { newTestPublicKey } from "../test_util.js"

export { token, tokenAccount, tokenId }

let tokenAccount = newTestPublicKey()
let token = new FungibleToken(tokenAccount)
let tokenId = token.deriveTokenId()
