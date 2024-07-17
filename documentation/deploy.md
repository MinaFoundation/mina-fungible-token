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

## Initializing and deploying the token contract

Next, the token contract needs to be deployed, via its `deploy()` function.

After being deployed, the token contract needs to be initialized, by calling the `initialize()`
method. That method initializes the contract state, and creates an account on the chain that will be
used to track the current circulation of the token.

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
