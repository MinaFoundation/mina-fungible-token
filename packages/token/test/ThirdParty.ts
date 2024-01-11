/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import {
  AccountUpdate,
  SmartContract,
  UInt64,
  PublicKey,
  PrivateKey,
  method,
  Circuit,
  UInt32,
  state,
  State,
  DeployArgs,
} from 'o1js';

import Token from '../src/token';
import TokenAccount from '../src/TokenAccount';

class ThirdParty extends SmartContract {
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
  public deposit(fromAccountUpdate: AccountUpdate, amount: UInt64) {
    const token = this.tokenOwner;
    const tokenAccount = new TokenAccount(this.address, token.token.id);
    tokenAccount.deposit(amount);
    token.approveTransfer(fromAccountUpdate, tokenAccount.self);
  }
}

export default ThirdParty;
