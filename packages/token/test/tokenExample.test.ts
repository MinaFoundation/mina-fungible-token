import "core-js";
import "reflect-metadata";

import {
  AccountUpdate,
  Circuit,
  Mina,
  PrivateKey,
  type PublicKey,
  UInt64,
} from 'o1js';

import { describe, it, beforeAll, expect } from "bun:test";

import ThirdParty from '../test/ThirdParty';

import Token from '../src/token';
import TokenAccount from '../src/TokenAccount';
import Hooks from '../src/Hooks';

const proofsEnabled = true;


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

  beforeAll(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    
  });
  
  // Deploying the token tests
  
});