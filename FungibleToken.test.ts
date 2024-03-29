import { equal, rejects } from "node:assert"
import { before, describe, it } from "node:test"
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

describe("token integration", () => {
  let deployer: TestAccount
  let sender: TestAccount
  let receiver: TestAccount
  let tokenAdmin: TestAccount
  let newTokenAdmin: TestAccount
  let tokenA: TestAccount
  let tokenAContract: FungibleToken
  let tokenB: TestAccount
  let tokenBContract: FungibleToken
  let thirdPartyA: TestAccount
  let thirdPartyAContract: ThirdParty
  let thirdPartyB: TestAccount
  let thirdPartyBContract: ThirdParty

  before(async () => {
    const Local = Mina.LocalBlockchain({
      proofsEnabled: false,
      enforceTransactionLimits: false,
    })
    Mina.setActiveInstance(Local)

    await FungibleToken.compile()
    ;[deployer, sender, receiver] = Local.testAccounts as TestAccounts

    // Key pairs for non-Mina accounts
    tokenAdmin = PrivateKey.randomKeypair()
    newTokenAdmin = PrivateKey.randomKeypair()

    tokenA = PrivateKey.randomKeypair()
    tokenAContract = new FungibleToken(tokenA.publicKey)

    tokenB = PrivateKey.randomKeypair()
    tokenBContract = new FungibleToken(tokenB.publicKey)

    thirdPartyA = PrivateKey.randomKeypair()
    thirdPartyAContract = new ThirdParty(thirdPartyA.publicKey)

    thirdPartyB = PrivateKey.randomKeypair()
    thirdPartyBContract = new ThirdParty(thirdPartyB.publicKey)
  })

  const totalSupply = UInt64.from(10_000_000_000_000)

  describe("deploy", () => {
    it("should deploy token contract A", async () => {
      const tx = await Mina.transaction(deployer.publicKey, () => {
        AccountUpdate.fundNewAccount(deployer.publicKey, 1)
        tokenAContract.deploy({
          adminPublicKey: tokenAdmin.publicKey,
          totalSupply: totalSupply,
          tokenSymbol: "tokA",
          zkAppURI: "",
        })
      })

      tx.sign([deployer.privateKey, tokenA.privateKey])

      await tx.prove()
      await tx.send()
    })

    it("should deploy token contract B", async () => {
      const tx = await Mina.transaction(deployer.publicKey, () => {
        AccountUpdate.fundNewAccount(deployer.publicKey, 1)
        tokenBContract.deploy({
          adminPublicKey: tokenAdmin.publicKey,
          totalSupply: totalSupply,
          tokenSymbol: "tokB",
          zkAppURI: "",
        })
      })

      tx.sign([deployer.privateKey, tokenB.privateKey])

      await tx.prove()
      await tx.send()
    })

    it("should deploy a third party contract", async () => {
      const tx = await Mina.transaction(deployer.publicKey, () => {
        AccountUpdate.fundNewAccount(deployer.publicKey, 2)
        thirdPartyAContract.deploy({ ownerAddress: tokenA.publicKey })
        thirdPartyBContract.deploy({ ownerAddress: tokenA.publicKey })
      })

      tx.sign([
        deployer.privateKey,
        thirdPartyA.privateKey,
        thirdPartyB.privateKey,
      ])

      await tx.prove()
      await tx.send()
    })
  })

  describe("admin", () => {
    const mintAmount = UInt64.from(1000)
    const burnAmount = UInt64.from(100)

    it("should mint for the sender account", async () => {
      const initialBalance = tokenAContract.getBalanceOf(sender.publicKey)
        .toBigInt()

      const tx = await Mina.transaction(sender.publicKey, () => {
        AccountUpdate.fundNewAccount(sender.publicKey, 2)
        tokenAContract.mint(sender.publicKey, mintAmount)
      })

      tx.sign([sender.privateKey, tokenAdmin.privateKey])
      await tx.prove()
      await tx.send()

      equal(
        tokenAContract.getBalanceOf(sender.publicKey).toBigInt(),
        initialBalance + mintAmount.toBigInt(),
      )
    })

    it("should burn tokens for the sender account", async () => {
      const initialBalance = tokenAContract.getBalanceOf(sender.publicKey)
        .toBigInt()

      const tx = await Mina.transaction(sender.publicKey, () => {
        tokenAContract.burn(sender.publicKey, burnAmount)
      })

      tx.sign([sender.privateKey])
      await tx.prove()
      await tx.send()

      equal(
        tokenAContract.getBalanceOf(sender.publicKey).toBigInt(),
        initialBalance - burnAmount.toBigInt(),
      )
    })

    it("should refuse to mint tokens without signature from the token admin", async () => {
      const tx = await Mina.transaction(sender.publicKey, () => {
        tokenAContract.mint(sender.publicKey, mintAmount)
      })

      tx.sign([sender.privateKey])
      await tx.prove()
      await rejects(() => tx.send())
    })

    it("should refuse to burn tokens without signature from the token holder", async () => {
      const tx = await Mina.transaction(sender.publicKey, () => {
        tokenAContract.burn(sender.publicKey, burnAmount)
      })

      await tx.prove()
      await rejects(() => tx.send())
    })

    it("should refuse to set total supply to be less than circulating supply", async () => {
      await rejects(() =>
        Mina.transaction(sender.publicKey, () => {
          tokenAContract.setTotalSupply(UInt64.from(1))
        })
      )
    })

    it("correctly changes the adminAccount", async () => {
      const tx = await Mina.transaction(sender.publicKey, () => {
        tokenAContract.setAdminAccount(newTokenAdmin.publicKey)
      })
      tx.sign([sender.privateKey, tokenAdmin.privateKey])
      await tx.prove()
      await tx.send()

      const tx2 = await Mina.transaction(sender.publicKey, () => {
        AccountUpdate.fundNewAccount(sender.publicKey, 1)
        tokenAContract.setTotalSupply(totalSupply)
      })
      tx2.sign([sender.privateKey, newTokenAdmin.privateKey])
      await tx2.prove()
      await tx2.send()

      const tx3 = await Mina.transaction(sender.publicKey, () => {
        tokenAContract.setTotalSupply(totalSupply)
      })
      tx3.sign([sender.privateKey, tokenAdmin.privateKey])
      await tx3.prove()
      await rejects(() => tx3.send())
    })
  })

  describe("transfers", () => {
    const sendAmount = UInt64.from(1)

    it("should do a transfer initiated by the token contract", async () => {
      const initialBalanceSender = tokenAContract.getBalanceOf(sender.publicKey)
        .toBigInt()
      const initialBalanceReceiver = tokenAContract.getBalanceOf(receiver.publicKey)
        .toBigInt()

      const tx = await Mina.transaction(sender.publicKey, () => {
        AccountUpdate.fundNewAccount(sender.publicKey, 1)
        tokenAContract.transfer(
          sender.publicKey,
          receiver.publicKey,
          sendAmount,
        )
      })
      tx.sign([sender.privateKey])
      await tx.prove()
      await tx.send()

      equal(
        tokenAContract.getBalanceOf(sender.publicKey).toBigInt(),
        initialBalanceSender - sendAmount.toBigInt(),
      )
      equal(
        tokenAContract.getBalanceOf(receiver.publicKey).toBigInt(),
        initialBalanceReceiver + sendAmount.toBigInt(),
      )
    })

    it("should reject a transaction not signed by the token holder", async () => {
      const tx = await Mina.transaction(sender.publicKey, () => {
        tokenAContract.transfer(
          sender.publicKey,
          receiver.publicKey,
          sendAmount,
        )
      })
      await tx.prove()
      await rejects(() => tx.send())
    })

    it("should do a transaction constructed manually, approved by the token contract", async () => {
      const initialBalanceSender = tokenAContract.getBalanceOf(sender.publicKey)
        .toBigInt()
      const initialBalanceReceiver = tokenAContract.getBalanceOf(receiver.publicKey)
        .toBigInt()
      const updateSend = AccountUpdate.createSigned(
        sender.publicKey,
        tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        receiver.publicKey,
        tokenAContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount)

      const tx = await Mina.transaction(deployer.publicKey, () => {
        tokenAContract.approveAccountUpdates([updateSend, updateReceive])
      })
      await tx.sign([sender.privateKey, deployer.privateKey]).prove()
      await tx.send()

      equal(
        tokenAContract.getBalanceOf(sender.publicKey).toBigInt(),
        initialBalanceSender - sendAmount.toBigInt(),
      )
      equal(
        tokenAContract.getBalanceOf(receiver.publicKey).toBigInt(),
        initialBalanceReceiver + sendAmount.toBigInt(),
      )
    })

    it("should reject unbalanced transactions", async () => {
      const updateSend = AccountUpdate.createSigned(
        sender.publicKey,
        tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        receiver.publicKey,
        tokenAContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount).mul(2)
      await rejects(() =>
        Mina.transaction(deployer.publicKey, () => {
          tokenAContract.approveAccountUpdates([updateSend, updateReceive])
        })
      )
    })

    it("rejects transactions with mismatched tokens", async () => {
      const updateSend = AccountUpdate.createSigned(
        sender.publicKey,
        tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        receiver.publicKey,
        tokenBContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount)
      await rejects(() => (
        Mina.transaction(deployer.publicKey, () => {
          AccountUpdate.fundNewAccount(sender.publicKey, 1)
          tokenAContract.approveAccountUpdate(updateSend)
          tokenBContract.approveAccountUpdate(updateReceive)
        })
      ))
    })
  })

  describe("third party", () => {
    const depositAmount = UInt64.from(100)

    it("should deposit from the user to the token account of the third party", async () => {
      const initialBalance = tokenAContract.getBalanceOf(sender.publicKey)
        .toBigInt()

      const tokenId = tokenAContract.deriveTokenId()

      const updateWithdraw = AccountUpdate.createSigned(sender.publicKey, tokenId)
      updateWithdraw.balanceChange = Int64.fromUnsigned(depositAmount).neg()

      const updateDeposit = thirdPartyAContract.deposit(depositAmount)
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent

      const tx = await Mina.transaction(sender.publicKey, () => {
        AccountUpdate.fundNewAccount(sender.publicKey, 1)
        tokenAContract.approveBase(AccountUpdateForest.fromFlatArray([
          updateWithdraw,
          updateDeposit,
        ]))
      })

      tx.sign([sender.privateKey])

      await tx.prove()
      await tx.send()

      equal(
        tokenAContract.getBalanceOf(thirdPartyA.publicKey).toBigInt(),
        depositAmount.toBigInt(),
      )
      equal(
        tokenAContract.getBalanceOf(sender.publicKey).toBigInt(),
        initialBalance - depositAmount.toBigInt(),
      )
    })

    it("should send tokens from one contract to another", async () => {
      const initialBalance = tokenAContract.getBalanceOf(thirdPartyA.publicKey)
        .toBigInt()
      const initialBalance2 = tokenAContract.getBalanceOf(thirdPartyB.publicKey)
        .toBigInt()
      const transferAmount = UInt64.from(1)
      const updateWithdraw = thirdPartyAContract.withdraw(transferAmount)
      const updateDeposit = thirdPartyBContract.deposit(transferAmount)
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent
      const tx = await Mina.transaction(sender.publicKey, () => {
        AccountUpdate.fundNewAccount(sender.publicKey, 1)
        tokenAContract.approveBase(AccountUpdateForest.fromFlatArray([
          updateWithdraw,
          updateDeposit,
        ]))
      })
      await tx.sign([sender.privateKey, thirdPartyA.privateKey]).prove()
      await tx.send()

      equal(
        tokenAContract.getBalanceOf(thirdPartyA.publicKey).toBigInt(),
        initialBalance - transferAmount.toBigInt(),
      )
      equal(
        tokenAContract.getBalanceOf(thirdPartyB.publicKey).toBigInt(),
        initialBalance2 + transferAmount.toBigInt(),
      )
    })

    it("should reject an unbalanced transaction", async () => {
      const depositAmount = UInt64.from(10)
      const withdrawAmount = UInt64.from(5)
      const updateWithdraw = thirdPartyAContract.withdraw(withdrawAmount)
      const updateDeposit = thirdPartyBContract.deposit(depositAmount)
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent
      await rejects(() =>
        Mina.transaction(sender.publicKey, () => {
          AccountUpdate.fundNewAccount(sender.publicKey, 1)
          tokenAContract.approveBase(AccountUpdateForest.fromFlatArray([
            updateWithdraw,
            updateDeposit,
          ]))
        })
      )
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
