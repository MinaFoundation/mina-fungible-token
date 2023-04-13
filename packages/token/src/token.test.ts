/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable new-cap */
import {
  AccountUpdate,
  Circuit,
  Mina,
  PrivateKey,
  PublicKey,
  UInt64,
  isReady,
  shutdown,
} from 'snarkyjs';
import Token from './Token.js';
import { after, min } from 'lodash';
import ThirdParty from '../test/ThirdParty.js';
import TokenAccount from './TokenAccount.js';
import Admin from './Admin.js';

await isReady;

const proofsEnabled = false;

interface Context {
  deployerKey: PrivateKey;
  deployerAccount: PublicKey;

  senderKey: PrivateKey;
  senderAccount: PublicKey;

  adminKey: PrivateKey;
  adminAccount: PublicKey;
  admin: Admin;

  tokenAKey: PrivateKey;
  tokenAAccount: PublicKey;
  tokenA: Token;

  // tokenBKey: PrivateKey;
  // tokenBAccount: PublicKey;
  // tokenB: Token;

  thirdPartyKey: PrivateKey;
  thirdPartyAccount: PublicKey;
  thirdParty: ThirdParty;

  tokenAccountA: TokenAccount;
  // tokenAccountB: TokenAccount;
}

describe('token integration', () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let context: Context;

  // eslint-disable-next-line max-statements
  beforeAll(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    const deployerKey = Local.testAccounts[0].privateKey;
    const deployerAccount = deployerKey.toPublicKey();

    const senderKey = Local.testAccounts[1].privateKey;
    const senderAccount = senderKey.toPublicKey();

    const adminKey = PrivateKey.random();
    const adminAccount = adminKey.toPublicKey();
    const admin = new Admin(adminAccount);

    const tokenAKey = PrivateKey.random();
    const tokenAAccount = tokenAKey.toPublicKey();
    const tokenA = new Token(tokenAKey.toPublicKey());

    // const tokenBKey = PrivateKey.random();
    // const tokenBAccount = tokenBKey.toPublicKey();
    // const tokenB = new Token(tokenBAccount);

    const thirdPartyKey = PrivateKey.random();
    const thirdPartyAccount = thirdPartyKey.toPublicKey();
    const thirdParty = new ThirdParty(thirdPartyAccount);
    thirdParty.tokenAddress = tokenAAccount;

    const tokenAccountA = new TokenAccount(thirdPartyAccount, tokenA.token.id);
    // const tokenAccountB = new TokenAccount(thirdPartyAccount, tokenB.token.id);

    context = {
      deployerKey,
      deployerAccount,

      senderKey,
      senderAccount,

      adminKey,
      adminAccount,
      admin,

      tokenAKey,
      tokenAAccount,
      tokenA,

      // tokenBKey,
      // tokenBAccount,
      // tokenB,

      thirdPartyKey,
      thirdPartyAccount,
      thirdParty,

      tokenAccountA,
      // tokenAccountB,
    };

    Circuit.log('accounts', {
      deployerAccount,
      senderAccount,
      adminAccount,
      tokenAAccount,
      // tokenBAccount,
      thirdPartyAccount,
    });

    Circuit.log('Token ids', {
      tokenAId: tokenA.token.id,
      // tokenBId: tokenB.token.id,
    });
  });

  const totalSupply = UInt64.from(10_000_000_000_000);

  describe('deploy', () => {
    it('should deploy token admin', async () => {
      expect.assertions(0);

      const tx = await Mina.transaction(context.deployerAccount, () => {
        AccountUpdate.fundNewAccount(context.deployerAccount, 1);
        context.admin.deploy();
      });

      tx.sign([context.deployerKey, context.adminKey]);

      await tx.prove();
      await tx.send();
    });

    it('should deploy token contract A', async () => {
      expect.assertions(1);

      const tx = await Mina.transaction(context.deployerAccount, () => {
        AccountUpdate.fundNewAccount(context.deployerAccount, 1);
        context.tokenA.deploy();
        context.tokenA.initialize(context.adminAccount, totalSupply);
      });

      tx.sign([context.deployerKey, context.tokenAKey]);

      await tx.prove();
      await tx.send();

      expect(context.tokenA.admin.get().toBase58()).toBe(
        context.adminAccount.toBase58()
      );
    });

    // it('should deploy token contract B', async () => {
    //   expect.assertions(1);

    //   const tx = await Mina.transaction(context.deployerAccount, () => {
    //     AccountUpdate.fundNewAccount(context.deployerAccount, 1);
    //     context.tokenB.deploy();
    //     context.tokenB.initialize(context.adminAccount, totalSupply);
    //   });

    //   tx.sign([context.deployerKey, context.tokenBKey]);

    //   await tx.prove();
    //   await tx.send();

    //   expect(context.tokenB.admin.get().toBase58()).toBe(
    //     context.adminAccount.toBase58()
    //   );
    // });

    it('should deploy a third party contract', async () => {
      expect.assertions(0);

      const tx = await Mina.transaction(context.deployerAccount, () => {
        AccountUpdate.fundNewAccount(context.deployerAccount, 1);
        context.thirdParty.deploy();
      });

      tx.sign([context.deployerKey, context.thirdPartyKey]);

      await tx.prove();
      await tx.send();
    });

    it('should deploy a third party token account for token A', async () => {
      expect.assertions(0);

      const tx = await Mina.transaction(context.deployerAccount, () => {
        AccountUpdate.fundNewAccount(context.deployerAccount, 1);
        context.tokenAccountA.deploy();
        Circuit.log('tokenAccountA.self', context.tokenAccountA.self.toJSON());
        context.tokenA.approveDeploy(context.tokenAccountA.self);
      });

      tx.sign([context.deployerKey, context.thirdPartyKey]);

      await tx.prove();
      await tx.send();
    });

    // it('should deploy a third party token account for token B', async () => {
    //   expect.assertions(0);

    //   const tx = await Mina.transaction(context.deployerAccount, () => {
    //     AccountUpdate.fundNewAccount(context.deployerAccount, 1);
    //     context.tokenAccountB.deploy();
    //     context.tokenB.approveDeploy(context.tokenAccountB.self);
    //   });

    //   tx.sign([context.deployerKey, context.thirdPartyKey]);

    //   await tx.prove();
    //   await tx.send();
    // });
  });

  describe('mint', () => {
    const mintAmount = UInt64.from(1000);

    it('should mint for the sender account', async () => {
      expect.assertions(1);

      const tx = await Mina.transaction(context.senderAccount, () => {
        AccountUpdate.fundNewAccount(context.senderAccount, 1);
        context.tokenA.mint(context.senderAccount, mintAmount);
      });

      tx.sign([context.senderKey]);

      await tx.prove();
      await tx.send();

      expect(
        context.tokenA.getBalanceOf(context.senderAccount).toBigInt()
      ).toBe(mintAmount.toBigInt());
    });
  });

  describe('third party', () => {
    describe('deposit', () => {
      const depositAmount = UInt64.from(500);

      it('should deposit from the user to the token account of the third party', async () => {
        expect.assertions(1);

        const tx = await Mina.transaction(context.senderAccount, () => {
          const [fromAccountUpdate] = context.tokenA.transferFrom(
            context.senderAccount,
            depositAmount,
            AccountUpdate.MayUseToken.ParentsOwnToken
          );

          fromAccountUpdate.requireSignature();

          Circuit.log(
            'fromAccountUpdate',
            fromAccountUpdate.body.balanceChange
          );

          context.thirdParty.deposit(fromAccountUpdate, depositAmount);
        });

        tx.sign([context.senderKey]);

        await tx.prove();
        await tx.send();

        expect(
          context.tokenA.getBalanceOf(context.thirdPartyAccount).toBigInt()
        ).toBe(depositAmount.toBigInt());
      });
    });
  });
});
