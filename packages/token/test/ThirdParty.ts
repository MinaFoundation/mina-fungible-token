/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import {
  AccountUpdate,
  SmartContract,
  UInt64,
  type PublicKey,
  PrivateKey,
  method,
  Circuit,
  UInt32,
} from 'o1js';

import Token from '../src/token';
import TokenAccount from '../src/TokenAccount';

class ThirdParty extends SmartContract {
  // eslint-disable-next-line no-warning-comments
  // TODO: replace with a getter/setter or some other way
  // of keeping it consistent across the smart contract lifecycle
  public tokenAddress: PublicKey = PrivateKey.random().toPublicKey();

  @method
  public deposit(fromAccountUpdate: AccountUpdate, amount: UInt64) {
    const token = new Token(this.tokenAddress);
    const tokenAccount = new TokenAccount(this.address, token.token.id);
    tokenAccount.tokenAddress = this.tokenAddress;
    tokenAccount.deposit(amount);
    token.approveTransfer(fromAccountUpdate, tokenAccount.self);
  }
}

export default ThirdParty;
