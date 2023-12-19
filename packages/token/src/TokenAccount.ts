/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import {
  AccountUpdate,
  Permissions,
  type PublicKey,
  SmartContract,
  UInt64,
  method,
  PrivateKey,
  Circuit,
} from 'o1js';

import type Withdrawable from './interfaces/tokenAccount/withdrawable';
import Token from './token';
import Depositable from './interfaces/tokenAccount/depositable';

class TokenAccount extends SmartContract implements Withdrawable, Depositable {
  // eslint-disable-next-line no-warning-comments
  // TODO: replace with a getter/setter or some other way
  // of keeping it consistent across the smart contract lifecycle
  public tokenAddress: PublicKey = PrivateKey.random().toPublicKey();

  @method
  public withdraw(amount: UInt64): AccountUpdate {
    const token = new Token(this.tokenAddress);
    const [fromAccountUpdate] = token.transferFrom(
      this.address,
      amount,
      AccountUpdate.MayUseToken.InheritFromParent
    );
    return fromAccountUpdate;
  }

  @method
  public deposit(amount: UInt64): AccountUpdate {
    const token = new Token(this.tokenAddress);
    const [, toAccountUpdate] = token.transferTo(
      this.address,
      amount,
      AccountUpdate.MayUseToken.InheritFromParent
    );
    return toAccountUpdate;
  }
}

export default TokenAccount;
