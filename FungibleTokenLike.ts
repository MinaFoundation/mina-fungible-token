import type { AccountUpdate, AccountUpdateForest, AccountUpdateTree, PublicKey, UInt64 } from "o1js"

// TODO: comments
export interface FungibleTokenLike {
  getBalanceOf(address: PublicKey): UInt64
  getTotalSupply(): UInt64
  getCirculatingSupply(): UInt64
  getDecimals(): UInt64
  transfer(from: PublicKey | AccountUpdate, to: PublicKey | AccountUpdate, amount: UInt64): void
  burn(from: PublicKey, amount: UInt64): AccountUpdate
  mint(to: PublicKey, amount: UInt64): AccountUpdate
  setTotalSupply(amount: UInt64): void
  approveBase(forest: AccountUpdateForest): void
  approveAccountUpdate(accountUpdate: AccountUpdate | AccountUpdateTree): void
  approveAccountUpdates(accountUpdates: (AccountUpdate | AccountUpdateTree)[]): void
}
