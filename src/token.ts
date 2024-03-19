/* eslint-disable max-statements */
/* eslint-disable max-lines */
/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */

import {
  AccountUpdate,
  Bool,
  method,
  PublicKey,
  UInt64,
  Account,
  state,
  State,
  VerificationKey,
  Int64,
  Provable,
  TokenContract,
  AccountUpdateForest,
} from 'o1js';

import errors from './errors';
import {
  AdminAction,
  type Pausable,
  type Burnable,
  type Mintable,
  type Upgradable,
} from './interfaces/token/adminable';
// eslint-disable-next-line putout/putout
import type Viewable from './interfaces/token/viewable';
// eslint-disable-next-line no-duplicate-imports
import type { Transferable } from './interfaces';
import Hooks from './Hooks';
import type Hookable from './interfaces/token/hookable';
import Approvable from './interfaces/token/approvable';

class Token
  extends TokenContract
  implements
    Approvable,
    Hookable,
    Mintable,
    Burnable,
    Viewable,
    Pausable,
    Transferable,
    Upgradable
{

  // eslint-disable-next-line no-warning-comments
  // TODO: check how many decimals mina has by default
  public static defaultDecimals = 9;

  @state(PublicKey) public hooks = State<PublicKey>();

  @state(UInt64) public totalSupply = State<UInt64>();

  @state(UInt64) public circulatingSupply = State<UInt64>();

  @state(Bool) public paused = State<Bool>();

  public decimals: UInt64 = UInt64.from(Token.defaultDecimals);

  public getHooksContract(): Hooks {
    const admin = this.getHooks();
    return new Hooks(admin);
  }

  public assertNotPaused(): void {
    this.paused.assertEquals(this.paused.get());
    this.paused.get().assertFalse(errors.tokenPaused);
  }

  @method
  public initialize(hooks: PublicKey, totalSupply: UInt64) {
    super.init();
    this.account.provedState.assertEquals(Bool(false));

    this.hooks.set(hooks);
    this.totalSupply.set(totalSupply);
    this.circulatingSupply.set(UInt64.from(0));
    this.paused.set(Bool(false));
  }

  /**
   * Mintable
   */

  @method
  public mint(address: PublicKey, amount: UInt64): AccountUpdate {
    const hooksContract = this.getHooksContract();
    hooksContract.canAdmin(AdminAction.fromType(AdminAction.types.mint));

    const totalSupply = this.getTotalSupply();
    const circulatingSupply = this.getCirculatingSupply();

    const newCirculatingSupply = circulatingSupply.add(amount);
    newCirculatingSupply.assertLessThanOrEqual(
      totalSupply,
      errors.mintAmountExceedsTotalSupply
    );

    // eslint-disable-next-line no-warning-comments
    // TODO: find out why amount can't be Int64, also for burn
    // eslint-disable-next-line putout/putout
    return this.internal.mint({ address, amount });
  }

  @method
  public setTotalSupply(amount: UInt64) {
    const hooksContract = this.getHooksContract();
    hooksContract.canAdmin(
      AdminAction.fromType(AdminAction.types.setTotalSupply)
    );

    this.totalSupply.set(amount);
  }

  /**
   * Burnable
   */

  @method
  public burn(from: PublicKey, amount: UInt64): AccountUpdate {
    this.assertNotPaused();

    const hooksContract = this.getHooksContract();
    hooksContract.canAdmin(AdminAction.fromType(AdminAction.types.burn));

    // eslint-disable-next-line putout/putout
    return this.token.burn({ address: from, amount });
  }

  /**
   * Upgradable
   */

  @method
  public setVerificationKey(verificationKey: VerificationKey) {
    const hooksContract = this.getHooksContract();
    hooksContract.canAdmin(
      AdminAction.fromType(AdminAction.types.setVerificationKey)
    );

    this.account.verificationKey.set(verificationKey);
  }

  /**
   * Pausable
   */

  @method
  public setPaused(paused: Bool) {
    const hooksContract = this.getHooksContract();
    hooksContract.canAdmin(AdminAction.fromType(AdminAction.types.setPaused));

    this.paused.set(paused);
  }

  @method
  approveBase(updates: AccountUpdateForest) {
    this.checkZeroBalanceChange(updates);
  }

  /**
   * Viewable
   */

  public getAccountOf(address: PublicKey): ReturnType<typeof Account> {
    return Account(address, this.token.id);
  }

  public getBalanceOf(address: PublicKey): UInt64 {
    const account = this.getAccountOf(address);
    const balance = account.balance.get();
    account.balance.requireEquals(balance);

    return balance;
  }

  public getTotalSupply(): UInt64 {
    const totalSupply = this.totalSupply.get();
    this.totalSupply.requireEquals(totalSupply);

    return totalSupply;
  }

  public getCirculatingSupply(): UInt64 {
    const circulatingSupply = this.circulatingSupply.get();
    this.circulatingSupply.requireEquals(circulatingSupply);

    return circulatingSupply;
  }

  public getHooks(): PublicKey {
    const hooks = this.hooks.get();
    this.hooks.requireEquals(hooks);

    return hooks;
  }

  public getPaused(): Bool {
    const paused = this.paused.get();
    this.paused.requireEquals(paused);

    return paused;
  }

  public getDecimals(): UInt64 {
    return this.decimals;
  }
}

export default Token;
