/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable jest/require-hook */
import {
  AccountUpdate,
  Circuit,
  Experimental,
  Field,
  isReady,
  Mina,
  shutdown,
  UInt64,
  VerificationKey,
} from 'snarkyjs';
import describeContract from '../test/describeContract.js';
import ThirdPartySmartContract from '../test/ThirdPartySmartContract.js';
import TokenHolder from '../test/TokenHolder.js';

import Token from './token.js';

await isReady;

describeContract<Token>('Token', Token, (context) => {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let token: Token;

  async function deployToken() {
    const { zkAppWithTokenId, deployerAccount, deployerKey, zkAppPrivateKey } =
      context();
    token = zkAppWithTokenId();

    const tx = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      token.deploy();
    });

    tx.sign([deployerKey, zkAppPrivateKey]);
    await tx.prove();
    await tx.send();

    return tx;
  }

  describe('life cycle', () => {
    beforeAll(async () => {
      await deployToken();
    });

    it('should mint for alice', async () => {
      expect.assertions(1);

      const {
        senderAccount,
        senderKey,
        zkAppPrivateKey,
        testAccounts: [alice],
      } = context();

      const tx = await Mina.transaction(senderAccount, () => {
        const amount = UInt64.from(1_000_000);

        // `sender` pays for `alice` token account creation
        AccountUpdate.createSigned(senderAccount).balance.subInPlace(
          Mina.accountCreationFee()
        );

        token.mint(alice.publicKey, amount);
      });

      tx.sign([senderKey, zkAppPrivateKey]);
      await tx.prove();
      await tx.send();

      Circuit.log('Minting for alice successful', {
        alice: {
          mina: Mina.getBalance(alice.publicKey),

          customToken: Mina.getBalance(alice.publicKey, token.token.id),
        },
      });

      expect(Mina.getBalance(alice.publicKey, token.token.id).toString()).toBe(
        1_000_000n.toString()
      );
    });

    it('should transfer from Alice to Bob', async () => {
      expect.assertions(0);

      const {
        zkAppPrivateKey,
        senderAccount,
        senderKey,
        testAccounts: [alice, bob],
      } = context();

      Circuit.log('Sending from alice to bob');
      const tx = await Mina.transaction(alice.publicKey, () => {
        const amount = UInt64.from(1000);

        // pay for `bob` account creation by `alice`
        AccountUpdate.createSigned(alice.publicKey).balance.subInPlace(
          Mina.accountCreationFee()
        );

        token.transfer(alice.publicKey, bob.publicKey, amount);
      });

      tx.sign([alice.privateKey]);
      await tx.prove();
      await tx.send();

      const aliceBalanceToken = Mina.getBalance(
        alice.publicKey,
        token.token.id
      ).toBigInt();

      const bobBalanceToken = Mina.getBalance(
        bob.publicKey,
        token.token.id
      ).toBigInt();

      Circuit.log('aliceBalanceToken', aliceBalanceToken);
      Circuit.log('bobBalanceToken', bobBalanceToken);
    });

    describeContract<ThirdPartySmartContract>(
      'third party contract',
      ThirdPartySmartContract,
      (thirdPartyContext) => {
        // eslint-disable-next-line @typescript-eslint/init-declarations
        let thirdParty: ThirdPartySmartContract;
        let thirdPartyTokenHolder: TokenHolder;

        ThirdPartySmartContract.tokenSmartContractAddress =
          context().zkAppAddress;

        TokenHolder.tokenSmartContractAddress = context().zkAppAddress;

        async function deployThirdParty() {
          const {
            zkAppWithTokenId,
            deployerAccount,
            deployerKey,
            zkAppPrivateKey,
          } = thirdPartyContext();

          thirdParty = zkAppWithTokenId();

          const tx = await Mina.transaction(deployerAccount, () => {
            // pay for deployment of 'thirdParty'
            // token account by deployerAccount
            AccountUpdate.createSigned(deployerAccount).balance.subInPlace(
              Mina.accountCreationFee()
            );

            thirdParty.deploy();
          });

          tx.sign([deployerKey, zkAppPrivateKey]);
          await tx.prove();
          await tx.send();

          return tx;
        }

        async function deployThirdPartyTokenHolder() {
          const {
            zkAppAddress,
            zkAppPrivateKey,
            deployerAccount,
            deployerKey,
          } = thirdPartyContext();

          thirdPartyTokenHolder = new TokenHolder(zkAppAddress, token.token.id);

          const tx = await Mina.transaction(deployerAccount, () => {
            // pay for deployment of 'thirdPartyTokenHolder'
            // token account by deployerAccount
            AccountUpdate.createSigned(deployerAccount).balance.subInPlace(
              Mina.accountCreationFee()
            );

            thirdPartyTokenHolder.deploy();
            token.approveAccountUpdate(thirdPartyTokenHolder.self);
          });

          tx.sign([deployerKey, zkAppPrivateKey]);
          await tx.prove();
          await tx.send();

          return tx;
        }

        describeContract<TokenHolder>(
          'third party token holder contract',
          TokenHolder,
          (tokenHolderContext) => {
            describe('token holder', () => {
              beforeAll(async () => {
                await deployThirdParty();
                await deployThirdPartyTokenHolder();
              });

              it('should have no balance, but should exist', () => {
                expect.assertions(0);

                const { zkAppAddress } = tokenHolderContext();
                const balance = token.balanceOf(zkAppAddress);

                Circuit.log('balance after deploy', balance);
              });

              describe('life cycle', () => {
                describe('deposit', () => {
                  it('should allow deposits of the custom token contract', async () => {
                    expect.assertions(0);

                    const {
                      zkAppAddress,
                      testAccounts: [alice],
                    } = thirdPartyContext();

                    Error.stackTraceLimit = 1_000_000_000;

                    const tx = await Mina.transaction(alice.publicKey, () => {
                      thirdParty.deposit(UInt64.from(10));
                    });

                    tx.sign([alice.privateKey]);

                    await tx.prove();
                    await tx.send();

                    const balance = token.balanceOf(zkAppAddress);
                    Circuit.log('balance after deposit', balance);
                  });
                });

                describe('withdraw', () => {
                  it('should allow withdraw of the custom token contract', async () => {
                    expect.assertions(0);

                    const {
                      zkAppAddress,
                      testAccounts: [alice],
                    } = thirdPartyContext();

                    const tx = await Mina.transaction(alice.publicKey, () => {
                      thirdParty.withdraw(UInt64.from(10));
                    });

                    tx.sign([alice.privateKey]);

                    await tx.prove();
                    await tx.send();

                    const balance = token.balanceOf(zkAppAddress);
                    Circuit.log('balance after withdraw', balance);
                  });
                });
              });
            });
          },
          { createLocalBlockchain: false }
        );
      },
      { createLocalBlockchain: false }
    );
  });
});
