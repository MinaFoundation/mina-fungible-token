import "core-js";
import "reflect-metadata";

import {
  AccountUpdate,
  Circuit,
  Mina,
  PrivateKey,
  type PublicKey,
  UInt64,
  Field,
  Bool,
} from 'o1js';

import { describe, it, beforeAll, expect } from "bun:test";

import ThirdParty from '../test/ThirdParty';

import Token from '../src/token';
import errors from '../src/errors';
import TokenAccount from '../src/TokenAccount';
import Hooks from '../src/Hooks';

const accountCreationFee = 0;
const proofsEnabled = false;
const enforceTransactionLimits = false;

interface Context {

  deployerKey: PrivateKey;
  deployerAccount: PublicKey;

  senderKey: PrivateKey;
  senderAccount: PublicKey;

  hooksKey: PrivateKey;
  hooksAccount: PublicKey;
  hooks: Hooks;

  directAdminKey: PrivateKey;
  directAdminAccount: PublicKey;

  tokenAKey: PrivateKey;
  tokenAAccount: PublicKey;
  tokenA: Token;

  tokenBKey: PrivateKey;
  tokenBAccount: PublicKey;
  tokenB: Token;

  thirdPartyKey: PrivateKey;
  thirdPartyAccount: PublicKey;
  thirdParty: ThirdParty;

  tokenAccountA: TokenAccount;
  tokenAccountB: TokenAccount;
}


