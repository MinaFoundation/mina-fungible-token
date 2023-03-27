/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable max-classes-per-file */
import { DeployArgs, Permissions, SmartContract } from 'snarkyjs';
import { mintable, burnable } from './mixins/adminable.js';
import approvable from './mixins/approvable.js';
import transferable from './mixins/transferable.js';
import viewable from './mixins/viewable.js';
import { shareSnarkyMetadata } from './utils.js';

const Mixins = approvable(
  viewable(burnable(mintable(transferable(SmartContract))))
);

class Token extends Mixins {
  public deploy(args?: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      access: Permissions.proof(),
      send: Permissions.proofOrSignature(),
    });
  }
}

shareSnarkyMetadata(Token, Mixins);

export default Token;
