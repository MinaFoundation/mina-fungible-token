/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { AccountUpdate, Experimental } from 'snarkyjs';

interface Approvable {
  approveTransfer: (from: AccountUpdate, to: AccountUpdate) => void;
  approveDeploy: (deploy: AccountUpdate) => void;
}

export default Approvable;
