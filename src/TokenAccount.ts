/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import {
  AccountUpdate,
  Permissions,
  PublicKey,
  SmartContract,
  UInt64,
  method,
  PrivateKey,
  Circuit,
  state,
  State,
  DeployArgs,
  Int64,
} from 'o1js';

import type Withdrawable from './interfaces/tokenAccount/withdrawable';
import Token from './token';
import Depositable from './interfaces/tokenAccount/depositable';

class TokenAccount extends SmartContract implements Withdrawable, Depositable {
  @state(PublicKey) ownerAddress = State<PublicKey>();

  public get tokenOwner() {
    this.ownerAddress.requireEquals(this.ownerAddress.get());
    if(!this.ownerAddress.get()) {
      throw new Error('Token owner address has not been set')
    }
    return new Token(this.ownerAddress.get())
  }

  deploy(args: DeployArgs & {ownerAddress: PublicKey}) {
    super.deploy(args);
    this.ownerAddress.set(args.ownerAddress);
  }

  @method
  public withdraw(amount: UInt64): AccountUpdate {
    const accountUpdate = AccountUpdate.create(this.address, this.tokenOwner.deriveTokenId());
    accountUpdate.balanceChange = Int64.fromUnsigned(amount);
    accountUpdate.requireSignature();
    return accountUpdate;
  }

  @method
  public deposit(amount: UInt64): AccountUpdate {
    const accountUpdate = AccountUpdate.create(this.address, this.tokenOwner.deriveTokenId());
    accountUpdate.balanceChange = Int64.fromUnsigned(amount).neg();
    return accountUpdate;
  }
}

export default TokenAccount;
