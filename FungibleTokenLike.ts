import type { AccountUpdate, AccountUpdateForest, AccountUpdateTree, PublicKey, UInt64 } from "o1js"

export interface FungibleTokenLike {
  getBalanceOf(address: PublicKey): UInt64
  getSupply(): UInt64
  getCirculating(): UInt64
  getDecimals(): UInt64
  transfer(from: PublicKey | AccountUpdate, to: PublicKey | AccountUpdate, amount: UInt64): void
  burn(from: PublicKey, amount: UInt64): AccountUpdate
  mint(to: PublicKey, amount: UInt64): AccountUpdate
  setSupply(amount: UInt64): void
  approveBase(forest: AccountUpdateForest): void
  approveAccountUpdate(accountUpdate: AccountUpdate | AccountUpdateTree): void
  approveAccountUpdates(accountUpdates: (AccountUpdate | AccountUpdateTree)[]): void
}
