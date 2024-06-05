/**
 * Example implementation of a token airdrop that allows concurrent withdrawals.
 */
import { Experimental, Field, method, Poseidon, PublicKey, SmartContract, State, state } from "o1js"
import { newTestPublicKeys } from "test_util"

class MerkleMap extends Experimental.IndexedMerkleMap(10) {}

// a couple of test accounts
const accounts = newTestPublicKeys(20)

// create a map of eligible accounts
const eligible = createEligibleMap(accounts)

/**
 * Contract that manages airdrop claims.
 */
class Airdrop extends SmartContract {
  @state(Field)
  eligibleRoot = State(eligible.root)

  @method
  async claim() {
  }
}

/**
 * Helper function to create a map of eligible accounts.
 */
function createEligibleMap(accounts: PublicKey[]) {
  // predefined MerkleMap of eligible accounts
  const eligible = new MerkleMap()

  // every account gets 100 tokens
  accounts.forEach((account) => eligible.insert(key(account), 100n))

  return eligible
}

/**
 * How to map an address to a map key.
 */
function key(address: PublicKey) {
  return Poseidon.hashPacked(PublicKey, address)
}

/**
 * Mock for fetching the (partial) Merkle Map from a service endpoint.
 */
async function fetchEligibleMap() {
  return eligible
}
