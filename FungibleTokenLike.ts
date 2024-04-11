import type { AccountUpdate, AccountUpdateForest, AccountUpdateTree, PublicKey, UInt64 } from "o1js"

/** A collection of methods of methods which make an object _like_ a Mina fungible token. */
export interface FungibleTokenLike {
  /** Get the balance of the current token for a given public key. */
  getBalanceOf(address: PublicKey): Promise<UInt64>
  /** Get the maximum supply of the current token. */
  getSupply(): Promise<UInt64>
  /** Get the amount circulating of the current token. */
  getCirculating(): Promise<UInt64>
  /** Get the number of decimals used in representing the current token. */
  getDecimals(): Promise<UInt64>
  /**
   * Move a specified amount of tokens between two accounts.
   * @param from the public key of the account from which the tokens should be sent.
   * @param to the public key of the account to which the tokens should be sent.
   * @param amount the amount of tokens to send.
   */
  transfer(
    from: PublicKey | AccountUpdate,
    to: PublicKey | AccountUpdate,
    amount: UInt64,
  ): Promise<void>
  /**
   * Make a specified amount of tokens forever inaccessible, thereby reducing the circulating supply.
   * @param from the public key of the account from which the tokens should be burned.
   * @param amount the amount of tokens to burn.
   */
  burn(from: PublicKey, amount: UInt64): Promise<AccountUpdate>
  /**
   * Create a specified amount of the current token.
   * @param to the public key of the recipient account of the newly minted tokens.
   * @param amount the amount of new tokens to create.
   */
  mint(to: PublicKey, amount: UInt64): Promise<AccountUpdate>
  /**
   * Set the new supply, effectively changing a possible amount to be minted. Cannot be changed to an amount less than circulating.
   * @param amount the new supply to set.
   */
  setSupply(amount: UInt64): Promise<void>
  /**
   * Approves all account updates in the forest if the sum of total balance change in the account update forest is zero.
   * @param updates the forest containing the account updates.
   */
  approveBase(updates: AccountUpdateForest): Promise<void>
  /**
   * Approves a list of account updates (with arbitrarily many children).
   * @param updates the account update or updates.
   */
  approveAccountUpdates(updates: (AccountUpdate | AccountUpdateTree)[]): void
}
