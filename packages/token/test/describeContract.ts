/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  isReady,
  Mina,
  PrivateKey,
  type PublicKey,
  type SmartContract,
  type Field,
  Circuit,
} from 'snarkyjs';

interface ContractTestContext<ZkApp extends SmartContract> {
  deployerAccount: PublicKey;
  deployerKey: PrivateKey;
  senderAccount: PublicKey;
  senderKey: PrivateKey;
  zkAppAddress: PublicKey;
  zkAppPrivateKey: PrivateKey;
  zkAppWithTokenId: (tokenId?: Field) => ZkApp;
  testAccounts: { privateKey: PrivateKey; publicKey: PublicKey }[];
}

async function withTimer<Result>(
  name: string,
  callback: () => Promise<Result>
): Promise<Result> {
  console.log(`Starting ${name}`);
  console.time(name);
  const result = await callback();
  console.timeEnd(name);
  return result;
}

const hasProofsEnabled = false;

let Local: ReturnType<typeof Mina.LocalBlockchain> | undefined;

function describeContract<ZkApp extends SmartContract>(
  name: string,
  Contract: typeof SmartContract,
  testCallback: (context: () => ContractTestContext<ZkApp>) => void,
  options = { createLocalBlockchain: true }
) {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let context: ContractTestContext<ZkApp>;

  function createContext() {
    if (options.createLocalBlockchain) {
      // eslint-disable-next-line new-cap
      Local = Mina.LocalBlockchain({
        proofsEnabled: hasProofsEnabled,
        enforceTransactionLimits: false,
      });
      Mina.setActiveInstance(Local);
    }

    if (!Local) {
      throw new Error('Local blockchain not found!');
    }

    // first test account is the deployer
    // eslint-disable-next-line putout/putout
    const [{ privateKey: deployerKey, publicKey: deployerAccount }] =
      Local.testAccounts;

    // second test account is the sender
    // eslint-disable-next-line putout/putout
    const [, { privateKey: senderKey, publicKey: senderAccount }] =
      Local.testAccounts;

    const zkAppPrivateKey = PrivateKey.random();
    const zkAppAddress = zkAppPrivateKey.toPublicKey();

    // eslint-disable-next-line func-style
    const zkAppWithTokenId = (tokenId?: Field) =>
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      new Contract(zkAppAddress, tokenId) as ZkApp;

    context = {
      deployerAccount,
      deployerKey,
      senderAccount,
      senderKey,
      zkAppWithTokenId,
      zkAppAddress,
      zkAppPrivateKey,
      testAccounts: Local.testAccounts.slice(2),
    };
  }

  describe(name, () => {
    beforeAll(async () => {
      await isReady;
      console.time(name);
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, putout/putout
      if (hasProofsEnabled) {
        // eslint-disable-next-line @typescript-eslint/require-await
        const analyzedMethods = await withTimer('analyzeMethods', async () =>
          Contract.analyzeMethods()
        );

        await withTimer('compile', async () => {
          await Contract.compile();
        });
      }
    });

    createContext();

    testCallback(() => context);
  });
}

export default describeContract;
export { withTimer };