describe('token integration', () => {
  let context: Context;

  beforeAll(async () => {
    const Local = Mina.LocalBlockchain({ accountCreationFee, proofsEnabled, enforceTransactionLimits });
    Mina.setActiveInstance(Local);

    // We need Mina accounts, for paying fees. 
    // We use the predefined test accounts for those
    const deployerKey = Local.testAccounts[0].privateKey;
    const deployerAccount = deployerKey.toPublicKey();

    const senderKey = Local.testAccounts[1].privateKey;
    const senderAccount = senderKey.toPublicKey();

    // Key pairs for non-Mina accounts
    const hooksKey = PrivateKey.random();
    const hooksAccount = hooksKey.toPublicKey();
    const hooks = new Hooks(hooksAccount);

    const directAdminKey = PrivateKey.random();
    const directAdminAccount = directAdminKey.toPublicKey();

    const tokenAKey = PrivateKey.random();
    const tokenAAccount = tokenAKey.toPublicKey();
    const tokenA = new Token(tokenAAccount);

    const tokenBKey = PrivateKey.random();
    const tokenBAccount = tokenBKey.toPublicKey();
    const tokenB = new Token(tokenBAccount);

    const thirdPartyKey = PrivateKey.random();
    const thirdPartyAccount = thirdPartyKey.toPublicKey();
    const thirdParty = new ThirdParty(thirdPartyAccount);

    const tokenAccountA = new TokenAccount(thirdPartyAccount, tokenA.token.id);
    const tokenAccountB = new TokenAccount(thirdPartyAccount, tokenB.token.id);

    await Hooks.compile();
    await Token.compile();

    context = {
      deployerKey,
      deployerAccount,

      senderKey,
      senderAccount,

      hooksKey,
      hooksAccount,
      hooks,

      directAdminKey,
      directAdminAccount,

      tokenAKey,
      tokenAAccount,
      tokenA,

      tokenBKey,
      tokenBAccount,
      tokenB,

      thirdPartyKey,
      thirdPartyAccount,
      thirdParty,

      tokenAccountA,
      tokenAccountB,
    };
  });

  const totalSupply = UInt64.from(10_000_000_000_000);

  describe('deploy', () => {
    it('should deploy token hooks', async () => {
      const tx = await Mina.transaction(context.deployerAccount, () => {
        context.hooks.deploy();
      });
      tx.sign([context.deployerKey, context.hooksKey]);
      await tx.prove();
      await tx.send();

      const tx2 = await Mina.transaction(context.deployerAccount, () => {
        context.hooks.initialize(context.directAdminAccount);
      });
      tx2.sign([context.deployerKey, context.directAdminKey]);
      await tx2.prove();
      await tx2.send();

    });
 
    it('should deploy token contract A', async () => {

      const tx = await Mina.transaction(context.deployerAccount, () => {
        context.tokenA.deploy();
        context.tokenA.initialize(context.hooksAccount, totalSupply);
      });

      tx.sign([context.deployerKey, context.tokenAKey]);

      await tx.prove();
      await tx.send();

      expect(context.tokenA.hooks.get().toBase58()).toBe(
        context.hooksAccount.toBase58()
      );
    });

    it('should deploy token contract B', async () => {

      const tx = await Mina.transaction(context.deployerAccount, () => {
        context.tokenB.deploy();
        context.tokenB.initialize(context.hooksAccount, totalSupply);
      });

      tx.sign([context.deployerKey, context.tokenBKey]);

      await tx.prove();
      await tx.send();

      expect(context.tokenB.hooks.get().toBase58()).toBe(
        context.hooksAccount.toBase58()
      );
    });

    it('should deploy a third party contract', async () => {

      const tx = await Mina.transaction(context.deployerAccount, () => {
        context.thirdParty.deploy({ ownerAddress: context.tokenAAccount });
      });

      tx.sign([context.deployerKey, context.thirdPartyKey]);

      await tx.prove();
      await tx.send();
    });

    it('should deploy a third party token account for token A', async () => {

      const tx = await Mina.transaction(context.deployerAccount, () => {
        context.tokenAccountA.deploy({ ownerAddress: context.tokenAAccount });
        context.tokenA.approveDeploy(context.tokenAccountA.self);
      });

      tx.sign([context.deployerKey, context.thirdPartyKey]);

      await tx.prove();
      await tx.send();
    });

    it('should deploy a third party token account for token B', async () => {

      const tx = await Mina.transaction(context.deployerAccount, () => {
        context.tokenAccountB.deploy({ ownerAddress: context.tokenAAccount });
        context.tokenB.approveDeploy(context.tokenAccountB.self);
      });

      tx.sign([context.deployerKey, context.thirdPartyKey]);

      await tx.prove();
      await tx.send();
    });
  });

  const mintAmount = UInt64.from(1000);
  const burnAmount = UInt64.from(100);

  describe('mint/burn', () => {
    it('should mint for the sender account', async () => {

      const tx = await Mina.transaction(context.senderAccount, () => {
        // eslint-disable-next-line no-warning-comments
        // TODO: it looks like the 'directAdmin' account
        // is also created and needs to be paid for
        context.tokenA.mint(context.senderAccount, mintAmount);
      });

      tx.sign([context.senderKey, context.directAdminKey]);
      await tx.prove();
      await tx.send();

      expect(
        context.tokenA.getBalanceOf(context.senderAccount).toBigInt()
      ).toBe(mintAmount.toBigInt());
    });

    it('should burn tokens for the sender account', async () => {
      const tx = await Mina.transaction(context.senderAccount, () => {
        context.tokenA.burn(context.senderAccount, burnAmount);
      });

      tx.sign([context.senderKey, context.directAdminKey]);
      await tx.prove();
      await tx.send();

      expect(
        context.tokenA.getBalanceOf(context.senderAccount).toBigInt()
      ).toBe(mintAmount.toBigInt() - burnAmount.toBigInt());
    });
  });

  describe('third party', () => {
    const depositAmount = UInt64.from(500);

    describe('deposit', () => {
      it('should deposit from the user to the token account of the third party', async () => {

        const tx = await Mina.transaction(context.senderAccount, () => {
          const [fromAccountUpdate] = context.tokenA.transferFrom(
            context.senderAccount,
            depositAmount,
            AccountUpdate.MayUseToken.ParentsOwnToken
          );

          fromAccountUpdate.requireSignature();

          context.thirdParty.deposit(fromAccountUpdate, depositAmount);
        });

        tx.sign([context.senderKey]);

        await tx.prove();
        await tx.send();

        expect(
          context.tokenA.getBalanceOf(context.thirdPartyAccount).toBigInt()
        ).toBe(depositAmount.toBigInt());

        expect(
          context.tokenA.getBalanceOf(context.senderAccount).toBigInt()
        ).toBe(mintAmount.toBigInt() - burnAmount.toBigInt() - depositAmount.toBigInt());
      });

      it('should reject an unbalanced transaction', async () => {
        const insufficientDeposit = UInt64.from(0);
        expect(async () => (await Mina.transaction(context.senderAccount, () => {
          const [fromAccountUpdate] = context.tokenA.transferFrom(
            context.senderAccount,
            insufficientDeposit,
            AccountUpdate.MayUseToken.ParentsOwnToken
          );
          fromAccountUpdate.requireSignature();
          context.thirdParty.deposit(fromAccountUpdate, depositAmount)
        }))).toThrow(errors.nonZeroBalanceChange);
      });
    });
  });

  describe('paused', () => {

    const sendAmount = UInt64.from(10);

    it('should be paused by the admin', async () => {
      const tx = await Mina.transaction(context.senderAccount, () => {
        context.tokenA.setPaused(Bool(true));
      });
      tx.sign([context.senderKey, context.directAdminKey]);
      await tx.prove();
      await tx.send();
    });

    it('should block minting and burning while paused', async () => {
      expect( async () => await Mina.transaction(context.senderAccount, () => {
        context.tokenA.mint(context.thirdPartyAccount, sendAmount)
      })).toThrow(errors.tokenPaused);

      expect( async () => await Mina.transaction(context.senderAccount, () => {
        context.tokenA.burn(context.thirdPartyAccount, sendAmount)
      })).toThrow(errors.tokenPaused);
    })

    it('should block token transfers while paused', async () => {
      expect(async () => await Mina.transaction(context.senderAccount, () => {
        context.tokenA.transferFromTo({
          from: context.thirdPartyAccount,
          to: context.thirdPartyAccount,
          amount: sendAmount})
      })).toThrow(errors.tokenPaused);
      expect(async () => await Mina.transaction(context.senderAccount, () => {
        context.tokenA.transferFrom(
          context.thirdPartyAccount,
          sendAmount,
          AccountUpdate.MayUseToken.ParentsOwnToken) }
      )).toThrow(errors.tokenPaused);
      expect(async () => await Mina.transaction(context.senderAccount, () => {
        context.tokenA.transferTo(
          context.thirdPartyAccount,
          sendAmount,
          AccountUpdate.MayUseToken.ParentsOwnToken) }
      )).toThrow(errors.tokenPaused);
    })

    it('should be unpaused by the admin', async () => {
      const tx = await Mina.transaction(context.senderAccount, () => {
        context.tokenA.setPaused(Bool(false));
      });
      tx.sign([context.senderKey, context.directAdminKey]);
      await tx.prove();
      await tx.send();
    });

  });
});
