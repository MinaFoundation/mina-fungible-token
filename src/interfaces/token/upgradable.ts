/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { VerificationKey } from 'o1js';

interface Upgradable {
  setVerificationKey: (verificationKey: VerificationKey) => void;
}

export default Upgradable;
