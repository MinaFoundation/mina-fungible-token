import {
  Account,
  AccountUpdate,
  AccountUpdateForest,
  DeployArgs,
  method,
  PublicKey,
  State,
  state,
  TokenContract,
  UInt64,
} from "o1js"
import type { FungibleTokenLike } from "./FungibleTokenLike"

export interface FungibleTokenDeployProps extends Exclude<DeployArgs, undefined> {
  adminPublicKey: PublicKey
  totalSupply: UInt64
  tokenSymbol: string
  zkAppURI: string
}

export class FungibleToken extends TokenContract implements FungibleTokenLike {
  @state(PublicKey)
  adminAccount = State<PublicKey>()
  @state(UInt64)
  totalSupply = State<UInt64>()
  @state(UInt64)
  circulatingSupply = State<UInt64>()

  decimals = UInt64.from(9)

  deploy(props: FungibleTokenDeployProps): void {
    super.deploy(props)
    this.adminAccount.set(props.adminPublicKey)
    this.totalSupply.set(props.totalSupply)
    this.circulatingSupply.set(UInt64.from(0))
    this.account.tokenSymbol.set(props.tokenSymbol)
    this.account.zkappUri.set(props.zkAppURI)
  }

  requireAdminSignature() {
    const adminAccount = this.adminAccount.getAndRequireEquals()
    return AccountUpdate.createSigned(adminAccount)
  }

  @method
  setAdminAccount(adminAccount: PublicKey) {
    this.requireAdminSignature()
    this.adminAccount.set(adminAccount)
  }

  @method
  mint(address: PublicKey, amount: UInt64): AccountUpdate {
    this.requireAdminSignature()
    const totalSupply = this.totalSupply.getAndRequireEquals()
    const circulatingSupply = this.circulatingSupply.getAndRequireEquals()
    const newCirculatingSupply = circulatingSupply.add(amount)
    newCirculatingSupply.assertLessThanOrEqual(totalSupply, MINT_AMOUNT_EXCEEDS_TOTAL_SUPPLY)
    this.circulatingSupply.set(newCirculatingSupply)
    return this.internal.mint({ address, amount })
  }

  @method
  setTotalSupply(amount: UInt64): void {
    this.requireAdminSignature()
    this.getCirculatingSupply().assertLessThanOrEqual(amount)
    this.totalSupply.set(amount)
  }

  @method
  burn(from: PublicKey, amount: UInt64): AccountUpdate {
    // If you want to disallow burning without approval from
    // the token admin, you could require a signature here:
    // this.requireAdminSignature();

    this.circulatingSupply.set(this.circulatingSupply.getAndRequireEquals().sub(amount))
    return this.internal.burn({ address: from, amount })
  }

  @method
  transfer(from: PublicKey, to: PublicKey, amount: UInt64): void {
    super.transfer(from, to, amount)
  }

  @method
  approveBase(updates: AccountUpdateForest): void {
    this.checkZeroBalanceChange(updates)
  }

  @method
  getBalanceOf(address: PublicKey): UInt64 {
    const account = Account(address, this.deriveTokenId())
    const balance = account.balance.get()
    account.balance.requireEquals(balance)
    return balance
  }

  @method
  getTotalSupply(): UInt64 {
    return this.totalSupply.getAndRequireEquals()
  }

  @method
  getCirculatingSupply(): UInt64 {
    return this.circulatingSupply.getAndRequireEquals()
  }

  @method
  getDecimals(): UInt64 {
    return this.decimals
  }
}

const MINT_AMOUNT_EXCEEDS_TOTAL_SUPPLY =
  "Minting the provided amount would overflow the total supply."
