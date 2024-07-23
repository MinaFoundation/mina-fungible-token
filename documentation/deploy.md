# Deploy

Setting up a new fungible token requires three steps: deploying an admin contract, deploying the
token contract itself, and initializing the contract

## Deploying an admin contract

The first step is deploying the admin contract via its `deploy()` function.

The admin contract handles permissions for privileged actions, such as minting. It is called by the
token contract whenever a user tries to do a privileged action.

The benefit of separating those permissions out into a separate contract is that it allows changing
the permission logic without changing the original token contract. That is important because third
parties that want to integrate a specific token will need the contract code for that token. If most
tokens use the standard token contract, and only modify the admin contract, the integration burden
for third parties is reduced significantly.

If you want to change your admin contract, you can write a contract that `extends SmartContract` and
`implements FungibleTokenAdminBase`.

[!NOTE] Note that if you want to use a custom admin contract, you should write the admin contract
from scratch. Inheriting from `FungibleTokenAdmin` and overwriting specific methods might not work.
You can find an example of a custom admin contract in `FungibleToken.test.ts`.

The `initialize()` method of `FungibleToken` takes as one argument the address of the admin
contract. If you have written your own admin contract, you will also need to set
`FungibleToken.AdminContract` to that class.

[!NOTE] If you do not use the `FungibleToken` class as is, third parties that want to integrate your
token will need to use your custom contract as well.

[!NOTE] The `deploy()` function of the admin contract sets permissions such that the admin contract
can only be upgraded/replaced in case of a breaking update of the chain, and prevents changing the
permissions of the account the contract is deployed to. That way, users can trust that the code of
the admin contract will not change arbitrarily. If you write your own admin contract, set
permissions accordingly.

### Admin Contract and Centralization

The default admin contract uses a single keypair. That is not ideal, as it introduces a single point
of failure.

Higher levels of security can be achieved by utilizing a decentralized governance or multi-sig
scheme, and it is recommended to do so.

Any user purchasing a token should investigate the key management practices of the token deployer
and validate the token contract permissions as one should with any o1js application. In particular,
they should check that

- The verification keys of the admin and token contract are as expected
- Both admin and token contract have set the permission such that the verification key can only be
  set after a breaking update of the network
- Both the admin and token contract have set the permissions to change permissions set to
  `impossible`
- The deployment transaction of the token contract has not been changed to skip the `isNew` check
  that has been introduced in [Issue 1439](https://github.com/o1-labs/o1js/issues/1439). If a
  malicious deployer were to skip this test, they could mint tokens for themselves before deployment
  of the token contract.

## Initializing and deploying the token contract

Next, the token contract needs to be deployed, via its `deploy()` function.

After being deployed, the token contract needs to be initialized, by calling the `init()` function
and `initialize()` method. Those make sure that the contract state is initialized, create an account
on the chain that will be used to track the current circulation of the token, set all permissions on
the account of the token contract and the account that's tracking the total circulation.

[!NOTE] All three steps above can be carried out in a single transaction, or in separate
transactions. It is highly recommended to have a single transaction with all three steps.

[!NOTE] Unless you have a very good reason, please use one transaction that deploys the admin
contract, deploys the token contract, and calls `initialize()` on the token contract.

[!NOTE] Each of the three steps requires funding a new account on the chain via
`AccountUpdate.fundNewAccount`.

[!NOTE] If you use separate transactions for deploying the admin contract and deploying and
initializing the token contract, you should start the token contract in paused mode, and only call
`resume()` after you have verified that the admin contract has been successfully deployed.

Refer to
[examples/e2e.eg.ts](https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts)
to see executable end to end example.

## Upgradeability

Both the token and admin contract have permissions set so that they cannot be upgraded, except in
case of a non-backwards compatible hard fork of Mina (see
[Mina documentation on upgradeability](https://docs.minaprotocol.com/zkapps/writing-a-zkapp/feature-overview/permissions#example-impossible-to-upgrade)).
This is to ensure that the rules around the token are not changed after the token is deployed.
