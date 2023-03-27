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
import TokenSmartContract from '../src/token.js';

await isReady;

class TokenHolder extends SmartContract {
  public static tokenSmartContractAddress: PublicKey =
    PrivateKey.random().toPublicKey();

  public deploy(args?: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      send: Permissions.proof(),
    });
  }

  @method
  public withdraw(to: PublicKey, amount: UInt64) {
    if (!TokenHolder.tokenSmartContractAddress) {
      throw new Error('Token smart contract address unknown!');
    }

    const token = new TokenSmartContract(TokenHolder.tokenSmartContractAddress);
    token.transfer(this.address, to, amount);

    this.self.body.mayUseToken = AccountUpdate.MayUseToken.ParentsOwnToken;
  }
}

export default TokenHolder;
