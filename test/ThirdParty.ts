/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import {
  AccountUpdate,
  SmartContract,
  UInt64,
  PublicKey,
  method,
  state,
  State,
  DeployArgs,
  Int64,
} from 'o1js';

import Token from '../src/token';

class ThirdParty extends SmartContract {
  @state(PublicKey) ownerAddress = State<PublicKey>();

  public get tokenOwner() {
    this.ownerAddress.requireEquals(this.ownerAddress.get());
    return new Token(this.ownerAddress.get())
  }

  deploy(args: DeployArgs & {ownerAddress: PublicKey}) {
    super.deploy(args);
    this.ownerAddress.set(args.ownerAddress);
  }

  @method
  public deposit(amount: UInt64): AccountUpdate {
    const accountUpdate = AccountUpdate.create(this.address, this.tokenOwner.deriveTokenId());
    accountUpdate.balanceChange = Int64.fromUnsigned(amount);
    return accountUpdate;
  }

  @method public withdraw(amount: UInt64): AccountUpdate {
    const accountUpdate = AccountUpdate.create(this.address, this.tokenOwner.deriveTokenId());
    accountUpdate.balanceChange = Int64.fromUnsigned(amount).neg();
    accountUpdate.requireSignature();
    return accountUpdate;
  }
}

export default ThirdParty;
