import { equal, rejects } from "node:assert"
import { describe, it } from "node:test"
import {
  AccountUpdate,
  AccountUpdateForest,
  Bool,
  DeployArgs,
  Int64,
  method,
  Mina,
  Permissions,
  PublicKey,
  SmartContract,
  State,
  state,
  UInt64,
  UInt8,
} from "o1js"
import {
  FungibleToken,
  FungibleTokenAdmin,
  FungibleTokenAdminBase,
  FungibleTokenAdminDeployProps,
  FungibleTokenErrors,
} from "./index.js"

const proofsEnabled = process.env.SKIP_PROOFS !== "true"
if (!proofsEnabled) console.log("Skipping proof generation in tests.")

const localChain = await Mina.LocalBlockchain({
  proofsEnabled,
  enforceTransactionLimits: false,
})
Mina.setActiveInstance(localChain)

describe("token integration", async () => {
  {
    await FungibleToken.compile()
    await ThirdParty.compile()
    await FungibleTokenAdmin.compile()
    await CustomTokenAdmin.compile()
  }

  const [
    tokenAdmin,
    newTokenAdmin,
    tokenA,
    tokenBAdmin,
    tokenB,
    thirdPartyA,
    thirdPartyB,
  ] = Mina.TestPublicKey.random(7)
  const [deployer, sender, receiver] = localChain.testAccounts
  const tokenAdminContract = new FungibleTokenAdmin(tokenAdmin)
  const newTokenAdminContract = new FungibleTokenAdmin(newTokenAdmin)
  const tokenAContract = new FungibleToken(tokenA)
  const tokenBAdminContract = new CustomTokenAdmin(tokenBAdmin)
  const tokenBContract = new FungibleToken(tokenB)
  const thirdPartyAContract = new ThirdParty(thirdPartyA)
  const thirdPartyBContract = new ThirdParty(thirdPartyB)

  describe("deploy", () => {
    it("should deploy token contract A", async () => {
      const tx = await Mina.transaction({
        sender: deployer,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(deployer, 3)
        await tokenAdminContract.deploy({
          adminPublicKey: tokenAdmin,
        })
        await tokenAContract.deploy({
          symbol: "tokA",
          src: "https://github.com/MinaFoundation/mina-fungible-token/blob/main/FungibleToken.ts",
        })
        await tokenAContract.initialize(
          tokenAdmin,
          UInt8.from(9),
          Bool(true),
        )
      })

      tx.sign([
        deployer.key,
        tokenA.key,
        tokenAdmin.key,
      ])

      await tx.prove()
      await tx.send()
    })

    it("should deploy token contract B", async () => {
      const tx = await Mina.transaction({
        sender: deployer,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(deployer, 3)
        await tokenBAdminContract.deploy({
          adminPublicKey: tokenBAdmin,
        })
        await tokenBContract.deploy({
          symbol: "tokB",
          src: "https://github.com/MinaFoundation/mina-fungible-token/blob/main/FungibleToken.ts",
        })
        await tokenBContract.initialize(
          tokenBAdmin,
          UInt8.from(9),
          Bool(false),
        )
      })

      tx.sign([deployer.key, tokenB.key, tokenBAdmin.key])

      await tx.prove()
      await tx.send()
    })

    it("should deploy a third party contract", async () => {
      const tx = await Mina.transaction({
        sender: deployer,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(deployer, 2)
        await thirdPartyAContract.deploy({ ownerAddress: tokenA })
        await thirdPartyBContract.deploy({ ownerAddress: tokenA })
      })

      tx.sign([deployer.key, thirdPartyA.key, thirdPartyB.key])

      await tx.prove()
      await tx.send()
    })

    it("should prevent calling `initialize()` a second time", async () => {
      const tx = await Mina.transaction({
        sender: deployer,
        fee: 1e8,
      }, async () => {
        await tokenAContract.initialize(
          tokenAdmin,
          UInt8.from(9),
          Bool(true),
        )
      })

      tx.sign([
        deployer.key,
        tokenA.key,
      ])

      await tx.prove()
      await rejects(() => tx.send())
    })
  })

  describe("admin", () => {
    const mintAmount = UInt64.from(1000)
    const burnAmount = UInt64.from(100)

    it("should not mint before calling resume()", async () => {
      await rejects(async () =>
        await Mina.transaction({
          sender: sender,
          fee: 1e8,
        }, async () => {
          AccountUpdate.fundNewAccount(sender, 1)
          await tokenAContract.mint(sender, mintAmount)
        }), (err: Error) => {
        if (err.message.includes(FungibleTokenErrors.tokenPaused)) return true
        else return false
      })
    })
    it("should accept a call to resume()", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenAContract.resume()
      })
      tx.sign([sender.key, tokenAdmin.key])
      await tx.prove()
      await tx.send()
    })
    it("should mint for the sender and receiver account", async () => {
      const initialBalance = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()
      const initialCirculating = (await tokenAContract.getCirculating()).toBigInt()

      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(sender, 1)
        await tokenAContract.mint(sender, mintAmount)
      })

      tx.sign([sender.key, tokenAdmin.key])
      await tx.prove()
      await tx.send()

      const tx2 = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(sender, 1)
        await tokenAContract.mint(receiver, mintAmount)
      })

      tx2.sign([sender.key, tokenAdmin.key])
      await tx2.prove()
      await tx2.send()

      equal(
        (await tokenAContract.getBalanceOf(sender)).toBigInt(),
        initialBalance + mintAmount.toBigInt(),
      )
      equal(
        (await tokenAContract.getCirculating()).toBigInt(),
        initialCirculating + mintAmount.mul(UInt64.from(2)).toBigInt(),
      )
    })

    it("should burn tokens for the sender account", async () => {
      const initialBalance = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()
      const initialCirculating = (await tokenAContract.getCirculating()).toBigInt()

      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenAContract.burn(sender, burnAmount)
      })

      tx.sign([sender.key])
      await tx.prove()
      await tx.send()

      equal(
        (await tokenAContract.getBalanceOf(sender)).toBigInt(),
        initialBalance - burnAmount.toBigInt(),
      )
      equal(
        (await tokenAContract.getCirculating()).toBigInt(),
        initialCirculating - burnAmount.toBigInt(),
      )
    })

    it("should refuse to mint tokens without signature from the token admin", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenAContract.mint(sender, mintAmount)
      })

      tx.sign([sender.key])
      await tx.prove()
      await rejects(() => tx.send(), (err: Error) => {
        if (err.message.includes("required authorization was not provided")) return true
        else return false
      })
    })

    it("should refuse to burn tokens without signature from the token holder", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenAContract.burn(receiver, burnAmount)
      })

      tx.sign([sender.key])
      await tx.prove()
      await rejects(() => tx.send(), (err: Error) => {
        if (err.message.includes("Invalid signature on account_update 1")) return true
        else return false
      })
    })

    it("correctly changes the admin contract", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(sender, 1)
        await newTokenAdminContract.deploy({
          adminPublicKey: newTokenAdmin,
        })
        await tokenAContract.setAdmin(newTokenAdmin)
      })
      tx.sign([sender.key, tokenAdmin.key, newTokenAdmin.key])
      await tx.prove()
      await tx.send()

      const tx2 = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenAContract.mint(sender, mintAmount)
      })
      tx2.sign([sender.key, newTokenAdmin.key])
      await tx2.prove()
      await tx2.send()

      const tx3 = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenAContract.mint(sender, mintAmount)
      })
      tx3.sign([sender.key, tokenAdmin.key])
      await tx3.prove()
      await rejects(() => tx3.send(), (err: Error) => {
        if (err.message.includes("required authorization was not provided")) return true
        else return false
      })
    })
  })

  describe("transfers", () => {
    const sendAmount = UInt64.from(1)

    it("should do a transfer initiated by the token contract", async () => {
      const initialBalanceSender = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()
      const initialBalanceReceiver = (await tokenAContract.getBalanceOf(receiver))
        .toBigInt()
      const initialCirculating = (await tokenAContract.getCirculating()).toBigInt()

      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
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
      equal(
        (await tokenAContract.getCirculating()).toBigInt(),
        initialCirculating,
      )
    })

    it("should reject a transaction not signed by the token holder", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenAContract.transfer(receiver, sender, sendAmount)
      })

      tx.sign([sender.key])
      await tx.prove()
      await rejects(() => tx.send(), (err: Error) => {
        if (err.message.includes("Invalid signature on account_update 1")) return true
        else return false
      })
    })

    it("should do a transaction constructed manually, approved by the token contract", async () => {
      const initialBalanceSender = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()
      const initialBalanceReceiver = (await tokenAContract.getBalanceOf(receiver))
        .toBigInt()
      const initialCirculating = (await tokenAContract.getCirculating()).toBigInt()

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
      equal(
        (await tokenAContract.getCirculating()).toBigInt(),
        initialCirculating,
      )
    })

    it("should reject flash-minting transactions", async () => {
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
      await rejects(async () =>
        await Mina.transaction({
          sender: deployer,
          fee: 1e8,
        }, async () => {
          await tokenAContract.approveAccountUpdates([updateReceive, updateSend])
        }), (err: Error) => {
        if (err.message.includes(FungibleTokenErrors.flashMinting)) return true
        else return false
      })
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
        }), (err: Error) => {
        if (err.message.includes(FungibleTokenErrors.flashMinting)) return true
        else return false
      })
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
      await rejects(async () => (
        await Mina.transaction({
          sender: deployer,
          fee: 1e8,
        }, async () => {
          AccountUpdate.fundNewAccount(sender, 1)
          await tokenAContract.approveAccountUpdates([updateSend])
          await tokenBContract.approveAccountUpdates([updateReceive])
        }), (err: Error) => {
          if (err.message.includes(FungibleTokenErrors.flashMinting)) return true
          else return false
        }
      ))
    })

    it("Should prevent transfers from account that's tracking circulation", async () => {
      await rejects(() =>
        Mina.transaction({
          sender: sender,
          fee: 1e8,
        }, async () => {
          AccountUpdate.fundNewAccount(sender, 1)
          await tokenAContract.transfer(
            tokenA,
            receiver,
            sendAmount,
          )
        }), (err: Error) => {
        if (err.message.includes(FungibleTokenErrors.noTransferFromCirculation)) return true
        else return false
      })
    })

    it("Should prevent transfers to account that's tracking circulation", async () => {
      await rejects(() =>
        Mina.transaction({
          sender: sender,
          fee: 1e8,
        }, async () => {
          AccountUpdate.fundNewAccount(sender, 1)
          await tokenAContract.transfer(
            sender,
            tokenA,
            sendAmount,
          )
        }), (err: Error) => {
        if (err.message.includes(FungibleTokenErrors.noTransferFromCirculation)) return true
        else return false
      })
    })

    it("Should reject manually constructed transfers from the account that's tracking circulation", async () => {
      const updateSend = AccountUpdate.createSigned(
        tokenA,
        tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        receiver,
        tokenAContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount)

      await rejects(() =>
        Mina.transaction({
          sender: deployer,
          fee: 1e8,
        }, async () => {
          await tokenAContract.approveAccountUpdates([updateSend, updateReceive])
        }), (err: Error) => {
        if (err.message.includes(FungibleTokenErrors.noTransferFromCirculation)) return true
        else return false
      })
    })

    it("Should reject manually constructed transfers to the account that's tracking circulation", async () => {
      const updateSend = AccountUpdate.createSigned(
        sender,
        tokenAContract.deriveTokenId(),
      )
      updateSend.balanceChange = Int64.fromUnsigned(sendAmount).neg()
      const updateReceive = AccountUpdate.create(
        tokenA,
        tokenAContract.deriveTokenId(),
      )
      updateReceive.balanceChange = Int64.fromUnsigned(sendAmount)

      await rejects(() =>
        Mina.transaction({
          sender: deployer,
          fee: 1e8,
        }, async () => {
          await tokenAContract.approveAccountUpdates([updateSend, updateReceive])
        }), (err: Error) => {
        if (err.message.includes(FungibleTokenErrors.noTransferFromCirculation)) return true
        else return false
      })
    })
  })

  describe("account permissions", () => {
    it("should reject a transaction that's changing the account permission for receive", async () => {
      const permissions = localChain.getAccount(sender, tokenAContract.deriveTokenId()).permissions
      permissions.receive = Permissions.impossible()
      const updateSend = AccountUpdate.createSigned(
        sender,
        tokenAContract.deriveTokenId(),
      )
      updateSend.account.permissions.set(permissions)
      await rejects(() =>
        Mina.transaction({
          sender: sender,
          fee: 1e8,
        }, async () => {
          await tokenAContract.approveBase(AccountUpdateForest.fromFlatArray([updateSend]))
        }), (err: Error) => {
        if (err.message.includes(FungibleTokenErrors.noPermissionChangeAllowed)) return true
        else return false
      })
    })
  })

  describe("pausing/resuming", () => {
    const sendAmount = UInt64.from(1)

    it("can be paused by the admin", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenAContract.pause()
      })
      tx.sign([sender.key, newTokenAdmin.key])
      await tx.prove()
      await tx.send()
    })
    it("will block transactions while paused", async () => {
      await rejects(() =>
        Mina.transaction({
          sender: sender,
          fee: 1e8,
        }, async () => {
          await tokenAContract.transfer(sender, receiver, sendAmount)
        }), (err: Error) => {
        if (err.message.includes(FungibleTokenErrors.tokenPaused)) return true
        else return false
      })
    })
    it("can be resumed by the admin", async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenAContract.resume()
      })
      tx.sign([sender.key, newTokenAdmin.key])
      await tx.prove()
      await tx.send()
    })
    it("will accept transactions after resume", async () => {
      const initialBalanceSender = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()
      const initialBalanceReceiver = (await tokenAContract.getBalanceOf(receiver))
        .toBigInt()
      const initialCirculating = (await tokenAContract.getCirculating()).toBigInt()

      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
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
      equal(
        (await tokenAContract.getCirculating()).toBigInt(),
        initialCirculating,
      )
    })

    it("should prevent the deployer from minting without calling into the admin contract", async () => {
      const attackTx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        // AccountUpdate.fundNewAccount(sender, 1)
        let nopUpdate = AccountUpdate.default(tokenA, tokenAContract.tokenId)

        let maliciousUpdate = AccountUpdate.default(sender, tokenAContract.deriveTokenId())
        maliciousUpdate.balanceChange = new Int64(new UInt64(100n))
        maliciousUpdate.body.mayUseToken = {
          parentsOwnToken: new Bool(true),
          inheritFromParent: new Bool(false),
        }
        AccountUpdate.attachToTransaction(nopUpdate)

        nopUpdate.approve(maliciousUpdate)

        nopUpdate.requireSignature()
        maliciousUpdate.requireSignature()
      })

      await attackTx.prove()
      attackTx.sign([sender.key, tokenA.key])
      await rejects(() => attackTx.send())
    })
  })

  describe("third party", () => {
    const depositAmount = UInt64.from(100)

    it("should deposit from the user to the token account of the third party", async () => {
      const initialBalance = (await tokenAContract.getBalanceOf(sender))
        .toBigInt()
      const initialCirculating = (await tokenAContract.getCirculating()).toBigInt()

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
        (await tokenAContract.getBalanceOf(thirdPartyA)).toBigInt(),
        depositAmount.toBigInt(),
      )
      equal(
        (await tokenAContract.getBalanceOf(sender)).toBigInt(),
        initialBalance - depositAmount.toBigInt(),
      )
      equal(
        (await tokenAContract.getCirculating()).toBigInt(),
        initialCirculating,
      )
    })

    it("should send tokens from one contract to another", async () => {
      const initialBalance = (await tokenAContract.getBalanceOf(thirdPartyA))
        .toBigInt()
      const initialBalance2 = (await tokenAContract.getBalanceOf(thirdPartyB))
        .toBigInt()
      const initialCirculating = (await tokenAContract.getCirculating()).toBigInt()

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
      await tx.sign([sender.key, thirdPartyA.key]).prove()
      await tx.send()

      equal(
        (await tokenAContract.getBalanceOf(thirdPartyA)).toBigInt(),
        initialBalance - transferAmount.toBigInt(),
      )
      equal(
        (await tokenAContract.getBalanceOf(thirdPartyB)).toBigInt(),
        initialBalance2 + transferAmount.toBigInt(),
      )
      equal(
        (await tokenAContract.getCirculating()).toBigInt(),
        initialCirculating,
      )
    })

    it("should reject an unbalanced transaction", async () => {
      const depositAmount = UInt64.from(5)
      const withdrawAmount = UInt64.from(10)
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
        }), (err: Error) => {
        if (err.message.includes(FungibleTokenErrors.unbalancedTransaction)) return true
        else return false
      })
    })
  })

  describe("Custom Admin Contract", () => {
    const mintAmount = UInt64.from(500)
    const illegalMintAmount = UInt64.from(1000)
    const sendAmount = UInt64.from(100)

    it("should mint with a custom admin contract", async () => {
      FungibleToken.AdminContract = CustomTokenAdmin
      const initialBalance = (await tokenBContract.getBalanceOf(sender))
        .toBigInt()
      const initialCirculating = (await tokenBContract.getCirculating()).toBigInt()

      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(sender, 1)
        await tokenBContract.mint(sender, mintAmount)
      })

      tx.sign([sender.key])
      await tx.prove()
      await tx.send()

      equal(
        (await tokenBContract.getBalanceOf(sender)).toBigInt(),
        initialBalance + mintAmount.toBigInt(),
      )
      equal(
        (await tokenBContract.getCirculating()).toBigInt(),
        initialCirculating + mintAmount.toBigInt(),
      )
      FungibleToken.AdminContract = FungibleTokenAdmin
    })

    it("should send tokens without having the custom admin contract", async () => {
      const initialBalanceSender = (await tokenBContract.getBalanceOf(sender))
        .toBigInt()
      const initialBalanceReceiver = (await tokenBContract.getBalanceOf(receiver))
        .toBigInt()
      const initialCirculating = (await tokenBContract.getCirculating()).toBigInt()

      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        AccountUpdate.fundNewAccount(sender, 1)
        await tokenBContract.transfer(
          sender,
          receiver,
          sendAmount,
        )
      })

      tx.sign([sender.key])
      await tx.prove()
      await tx.send()

      equal(
        (await tokenBContract.getBalanceOf(sender)).toBigInt(),
        initialBalanceSender - sendAmount.toBigInt(),
      )
      equal(
        (await tokenBContract.getBalanceOf(receiver)).toBigInt(),
        initialBalanceReceiver + sendAmount.toBigInt(),
      )
      equal(
        (await tokenBContract.getCirculating()).toBigInt(),
        initialCirculating,
      )
    })

    it("should not mint too many B tokens", async () => {
      FungibleToken.AdminContract = CustomTokenAdmin
      await rejects(async () =>
        await Mina.transaction({
          sender: sender,
          fee: 1e8,
        }, async () => {
          await tokenBContract.mint(sender, illegalMintAmount)
        })
      )
      FungibleToken.AdminContract = FungibleTokenAdmin
    })
    it("should not mint too many B tokens using the vanilla admin contract", {
      skip: !proofsEnabled,
    }, async () => {
      const tx = await Mina.transaction({
        sender: sender,
        fee: 1e8,
      }, async () => {
        await tokenBContract.mint(sender, illegalMintAmount)
      })
      tx.sign([sender.key, tokenBAdmin.key])
      await tx.prove()
      await rejects(() => tx.send())
    })
  })
})

/** This is a faucet style admin contract, where anyone can mint, but only up to 500 tokens in a
 * single AccountUpdate */
class CustomTokenAdmin extends SmartContract implements FungibleTokenAdminBase {
  @state(PublicKey)
  private adminPublicKey = State<PublicKey>()

  async deploy(props: FungibleTokenAdminDeployProps) {
    await super.deploy(props)
    this.adminPublicKey.set(props.adminPublicKey)
  }

  private ensureAdminSignature() {
    const admin = this.adminPublicKey.getAndRequireEquals()
    return AccountUpdate.createSigned(admin)
  }

  @method.returns(Bool)
  public async canMint(accountUpdate: AccountUpdate) {
    return accountUpdate.body.balanceChange.magnitude.lessThanOrEqual(UInt64.from(500))
  }

  @method.returns(Bool)
  public async canChangeAdmin(_admin: PublicKey) {
    this.ensureAdminSignature()
    return Bool(true)
  }

  @method.returns(Bool)
  public async canPause(): Promise<Bool> {
    this.ensureAdminSignature()
    return Bool(true)
  }

  @method.returns(Bool)
  public async canResume(): Promise<Bool> {
    this.ensureAdminSignature()
    return Bool(true)
  }
}

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
