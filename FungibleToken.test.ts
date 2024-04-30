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
import { TestPublicKey } from "o1js/dist/node/lib/mina/local-blockchain.js"
import { FungibleToken } from "./index.js"
import { TestAccount } from "./test_util.js"

const proofsEnabled = false

const devnet = await Mina.LocalBlockchain({
  proofsEnabled: proofsEnabled,
  enforceTransactionLimits: false,
})
Mina.setActiveInstance(devnet)

describe("token integration", () => {
  let deployer: TestPublicKey
  let sender: TestPublicKey
  let receiver: TestPublicKey
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
    ;[deployer, sender, receiver] = devnet.testAccounts

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

    if (proofsEnabled) {
      await FungibleToken.compile()
      await ThirdParty.compile()
    }
  })

  const totalSupply = UInt64.from(10_000_000_000_000)

  describe("deploy", () => {
    it("should deploy token contract A", async () => {
      const tx = await Mina.transaction({
        sender: deployer,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(deployer, 1)
        await tokenAContract.deploy({
          owner: tokenAdmin.publicKey,
          supply: totalSupply,
          symbol: "tokA",
          src: "",
        })
      })

      tx.sign([deployer.key, tokenA.privateKey])

      await tx.prove()
      await tx.send()
    })

    it("should deploy token contract B", async () => {
      const tx = await Mina.transaction({
        sender: deployer,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(deployer, 1)
        tokenBContract.deploy({
          owner: tokenAdmin.publicKey,
          supply: totalSupply,
          symbol: "tokB",
          src: "",
        })
      })

      tx.sign([deployer.key, tokenB.privateKey])

      await tx.prove()
      await tx.send()
    })

    it("should deploy a third party contract", async () => {
      const tx = await Mina.transaction({
        sender: deployer,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(deployer, 2)
        await thirdPartyAContract.deploy({ ownerAddress: tokenA.publicKey })
        await thirdPartyBContract.deploy({ ownerAddress: tokenA.publicKey })
      })

      tx.sign([deployer.key, thirdPartyA.privateKey, thirdPartyB.privateKey])

      await tx.prove()
      await tx.send()
    })
  })

  describe("admin", () => {
    const mintAmount = UInt64.from(1000)
    const burnAmount = UInt64.from(100)

    it("should mint for the sender account", async () => {
      const initialBalance = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()

      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(sender, 2)
        tokenAContract.mint(sender, mintAmount)
      })

      tx.sign([sender.key, tokenAdmin.privateKey])
      await tx.prove()
      await tx.send()

      equal(
        (await tokenAContract.getBalanceOf(sender)).toBigInt(),
        initialBalance + mintAmount.toBigInt(),
      )
    })

    it("should burn tokens for the sender account", async () => {
      const initialBalance = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()

      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        tokenAContract.burn(sender, burnAmount)
      })

      tx.sign([sender.key])
      await tx.prove()
      await tx.send()

      equal(
        (await tokenAContract.getBalanceOf(sender)).toBigInt(),
        initialBalance - burnAmount.toBigInt(),
      )
    })

    it("should refuse to mint tokens without signature from the token admin", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        tokenAContract.mint(sender, mintAmount)
      })

      tx.sign([sender.key])
      await tx.prove()
      await rejects(() => tx.send())
    })

    it("should refuse to burn tokens without signature from the token holder", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        tokenAContract.burn(sender, burnAmount)
      })

      await tx.prove()
      await rejects(() => tx.send())
    })

    it("should refuse to set total supply to be less than circulating supply", async () => {
      await rejects(async () =>
        await Mina.transaction({
          sender: sender,
          fee: 1e8,
        }, async () => {
          await tokenAContract.setSupply(UInt64.from(1))
        })
      )
    })

    it("correctly changes the adminAccount", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        tokenAContract.setOwner(newTokenAdmin.publicKey)
      })
      tx.sign([sender.key, tokenAdmin.privateKey])
      await tx.prove()
      await tx.send()

      const tx2 = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(sender, 1)
        tokenAContract.setSupply(totalSupply)
      })
      tx2.sign([sender.key, newTokenAdmin.privateKey])
      await tx2.prove()
      await tx2.send()

      const tx3 = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        tokenAContract.setSupply(totalSupply)
      })
      tx3.sign([sender.key, tokenAdmin.privateKey])
      await tx3.prove()
      await rejects(() => tx3.send())
    })
  })

  describe("transfers", () => {
    const sendAmount = UInt64.from(1)

    it("should do a transfer initiated by the token contract", async () => {
      const initialBalanceSender = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()
      const initialBalanceReceiver = (await tokenAContract.getBalanceOf(receiver))
        .toBigInt()

      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(sender, 1)
        await tokenAContract.transfer(
          sender,
          receiver,
          sendAmount,
        )
      })

      tx.sign([sender.key])
      await tx.prove()
      await tx.send()

      equal(
        (await tokenAContract.getBalanceOf(sender)).toBigInt(),
        initialBalanceSender - sendAmount.toBigInt(),
      )
      equal(
        (await tokenAContract.getBalanceOf(receiver)).toBigInt(),
        initialBalanceReceiver + sendAmount.toBigInt(),
      )
    })

    it("should reject a transaction not signed by the token holder", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenAContract.transfer(sender, receiver, sendAmount)
      })
      await tx.prove()
      await rejects(() => tx.send())
    })

    it("should do a transaction constructed manually, approved by the token contract", async () => {
      const initialBalanceSender = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()
      const initialBalanceReceiver = (await tokenAContract.getBalanceOf(receiver))
        .toBigInt()
      const updateSend = AccountUpdate.createSigned(
        sender,
        tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        receiver,
        tokenAContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount)

      const tx = await Mina.transaction({
        sender: deployer,
        fee: 1e8,
      }, async () => {
        await tokenAContract.approveAccountUpdates([updateSend, updateReceive])
      })
      await tx.sign([sender.key, deployer.key]).prove()
      await tx.send()

      equal(
        (await tokenAContract.getBalanceOf(sender)).toBigInt(),
        initialBalanceSender - sendAmount.toBigInt(),
      )
      equal(
        (await tokenAContract.getBalanceOf(receiver)).toBigInt(),
        initialBalanceReceiver + sendAmount.toBigInt(),
      )
    })

    it("should reject unbalanced transactions", async () => {
      const updateSend = AccountUpdate.createSigned(
        sender,
        tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        receiver,
        tokenAContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount).mul(2)
      await rejects(() =>
        Mina.transaction(deployer, async () => {
          await tokenAContract.approveAccountUpdates([updateSend, updateReceive])
        })
      )
    })

    it("rejects transactions with mismatched tokens", async () => {
      const updateSend = AccountUpdate.createSigned(
        sender,
        tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        receiver,
        tokenBContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount)
      await rejects(() => (
        Mina.transaction({
          sender: deployer,
          fee: 1e8,
        }, async () => {
          AccountUpdate.fundNewAccount(sender, 1)
          await tokenAContract.approveAccountUpdates([updateSend])
          await tokenBContract.approveAccountUpdates([updateReceive])
        })
      ))
    })
  })

  describe("third party", () => {
    const depositAmount = UInt64.from(100)

    it("should deposit from the user to the token account of the third party", async () => {
      const initialBalance = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()

      const tokenId = tokenAContract.deriveTokenId()

      const updateWithdraw = AccountUpdate.createSigned(sender, tokenId)
      updateWithdraw.balanceChange = Int64.fromUnsigned(depositAmount).neg()

      const updateDeposit = await thirdPartyAContract.deposit(depositAmount)
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent

      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(sender, 1)
        await tokenAContract.approveBase(AccountUpdateForest.fromFlatArray([
          updateWithdraw,
          updateDeposit,
        ]))
      })

      tx.sign([sender.key])

      await tx.prove()
      await tx.send()

      equal(
        (await tokenAContract.getBalanceOf(thirdPartyA.publicKey)).toBigInt(),
        depositAmount.toBigInt(),
      )
      equal(
        (await tokenAContract.getBalanceOf(sender)).toBigInt(),
        initialBalance - depositAmount.toBigInt(),
      )
    })

    it("should send tokens from one contract to another", async () => {
      const initialBalance = (await tokenAContract.getBalanceOf(thirdPartyA.publicKey))
        .toBigInt()
      const initialBalance2 = (await tokenAContract.getBalanceOf(thirdPartyB.publicKey))
        .toBigInt()
      const transferAmount = UInt64.from(1)
      const updateWithdraw = await thirdPartyAContract.withdraw(transferAmount)
      const updateDeposit = await thirdPartyBContract.deposit(transferAmount)
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(sender, 1)
        await tokenAContract.approveBase(AccountUpdateForest.fromFlatArray([
          updateWithdraw,
          updateDeposit,
        ]))
      })
      await tx.sign([sender.key, thirdPartyA.privateKey]).prove()
      await tx.send()

      equal(
        (await tokenAContract.getBalanceOf(thirdPartyA.publicKey)).toBigInt(),
        initialBalance - transferAmount.toBigInt(),
      )
      equal(
        (await tokenAContract.getBalanceOf(thirdPartyB.publicKey)).toBigInt(),
        initialBalance2 + transferAmount.toBigInt(),
      )
    })

    it("should reject an unbalanced transaction", async () => {
      const depositAmount = UInt64.from(10)
      const withdrawAmount = UInt64.from(5)
      const updateWithdraw = await thirdPartyAContract.withdraw(withdrawAmount)
      const updateDeposit = await thirdPartyBContract.deposit(depositAmount)
      updateDeposit.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent
      await rejects(() =>
        Mina.transaction({
          sender: sender,
          fee: 1e8,
        }, async () => {
          AccountUpdate.fundNewAccount(sender, 1)
          await tokenAContract.approveBase(AccountUpdateForest.fromFlatArray([
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
    return new FungibleToken(this.ownerAddress.getAndRequireEquals())
  }

  async deploy(args: DeployArgs & { ownerAddress: PublicKey }) {
    await super.deploy(args)
    this.ownerAddress.set(args.ownerAddress)
  }

  @method.returns(AccountUpdate)
  public async deposit(amount: UInt64) {
    const accountUpdate = AccountUpdate.create(this.address, this.tokenOwner.deriveTokenId())
    accountUpdate.balanceChange = Int64.fromUnsigned(amount)
    return accountUpdate
  }

  @method.returns(AccountUpdate)
  public async withdraw(amount: UInt64) {
    const accountUpdate = AccountUpdate.create(this.address, this.tokenOwner.deriveTokenId())
    accountUpdate.balanceChange = Int64.fromUnsigned(amount).neg()
    accountUpdate.requireSignature()
    return accountUpdate
  }
}
