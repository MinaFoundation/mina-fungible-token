/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import {
  SmartContract,
  method,
  UInt64,
  PublicKey,
  AccountUpdate,
  Permissions,
  DeployArgs,
  Token,
  PrivateKey,
  isReady,
} from 'snarkyjs';
import { Transferable } from '../src/mixins/transferable.js';
import TokenSmartContract from '../src/Token.js';

await isReady;

class TokenHolder extends SmartContract {
  public static tokenSmartContractAddress: PublicKey =
    PrivateKey.random().toPublicKey();

  public get tokenContract() {
    return new TokenSmartContract(TokenHolder.tokenSmartContractAddress);
  }

  public deploy(args?: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      send: Permissions.proof(),
    });
  }

  @method
  public withdraw(to: PublicKey, amount: UInt64) {
    this.tokenContract.transfer(this, to, amount);
  }
}

export default TokenHolder;
