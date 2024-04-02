import type { AccountUpdate, AccountUpdateForest, AccountUpdateTree, PublicKey, UInt64 } from "o1js"

/** A collection of methods of methods which make an object _like_ a Mina fungible token. */
export interface FungibleTokenLike {
  /** Get the balance of the current token for a given public key. */
  getBalanceOf(address: PublicKey): UInt64
  /** Get the maximum supply of the current token. */
  getSupply(): UInt64
  /** Get the amount circulating of the current token. */
  getCirculating(): UInt64
  /** Get the number of decimals used in representing the current token. */
  getDecimals(): UInt64
  /**
   * Move a specified amount of tokens between two accounts.
   * @param from the public key of the account from which the tokens should be sent.
   * @param to the public key of the account to which the tokens should be sent.
   * @param amount the amount of tokens to send.
   */
  transfer(from: PublicKey | AccountUpdate, to: PublicKey | AccountUpdate, amount: UInt64): void
  /**
   * Make a specified amount of tokens forever inaccessible, thereby reducing the circulating supply.
   * @param from the public key of the account from which the tokens should be burned.
   * @param amount the amount of tokens to burn.
   */
  burn(from: PublicKey, amount: UInt64): AccountUpdate
  /**
   * Create a specified amount of the current token.
   * @param to the public key of the recipient account of the newly minted tokens.
   * @param amount the amount of new tokens to create.
   */
  mint(to: PublicKey, amount: UInt64): AccountUpdate
  /**
   * Set the new supply, effectively changing a possible amount to be minted. Cannot be changed to an amount less than circulating.
   * @param amount the new supply to set.
   */
  setSupply(amount: UInt64): void
  /**
   * Approves all account updates in the forest if the sum of total balance change in the account update forest is zero.
   * @param updates the forest containing the account updates.
   */
  approveBase(updates: AccountUpdateForest): void
  /**
   * Approves a single account update (with arbitrarily many children).
   * @param updates the account update or updates.
   */
  approveAccountUpdate(updates: AccountUpdate | AccountUpdateTree): void
  /**
   * Approves a list of account updates (with arbitrarily many children).
   * @param updates the account update or updates.
   */
  approveAccountUpdates(updates: (AccountUpdate | AccountUpdateTree)[]): void
}
