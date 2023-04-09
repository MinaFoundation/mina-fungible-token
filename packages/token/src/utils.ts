/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { SmartContract, type Struct } from 'snarkyjs';

interface SmartContractConstructor {
  new (...args: any[]): SmartContract;
  state?: InstanceType<Struct<unknown>>;
}

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

export { shareSnarkyMetadata, SmartContractConstructor };
