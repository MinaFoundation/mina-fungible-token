import {
  AccountUpdate,
  AccountUpdateForest,
  DeployArgs,
  Int64,
  method,
  Mina,
  PrivateKey,
  PublicKey,
  SmartContract,
  State,
  state,
  UInt64,
} from "o1js"
import { TestAccount, TestAccounts } from "util/TestAccount.js"
import { FungibleToken } from "./index.js"

interface Context {
  deployer: TestAccount
  sender: TestAccount
  receiver: TestAccount
  tokenAdmin: TestAccount
  newTokenAdmin: TestAccount

  tokenA: TestAccount
  tokenAContract: FungibleToken

  tokenB: TestAccount
  tokenBContract: FungibleToken

  thirdPartyA: TestAccount
  thirdPartyAContract: ThirdParty

  thirdPartyB: TestAccount
  thirdPartyBContract: ThirdParty
}

describe("token integration", () => {
  let context: Context

  beforeAll(async () => {
    const Local = Mina.LocalBlockchain({
      proofsEnabled: false,
      enforceTransactionLimits: false,
    })
    Mina.setActiveInstance(Local)

    let [deployer, sender, receiver] = Local.testAccounts as TestAccounts

    // Key pairs for non-Mina accounts
    const tokenAdmin = PrivateKey.randomKeypair()
    const newTokenAdmin = PrivateKey.randomKeypair()

    const tokenA = PrivateKey.randomKeypair()
    const tokenAContract = new FungibleToken(tokenA.publicKey)

    const tokenB = PrivateKey.randomKeypair()
    const tokenBContract = new FungibleToken(tokenB.publicKey)

    const thirdPartyA = PrivateKey.randomKeypair()
    const thirdPartyAContract = new ThirdParty(thirdPartyA.publicKey)

    const thirdPartyB = PrivateKey.randomKeypair()
    const thirdPartyBContract = new ThirdParty(thirdPartyB.publicKey)

    await FungibleToken.compile()

    context = {
      deployer,
      receiver,
      sender,
      tokenAdmin,
      newTokenAdmin,

      tokenA,
      tokenAContract,

      tokenB,
      tokenBContract,

      thirdPartyA,
      thirdPartyAContract,

      thirdPartyB,
      thirdPartyBContract,
    }
  })

  const totalSupply = UInt64.from(10_000_000_000_000)

  describe("deploy", () => {
    it("should deploy token contract A", async () => {
      const tx = await Mina.transaction(context.deployer.publicKey, () => {
        AccountUpdate.fundNewAccount(context.deployer.publicKey, 1)
        context.tokenAContract.deploy({
          adminPublicKey: context.tokenAdmin.publicKey,
          totalSupply: totalSupply,
          tokenSymbol: "tokA",
          zkAppURI: "",
        })
      })

      tx.sign([context.deployer.privateKey, context.tokenA.privateKey])

      await tx.prove()
      await tx.send()
    })

    it("should deploy token contract B", async () => {
      const tx = await Mina.transaction(context.deployer.publicKey, () => {
        AccountUpdate.fundNewAccount(context.deployer.publicKey, 1)
        context.tokenBContract.deploy({
          adminPublicKey: context.tokenAdmin.publicKey,
          totalSupply: totalSupply,
          tokenSymbol: "tokB",
          zkAppURI: "",
        })
      })

      tx.sign([context.deployer.privateKey, context.tokenB.privateKey])

      await tx.prove()
      await tx.send()
    })

    it("should deploy a third party contract", async () => {
      const tx = await Mina.transaction(context.deployer.publicKey, () => {
        AccountUpdate.fundNewAccount(context.deployer.publicKey, 2)
        context.thirdPartyAContract.deploy({ ownerAddress: context.tokenA.publicKey })
        context.thirdPartyBContract.deploy({ ownerAddress: context.tokenA.publicKey })
      })

      tx.sign([
        context.deployer.privateKey,
        context.thirdPartyA.privateKey,
        context.thirdPartyB.privateKey,
      ])

      await tx.prove()
      await tx.send()
    })
  })

  describe("admin", () => {
    const mintAmount = UInt64.from(1000)
    const burnAmount = UInt64.from(100)

    it("should mint for the sender account", async () => {
      const initialBalance = context.tokenAContract.getBalanceOf(context.sender.publicKey)
        .toBigInt()

      const tx = await Mina.transaction(context.sender.publicKey, () => {
        AccountUpdate.fundNewAccount(context.sender.publicKey, 2)
        context.tokenAContract.mint(context.sender.publicKey, mintAmount)
      })

      tx.sign([context.sender.privateKey, context.tokenAdmin.privateKey])
      await tx.prove()
      await tx.send()

      expect(
        context.tokenAContract.getBalanceOf(context.sender.publicKey).toBigInt(),
      ).toBe(initialBalance + mintAmount.toBigInt())
    })

    it("should burn tokens for the sender account", async () => {
      const initialBalance = context.tokenAContract.getBalanceOf(context.sender.publicKey)
        .toBigInt()

      const tx = await Mina.transaction(context.sender.publicKey, () => {
        context.tokenAContract.burn(context.sender.publicKey, burnAmount)
      })

      tx.sign([context.sender.privateKey])
      await tx.prove()
      await tx.send()

      expect(
        context.tokenAContract.getBalanceOf(context.sender.publicKey).toBigInt(),
      ).toBe(initialBalance - burnAmount.toBigInt())
    })

    it("should refuse to mint tokens without signature from the token admin", async () => {
      const tx = await Mina.transaction(context.sender.publicKey, () => {
        context.tokenAContract.mint(context.sender.publicKey, mintAmount)
      })

      tx.sign([context.sender.privateKey])
      await tx.prove()
      await expect(async () => await tx.send()).rejects.toThrow()
    })

    it("should refuse to burn tokens without signature from the token holder", async () => {
      const tx = await Mina.transaction(context.sender.publicKey, () => {
        context.tokenAContract.burn(context.sender.publicKey, burnAmount)
      })

      await tx.prove()
      await expect(async () => await tx.send()).rejects.toThrow()
    })

    it("should refuse to set total supply to be less than circulating supply", async () => {
      await expect(async () => (
        await Mina.transaction(context.sender.publicKey, () => {
          context.tokenAContract.setTotalSupply(UInt64.from(1))
        })
      )).rejects.toThrow()
    })

    it("correctly changes the adminAccount", async () => {
      const tx = await Mina.transaction(context.sender.publicKey, () => {
        context.tokenAContract.setAdminAccount(context.newTokenAdmin.publicKey)
      })
      tx.sign([context.sender.privateKey, context.tokenAdmin.privateKey])
      await tx.prove()
      await tx.send()

      const tx2 = await Mina.transaction(context.sender.publicKey, () => {
        AccountUpdate.fundNewAccount(context.sender.publicKey, 1)
        context.tokenAContract.setTotalSupply(totalSupply)
      })
      tx2.sign([context.sender.privateKey, context.newTokenAdmin.privateKey])
      await tx2.prove()
      await tx2.send()

      const tx3 = await Mina.transaction(context.sender.publicKey, () => {
        context.tokenAContract.setTotalSupply(totalSupply)
      })
      tx3.sign([context.sender.privateKey, context.tokenAdmin.privateKey])
      await tx3.prove()
      await expect(async () => await tx3.send()).rejects.toThrow()
    })
  })

  describe("transfers", () => {
    const sendAmount = UInt64.from(1)

    it("should do a transfer initiated by the token contract", async () => {
      const initialBalanceSender = context.tokenAContract.getBalanceOf(context.sender.publicKey)
        .toBigInt()
      const initialBalanceReceiver = context.tokenAContract.getBalanceOf(context.receiver.publicKey)
        .toBigInt()

      const tx = await Mina.transaction(context.sender.publicKey, () => {
        AccountUpdate.fundNewAccount(context.sender.publicKey, 1)
        context.tokenAContract.transfer(
          context.sender.publicKey,
          context.receiver.publicKey,
          sendAmount,
        )
      })
      tx.sign([context.sender.privateKey])
      await tx.prove()
      await tx.send()

      expect(context.tokenAContract.getBalanceOf(context.sender.publicKey).toBigInt())
        .toBe(initialBalanceSender - sendAmount.toBigInt())
      expect(context.tokenAContract.getBalanceOf(context.receiver.publicKey).toBigInt())
        .toBe(initialBalanceReceiver + sendAmount.toBigInt())
    })

    it("should reject a transaction not signed by the token holder", async () => {
      const tx = await Mina.transaction(context.sender.publicKey, () => {
        context.tokenAContract.transfer(
          context.sender.publicKey,
          context.receiver.publicKey,
          sendAmount,
        )
      })
      await tx.prove()
      await expect(async () => await tx.send()).rejects.toThrow()
    })

    it("should do a transaction constructed manually, approved by the token contract", async () => {
      const initialBalanceSender = context.tokenAContract.getBalanceOf(context.sender.publicKey)
        .toBigInt()
      const initialBalanceReceiver = context.tokenAContract.getBalanceOf(context.receiver.publicKey)
        .toBigInt()
      const updateSend = AccountUpdate.createSigned(
        context.sender.publicKey,
        context.tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        context.receiver.publicKey,
        context.tokenAContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount)

      const tx = await Mina.transaction(context.deployer.publicKey, () => {
        context.tokenAContract.approveAccountUpdates([updateSend, updateReceive])
      })
      await tx.sign([context.sender.privateKey, context.deployer.privateKey]).prove()
      await tx.send()

      expect(context.tokenAContract.getBalanceOf(context.sender.publicKey).toBigInt())
        .toBe(initialBalanceSender - sendAmount.toBigInt())
      expect(context.tokenAContract.getBalanceOf(context.receiver.publicKey).toBigInt())
        .toBe(initialBalanceReceiver + sendAmount.toBigInt())
    })

    it("should reject unbalanced transactions", async () => {
      const updateSend = AccountUpdate.createSigned(
        context.sender.publicKey,
        context.tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        context.receiver.publicKey,
        context.tokenAContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount).mul(2)
      await expect(async () => (
        await Mina.transaction(context.deployer.publicKey, () => {
          context.tokenAContract.approveAccountUpdates([updateSend, updateReceive])
        })
      )).rejects.toThrowError()
    })

    it("rejects transactions with mismatched tokens", async () => {
      const updateSend = AccountUpdate.createSigned(
        context.sender.publicKey,
        context.tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        context.receiver.publicKey,
        context.tokenBContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount)
      await expect(async () => (
        await Mina.transaction(context.deployer.publicKey, () => {
          AccountUpdate.fundNewAccount(context.sender.publicKey, 1)
          context.tokenAContract.approveAccountUpdate(updateSend)
          context.tokenBContract.approveAccountUpdate(updateReceive)
        })
      )).rejects.toThrowError()
    })
  })

  describe("third party", () => {
    const depositAmount = UInt64.from(100)

    it("should deposit from the user to the token account of the third party", async () => {
      const initialBalance = context.tokenAContract.getBalanceOf(context.sender.publicKey)
        .toBigInt()

      const tokenId = context.tokenAContract.deriveTokenId()

      const updateWithdraw = AccountUpdate.createSigned(context.sender.publicKey, tokenId)
      updateWithdraw.balanceChange = Int64.fromUnsigned(depositAmount).neg()

      const updateDeposit = context.thirdPartyAContract.deposit(depositAmount)
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent

      const tx = await Mina.transaction(context.sender.publicKey, () => {
        AccountUpdate.fundNewAccount(context.sender.publicKey, 1)
        context.tokenAContract.approveBase(AccountUpdateForest.fromFlatArray([
          updateWithdraw,
          updateDeposit,
        ]))
      })

      tx.sign([context.sender.privateKey])

      await tx.prove()
      await tx.send()

      expect(
        context.tokenAContract.getBalanceOf(context.thirdPartyA.publicKey).toBigInt(),
      ).toBe(depositAmount.toBigInt())

      expect(
        context.tokenAContract.getBalanceOf(context.sender.publicKey).toBigInt(),
      ).toBe(initialBalance - depositAmount.toBigInt())
    })

    it("should send tokens from one contract to another", async () => {
      const initialBalance = context.tokenAContract.getBalanceOf(context.thirdPartyA.publicKey)
        .toBigInt()
      const initialBalance2 = context.tokenAContract.getBalanceOf(context.thirdPartyB.publicKey)
        .toBigInt()
      const transferAmount = UInt64.from(1)
      const updateWithdraw = context.thirdPartyAContract.withdraw(transferAmount)
      const updateDeposit = context.thirdPartyBContract.deposit(transferAmount)
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent
      const tx = await Mina.transaction(context.sender.publicKey, () => {
        AccountUpdate.fundNewAccount(context.sender.publicKey, 1)
        context.tokenAContract.approveBase(AccountUpdateForest.fromFlatArray([
          updateWithdraw,
          updateDeposit,
        ]))
      })
      await tx.sign([context.sender.privateKey, context.thirdPartyA.privateKey]).prove()
      await tx.send()

      expect(
        context.tokenAContract.getBalanceOf(context.thirdPartyA.publicKey).toBigInt(),
      ).toBe(initialBalance - transferAmount.toBigInt())
      expect(
        context.tokenAContract.getBalanceOf(context.thirdPartyB.publicKey).toBigInt(),
      ).toBe(initialBalance2 + transferAmount.toBigInt())
    })

    it("should reject an unbalanced transaction", async () => {
      const depositAmount = UInt64.from(10)
      const withdrawAmount = UInt64.from(5)
      const updateWithdraw = context.thirdPartyAContract.withdraw(withdrawAmount)
      const updateDeposit = context.thirdPartyBContract.deposit(depositAmount)
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent
      await expect(async () => (
        await Mina.transaction(context.sender.publicKey, () => {
          AccountUpdate.fundNewAccount(context.sender.publicKey, 1)
          context.tokenAContract.approveBase(AccountUpdateForest.fromFlatArray([
            updateWithdraw,
            updateDeposit,
          ]))
        })
      )).rejects.toThrowError()
    })
  })
})

export default class ThirdParty extends SmartContract {
  @state(PublicKey)
  ownerAddress = State<PublicKey>()

  public get tokenOwner() {
    this.ownerAddress.requireEquals(this.ownerAddress.get())
    return new FungibleToken(this.ownerAddress.get())
  }

  deploy(args: DeployArgs & { ownerAddress: PublicKey }) {
    super.deploy(args)
    this.ownerAddress.set(args.ownerAddress)
  }

  @method
  public deposit(amount: UInt64): AccountUpdate {
    const accountUpdate = AccountUpdate.create(this.address, this.tokenOwner.deriveTokenId())
    accountUpdate.balanceChange = Int64.fromUnsigned(amount)
    return accountUpdate
  }

  @method
  public withdraw(amount: UInt64): AccountUpdate {
    const accountUpdate = AccountUpdate.create(this.address, this.tokenOwner.deriveTokenId())
    accountUpdate.balanceChange = Int64.fromUnsigned(amount).neg()
    accountUpdate.requireSignature()
    return accountUpdate
  }
}
