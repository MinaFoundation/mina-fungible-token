/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable max-classes-per-file */
import {
  SmartContract,
  method,
  PublicKey,
  UInt64,
  Circuit,
  AccountUpdate,
} from 'snarkyjs';
import { SmartContractConstructor, shareSnarkyMetadata } from '../utils.js';

interface Transferable {
  transfer: (
    from: PublicKey | SmartContract,
    to: PublicKey,
    amount: UInt64
  ) => void;
  transferSigned: (from: PublicKey, to: PublicKey, amount: UInt64) => void;
  transferFromChildToSibling: (
    fromChild: SmartContract,
    toSibling: PublicKey,
    amount: UInt64,
    options: TransferFromChildToSiblingOptions
  ) => void;
}

interface TransferFromChildToSiblingOptions {
  mayUseToken:
    | typeof AccountUpdate.MayUseToken.InheritFromParent
    | typeof AccountUpdate.MayUseToken.ParentsOwnToken;
}

function transferable<BaseClass extends SmartContractConstructor>(
  base: BaseClass
): BaseClass & {
  new (...args: any[]): Transferable;
  prototype: Transferable;
} {
  class Transfers extends base implements Transferable {
    public transfer(
      from: PublicKey | SmartContract,
      to: PublicKey,
      amount: UInt64
    ) {
      if (from instanceof PublicKey) {
        this.transferSigned(from, to, amount);
      } else {
        this.transferFromChildToSibling(from, to, amount);
      }
    }

    @method
    public transferSigned(from: PublicKey, to: PublicKey, amount: UInt64) {
      this.token.send({
        from,
        to,
        amount,
      });
    }

    // eslint-disable-next-line max-params
    public transferFromChildToSibling(
      fromChild: SmartContract,
      toSibling: PublicKey,
      amount: UInt64,
      // eslint-disable-next-line unicorn/no-object-as-default-parameter
      options: TransferFromChildToSiblingOptions = {
        mayUseToken: AccountUpdate.MayUseToken.ParentsOwnToken,
      }
    ) {
      // eslint-disable-next-line no-warning-comments
      // TODO: use either this.token.id or child.tokenId,
      // both should be the same
      const toAccountUpdate = AccountUpdate.create(toSibling, this.token.id);
      toAccountUpdate.balance.addInPlace(amount);
      toAccountUpdate.body.mayUseToken =
        AccountUpdate.MayUseToken.InheritFromParent;

      fromChild.balance.subInPlace(amount);

      // eslint-disable-next-line no-param-reassign
      fromChild.self.body.mayUseToken = options.mayUseToken;
    }
  }

  return shareSnarkyMetadata(Transfers, base);
}

export type { Transferable };
export default transferable;
