/* eslint-disable max-statements */
/* eslint-disable max-lines */
/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */

import {
  AccountUpdate,
  method,
  PublicKey,
  UInt64,
  Account,
  state,
  State,
  TokenContract,
  AccountUpdateForest,
  DeployArgs,
  UInt8,
} from 'o1js';

import errors from './errors';
import {
  type Burnable,
  type Mintable,
  type Transferable,
  type Viewable,
  type Approvable,
  MintData, BurnData, TransferData
} from './interfaces';


class FungibleToken
  extends TokenContract
  implements
    Approvable,
    Mintable,
    Burnable,
    Viewable,
    Transferable
{
  @state(PublicKey) public adminAccount = State<PublicKey>();
  @state(UInt64) public totalSupply = State<UInt64>();
  @state(UInt64) public circulatingSupply = State<UInt64>();

  public decimals: UInt64 = UInt64.from(9);

  deploy(args: DeployArgs & {
      adminPublicKey: PublicKey,
      totalSupply: UInt64,
      tokenSymbol: string}) {
    super.deploy();
    this.adminAccount.set(args.adminPublicKey);
    this.totalSupply.set(args.totalSupply);
    this.circulatingSupply.set(UInt64.from(0));
    this.account.tokenSymbol.set(args.tokenSymbol);
  }

  requireAdminSignature(): AccountUpdate {
    const adminAccount = this.adminAccount.getAndRequireEquals();
    const adminAccountUpdate = AccountUpdate.createSigned(adminAccount);
    return adminAccountUpdate;
  }

  @method setAdminAccount(adminAccount: PublicKey) {
    this.requireAdminSignature();
    this.adminAccount.set(adminAccount);
  }

  /**
   * Mintable
   */

  @method
  public mint(address: PublicKey, amount: UInt64): MintData {
    this.requireAdminSignature();

    const totalSupply = this.totalSupply.getAndRequireEquals();
    const circulatingSupply = this.circulatingSupply.getAndRequireEquals();

    const newCirculatingSupply = circulatingSupply.add(amount);
    newCirculatingSupply.assertLessThanOrEqual(
      totalSupply,
      errors.mintAmountExceedsTotalSupply
    );
    this.circulatingSupply.set(newCirculatingSupply);
    
    this.internal.mint({ address, amount });
    return new MintData({methodId: UInt8.from(1), addressTo: address, amount})
  }

  @method
  public setTotalSupply(amount: UInt64) {
    this.requireAdminSignature();

    this.getCirculatingSupply().assertLessThanOrEqual(amount);

    this.totalSupply.set(amount);
  }

  /**
   * Burnable
   */

  @method
  public burn(from: PublicKey, amount: UInt64): BurnData {
    // If you want to disallow burning without approval from
    // the token admin, you could require a signature here:
    // this.requireAdminSignature();

    this.circulatingSupply.set(
      this.circulatingSupply.getAndRequireEquals()
      .sub(amount));

    this.internal.burn({ address: from, amount });
    return new BurnData({methodId: UInt8.from(2), addressFrom: from, amount});
  }

  /**
   * Approvable
   */

  @method
  public approveBase(updates: AccountUpdateForest) {
    this.checkZeroBalanceChange(updates);
  }

  @method
  public transfer(from: PublicKey, to: PublicKey, amount: UInt64): TransferData {
    super.transfer(from, to, amount);
    return new TransferData({
      methodId: UInt8.from(3), 
      addressFrom: from, 
      addressTo: to, 
      amount
    });
  }

  /**
   * Viewable
   */

  @method
  public getBalanceOf(address: PublicKey): UInt64 {
    const account = Account(address, this.deriveTokenId());
    const balance = account.balance.get();
    account.balance.requireEquals(balance);

    return balance;
  }

  @method
  public getTotalSupply(): UInt64 {
    return (this.totalSupply.getAndRequireEquals());
  }

  @method
  public getCirculatingSupply(): UInt64 {
    return(this.circulatingSupply.getAndRequireEquals());
  }

  @method
  public getDecimals(): UInt64 {
    return this.decimals;
  }
}

export default FungibleToken;
