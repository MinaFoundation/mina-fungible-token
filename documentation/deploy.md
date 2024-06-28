# Deploy

To create a new token, deploy the `FungibleToken` contract. You will need an admin account as well,
to control permissions. You can either use the supplied contract `FungibleTokenAdmin`, or write your
own contract that implements `FungibleTokenAdminBase`. An example can be found in
`FungibleToken.test.ts`, where a non-standard admin contract is implemented (`CustomTokenAdmin`,
implementing a minting policy that resembles a faucet).

[!NOTE] Note that you have to write the admin contract from scratch. Inheriting from
`FungibleTokenAdmin` and overwriting specific methods might not work.

[!NOTE] If you do not use the `FungibleToken` as is, third parties that want to integrate your token
will need to use your custom contract as well.

Refer to
[examples/e2e.eg.ts](https://github.com/MinaFoundation/mina-fungible-token/blob/main/examples/e2e.eg.ts)
to see executable end to end example.
