/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import {
  AccountUpdate,
  PublicKey,
  SmartContract,
  UInt64,
  method,
  state,
  State,
  DeployArgs,
} from 'o1js';

import type Withdrawable from './interfaces/tokenAccount/withdrawable';
import Token from './token';
import Depositable from './interfaces/tokenAccount/depositable';

class TokenAccount extends SmartContract implements Withdrawable, Depositable {
  @state(PublicKey) ownerAddress = State<PublicKey>();

  public get tokenOwner() {
    this.ownerAddress.assertEquals(this.ownerAddress.get());
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
    const [fromAccountUpdate] = this.tokenOwner.transferFrom(
      this.address,
      amount,
      AccountUpdate.MayUseToken.InheritFromParent
    );
    return fromAccountUpdate;
  }

  @method
  public deposit(amount: UInt64): AccountUpdate {
    const [, toAccountUpdate] = this.tokenOwner.transferTo(
      this.address,
      amount,
      AccountUpdate.MayUseToken.InheritFromParent
    );
    return toAccountUpdate;
  }
}

export default TokenAccount;
