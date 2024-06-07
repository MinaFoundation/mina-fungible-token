/**
 * Example implementation of a token airdrop that allows concurrent withdrawals.
 */
import {
  AccountUpdate,
  AccountUpdateForest,
  AccountUpdateTree,
  Bool,
  Experimental,
  Field,
  method,
  Poseidon,
  Provable,
  PublicKey,
  SmartContract,
  State,
  state,
  Struct,
  UInt64,
} from "o1js"
import { newTestPublicKeys } from "test_util"
import { token, tokenId } from "./token.eg"
const { IndexedMerkleMap, BatchReducer } = Experimental

class MerkleMap extends IndexedMerkleMap(10) {}

// a couple of test accounts
const accounts = newTestPublicKeys(20)

// create a map of eligible accounts
const eligible = createEligibleMap(accounts)

/**
 * An action to claim your airdrop.
 */
class Claim extends Struct({ account: PublicKey, amount: UInt64 }) {}

// set up reducer
let batchReducer = new BatchReducer({ actionType: Claim, batchSize: 5 })
class ActionBatchProof extends batchReducer.Proof {}

/**
 * Contract that manages airdrop claims.
 */
class Airdrop extends SmartContract {
  @state(Field)
  eligibleRoot = State(eligible.root)

  @state(Field)
  actionState = State(BatchReducer.initialActionState)

  @method
  async claim(amount: UInt64) {
    let account = this.sender.getUnconstrained()

    // ensure that the token account already exists and that the sender knows its private key
    let au = AccountUpdate.createSigned(account, tokenId)
    au.body.useFullCommitment = Bool(true) // ensures the signature attests to the entire transaction

    batchReducer.dispatch(new Claim({ account, amount }))
  }

  @method.returns(MerkleMap.provable)
  async settleClaims(proof: ActionBatchProof) {
    // fetch merkle map and assert that it matches the onchain root
    let root = this.eligibleRoot.getAndRequireEquals()
    let eligible = await Provable.witnessAsync(MerkleMap.provable, fetchEligibleMap)
    eligible.root.assertEquals(root)

    let accountUpdates = AccountUpdateForest.empty()

    // process claims by reducing actions
    batchReducer.processNextBatch(proof, (claim) => {
      // check whether the claim is valid = exactly contained in the map
      let accountKey = key(claim.account)
      let amountOption = eligible.getOption(accountKey)
      let amount = UInt64.Unsafe.fromField(amountOption.orElse(0n)) // not unsafe, because only uint64s can be claimed
      let isValid = amountOption.isSome.and(amount.equals(claim.amount))

      // if the claim is valid, set the amount in the map to zero
      eligible.setIf(isValid, accountKey, 0n)

      // if the claim is valid, add a token account update to our forest of approved updates
      let update = AccountUpdate.default(claim.account, tokenId)
      update.balance.addInPlace(amount)
      this.balance.subInPlace(amount) // this is 0 if the claim is invalid
      accountUpdates.pushIf(isValid, AccountUpdateTree.from(update))
    })

    // approve the created account updates
    token.approveBase(accountUpdates)

    // update the onchain root and action state pointer
    this.eligibleRoot.set(eligible.root)

    // return the updated eligible map
    return eligible
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
