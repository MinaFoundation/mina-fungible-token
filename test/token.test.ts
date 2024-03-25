import {
  AccountUpdate,
  Mina,
  PrivateKey,
  type PublicKey,
  UInt64,
  Int64,
  AccountUpdateForest,
} from 'o1js';

import ThirdParty from '../test/ThirdParty';

import Token from '../src/token';

const proofsEnabled = false;
const enforceTransactionLimits = false;

interface Context {

  deployerKey: PrivateKey;
  deployerAccount: PublicKey;

  senderKey: PrivateKey;
  senderAccount: PublicKey;

  receiverKey: PrivateKey;
  receiverAccount: PublicKey;

  tokenAdminKey: PrivateKey;
  tokenAdminAccount: PublicKey;

  tokenAKey: PrivateKey;
  tokenAAccount: PublicKey;
  tokenA: Token;

  tokenBKey: PrivateKey;
  tokenBAccount: PublicKey;
  tokenB: Token;

  thirdPartyKey: PrivateKey;
  thirdPartyAccount: PublicKey;
  thirdParty: ThirdParty;

  thirdParty2Key: PrivateKey;
  thirdParty2Account: PublicKey;
  thirdParty2: ThirdParty;
}

describe('token integration', () => {
  let context: Context;

  beforeAll(async () => {
    const Local = Mina.LocalBlockchain({ proofsEnabled, enforceTransactionLimits });
    Mina.setActiveInstance(Local);

    // We need Mina accounts, for paying fees. 
    // We use the predefined test accounts for those
    let [
      { publicKey: deployerAccount, privateKey: deployerKey },
      { publicKey: senderAccount, privateKey: senderKey },
      { publicKey: receiverAccount, privateKey: receiverKey }
    ] = Local.testAccounts;

    // Key pairs for non-Mina accounts
    const {privateKey: tokenAdminKey, publicKey: tokenAdminAccount} =
      PrivateKey.randomKeypair();

    const {privateKey: tokenAKey, publicKey: tokenAAccount} =
      PrivateKey.randomKeypair();
    const tokenA = new Token(tokenAAccount);

    const {privateKey: tokenBKey, publicKey: tokenBAccount} =
      PrivateKey.randomKeypair();
    const tokenB = new Token(tokenBAccount);

    const {privateKey: thirdPartyKey, publicKey: thirdPartyAccount} =
      PrivateKey.randomKeypair();
    const thirdParty = new ThirdParty(thirdPartyAccount);

    const {privateKey: thirdParty2Key, publicKey: thirdParty2Account} =
      PrivateKey.randomKeypair();
    const thirdParty2 = new ThirdParty(thirdParty2Account);

    await Token.compile();

    context = {
      deployerKey,
      deployerAccount,

      receiverKey,
      receiverAccount,

      senderKey,
      senderAccount,

      tokenAdminKey,
      tokenAdminAccount,

      tokenAKey,
      tokenAAccount,
      tokenA,

      tokenBKey,
      tokenBAccount,
      tokenB,

      thirdPartyKey,
      thirdPartyAccount,
      thirdParty,

      thirdParty2Key,
      thirdParty2Account,
      thirdParty2,
    };
  });

  const totalSupply = UInt64.from(10_000_000_000_000);

  describe('deploy', () => {
    it('should deploy token contract A', async () => {

      const tx = await Mina.transaction(context.deployerAccount, () => {
        AccountUpdate.fundNewAccount(context.deployerAccount, 1);
        context.tokenA.deploy({
          adminPublicKey: context.tokenAdminAccount,
          totalSupply: totalSupply});
      });

      tx.sign([context.deployerKey, context.tokenAKey]);

      await tx.prove();
      await tx.send();
    });

    it('should deploy token contract B', async () => {

      const tx = await Mina.transaction(context.deployerAccount, () => {
        AccountUpdate.fundNewAccount(context.deployerAccount, 1);
        context.tokenB.deploy({
          adminPublicKey: context.tokenAdminAccount,
          totalSupply: totalSupply});
      });

      tx.sign([context.deployerKey, context.tokenBKey]);

      await tx.prove();
      await tx.send();
    });

    it('should deploy a third party contract', async () => {

      const tx = await Mina.transaction(context.deployerAccount, () => {
        AccountUpdate.fundNewAccount(context.deployerAccount, 2);
        context.thirdParty.deploy({ ownerAddress: context.tokenAAccount });
        context.thirdParty2.deploy({ ownerAddress: context.tokenAAccount });
      });

      tx.sign([context.deployerKey, context.thirdPartyKey, context.thirdParty2Key]);

      await tx.prove();
      await tx.send();
    });
  });


  describe('mint/burn', () => {
    const mintAmount = UInt64.from(1000);
    const burnAmount = UInt64.from(100);

    it('should mint for the sender account', async () => {
      const initialBalance = context.tokenA.getBalanceOf(context.senderAccount)
        .toBigInt()

      const tx = await Mina.transaction(context.senderAccount, () => {
        AccountUpdate.fundNewAccount(context.senderAccount, 2);
        context.tokenA.mint(context.senderAccount, mintAmount);
      });
  
      tx.sign([context.senderKey, context.tokenAdminKey]);
      await tx.prove();
      await tx.send();

      expect(
        context.tokenA.getBalanceOf(context.senderAccount).toBigInt()
      ).toBe(initialBalance + mintAmount.toBigInt());
    });

    it('should burn tokens for the sender account', async () => {
      const initialBalance = context.tokenA.getBalanceOf(context.senderAccount)
        .toBigInt();

      const tx = await Mina.transaction(context.senderAccount, () => {
        context.tokenA.burn(context.senderAccount, burnAmount);
      });

      tx.sign([context.senderKey]);
      await tx.prove();
      await tx.send();

      expect(
        context.tokenA.getBalanceOf(context.senderAccount).toBigInt()
      ).toBe(initialBalance - burnAmount.toBigInt());
    });

    it('should refuse to mint tokens without signature from the token admin', async () => {
      const tx = await Mina.transaction(context.senderAccount, () => {
        context.tokenA.mint(context.senderAccount, mintAmount);
      });

      tx.sign([context.senderKey]);
      await tx.prove();
      await expect (async () => await tx.send()).rejects.toThrow();
    });

    it('should refuse to burn tokens without signature from the token holder', async () => {
      const tx = await Mina.transaction(context.senderAccount, () => {
        context.tokenA.burn(context.senderAccount, burnAmount);
      });

      await tx.prove();
      await expect (async () => await tx.send()).rejects.toThrow();
    });
  });

  describe('transfers', () => {
    const sendAmount = UInt64.from(1);

    it('should do a transfer initiated by the token contract', async () => {
      const initialBalanceSender = context.tokenA.getBalanceOf(context.senderAccount).toBigInt();
      const initialBalanceReceiver = context.tokenA.getBalanceOf(context.receiverAccount).toBigInt();

      const tx = await Mina.transaction(context.senderAccount, () => {
        AccountUpdate.fundNewAccount(context.senderAccount, 1)
        context.tokenA.transfer(context.senderAccount, context.receiverAccount, sendAmount);
      });
      tx.sign([context.senderKey]);
      await tx.prove();
      await tx.send();

      expect(context.tokenA.getBalanceOf(context.senderAccount).toBigInt())
        .toBe(initialBalanceSender - sendAmount.toBigInt());
      expect(context.tokenA.getBalanceOf(context.receiverAccount).toBigInt())
        .toBe(initialBalanceReceiver + sendAmount.toBigInt());
    });

    it('should reject a transaction not signed by the token holder', async () => {
      const tx = await Mina.transaction(context.senderAccount, () => {
        context.tokenA.transfer(context.senderAccount, context.receiverAccount, sendAmount);
      });
      await tx.prove();
      await expect (async () => await tx.send()).rejects.toThrow();
    });

    it('should do a transaction constructed manually, approved by the token contract', async () => {
      const initialBalanceSender = context.tokenA.getBalanceOf(context.senderAccount).toBigInt();
      const initialBalanceReceiver = context.tokenA.getBalanceOf(context.receiverAccount).toBigInt();
      const updateSend = AccountUpdate.createSigned(context.senderAccount, context.tokenA.deriveTokenId());
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg();
      const updateReceive = AccountUpdate.create(context.receiverAccount, context.tokenA.deriveTokenId());
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount);

      const tx = await Mina.transaction(context.deployerAccount, () => {
        context.tokenA.approveAccountUpdates([updateSend, updateReceive])
      });
      await tx.sign([context.senderKey, context.deployerKey]).prove()
      await tx.send();

      expect(context.tokenA.getBalanceOf(context.senderAccount).toBigInt())
        .toBe(initialBalanceSender - sendAmount.toBigInt());
      expect(context.tokenA.getBalanceOf(context.receiverAccount).toBigInt())
        .toBe(initialBalanceReceiver + sendAmount.toBigInt());
    });

    it('should reject unbalanced transactions', async () => {
      const updateSend = AccountUpdate.createSigned(context.senderAccount, context.tokenA.deriveTokenId());
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg();
      const updateReceive = AccountUpdate.create(context.receiverAccount, context.tokenA.deriveTokenId());
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount).mul(2);
      await expect(async () => (
        await Mina.transaction(context.deployerAccount, () => {
          context.tokenA.approveAccountUpdates([updateSend, updateReceive])
        })
      )).rejects.toThrowError()
    });

    it('rejects transactions with mismatched tokens', async () => {
      const updateSend = AccountUpdate.createSigned(context.senderAccount, context.tokenA.deriveTokenId());
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg();
      const updateReceive = AccountUpdate.create(context.receiverAccount, context.tokenB.deriveTokenId());
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount);
      await expect(async () => (
        await Mina.transaction(context.deployerAccount, () => {
          AccountUpdate.fundNewAccount(context.senderAccount, 1)
          context.tokenA.approveAccountUpdate(updateSend)
          context.tokenB.approveAccountUpdate(updateReceive)
        })
      )).rejects.toThrowError()
    });

  });

  describe('third party', () => {
    const depositAmount = UInt64.from(100);

    it('should deposit from the user to the token account of the third party', async () => {
      const initialBalance = context.tokenA.getBalanceOf(context.senderAccount)
        .toBigInt();

      const tokenId = context.tokenA.deriveTokenId();

      const updateWithdraw = AccountUpdate.createSigned(context.senderAccount, tokenId)
      updateWithdraw.balanceChange = Int64.fromUnsigned(depositAmount).neg();

      const updateDeposit = context.thirdParty.deposit(depositAmount);
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent;

      const tx = await Mina.transaction(context.senderAccount, () => {
        AccountUpdate.fundNewAccount(context.senderAccount, 1)
        context.tokenA.approveBase(AccountUpdateForest.fromFlatArray([
          updateWithdraw,
          updateDeposit
        ]));
      });

      tx.sign([context.senderKey]);

      await tx.prove();
      await tx.send();

      expect(
        context.tokenA.getBalanceOf(context.thirdPartyAccount).toBigInt()
      ).toBe(depositAmount.toBigInt());

      expect(
        context.tokenA.getBalanceOf(context.senderAccount).toBigInt()
      ).toBe(initialBalance - depositAmount.toBigInt());
    });

    it('should send tokens from one contract to another', async () => {
      const initialBalance = context.tokenA.getBalanceOf(context.thirdPartyAccount)
        .toBigInt();
      const initialBalance2 = context.tokenA.getBalanceOf(context.thirdParty2Account)
        .toBigInt();
      const transferAmount = UInt64.from(1);
      const updateWithdraw = context.thirdParty.withdraw(transferAmount);
      const updateDeposit = context.thirdParty2.deposit(transferAmount);
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent;
      const tx = await Mina.transaction(context.senderAccount, () => {
        AccountUpdate.fundNewAccount(context.senderAccount, 1);
        context.tokenA.approveBase(AccountUpdateForest.fromFlatArray([
          updateWithdraw, updateDeposit
        ]))});
      await tx.sign([context.senderKey, context.thirdPartyKey]).prove()
      await tx.send();

      expect(
        context.tokenA.getBalanceOf(context.thirdPartyAccount).toBigInt()
      ).toBe(initialBalance - transferAmount.toBigInt());
      expect(
        context.tokenA.getBalanceOf(context.thirdParty2Account).toBigInt()
      ).toBe(initialBalance2 + transferAmount.toBigInt());
    })

    it('should reject an unbalanced transaction', async () => {
      const depositAmount = UInt64.from(10);
      const withdrawAmount = UInt64.from(5);
      const updateWithdraw = context.thirdParty.withdraw(withdrawAmount);
      const updateDeposit = context.thirdParty2.deposit(depositAmount);
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent;
      await expect(async () => (
        await Mina.transaction(context.senderAccount, () => {
        AccountUpdate.fundNewAccount(context.senderAccount, 1);
        context.tokenA.approveBase(AccountUpdateForest.fromFlatArray([
          updateWithdraw, updateDeposit
        ]))})
      )).rejects.toThrowError()
    });
  });
});
