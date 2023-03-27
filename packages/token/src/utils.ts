/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { SmartContract } from 'snarkyjs';

let provers: any[] = [];
function shareSnarkyMetadata<Current>(current: Current, base: any): Current {
  Object.defineProperty(current, '_provers', {
    get() {
      return provers;
    },

    set(value: any[]) {
      provers = value;
    },

    configurable: true,
  });

  if (base !== SmartContract) {
    Object.defineProperty(base, '_provers', {
      get() {
        return provers;
      },

      configurable: true,
    });
  }

  return current;
}

export { shareSnarkyMetadata };
