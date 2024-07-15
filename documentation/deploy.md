# Deploy

Setting up a new fungible token requires three steps: deploying an admin contract, deploying the
token contract itself, and initializing the contract

## Deploying an admin contract

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

## Deploying the token contract

The `deploy` function of `FungibleToken` takes as one argument the address of the admin contract. If
you have written your own admin contract, you will also need to set `FungibleToken.adminContract` to
that class.

[!NOTE] If you do not use the `FungibleToken` as is, third parties that want to integrate your token
will need to use your custom contract as well.

## Initializing the token contract

After being deployed, the token contract needs to be initialized, by calling the `initialize()`
method. That method creates an account on the chain that will be used to track the current
circulation of the token.

[!NOTE] All three steps above can be carried out in a single transaction, or in separate
transactions. [!NOTE] Each of the three steps requires funding a new account on the chain via
`AccountUpdate.fundNewAccount`. [!NOTE] Per default, the token contract will start in paused mode.
If you perform all the steps in one single transaction, you can instead opt for starting it in
non-paused mode. Otherwise, you will need to call `resume()` before any tokens can be minted or
transferred.

Refer to
[examples/e2e.eg.ts](https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts)
to see executable end to end example.
