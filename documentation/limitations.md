# Limitations of the Current Design

The design of having one standard implementation of the token contract, and custom admin contracts,
allows for some flexibility, but there are some remaining limitations.

1. Since token transfers should not depend on custom code, the `transfer()` and `approveBase()`
   methods do not call into the admin contract. Consequently, custom transfer logic is not
   supported.

   Thus, token implementations will struggle to implement the following features:
   1. Fee on transfer. For examples, see
      [here](https://github.com/d-xo/weird-erc20?tab=readme-ov-file#fee-on-transfer).
   2. Token blacklists or whitelists. For examples, see
      [here](https://github.com/d-xo/weird-erc20?tab=readme-ov-file#tokens-with-blocklists).
   3. Circuit-breaking or transfer amount limits. For examples, see
      [here](https://github.com/d-xo/weird-erc20?tab=readme-ov-file#revert-on-large-approvals--transfers).
2. Custom burn logic is not supported.

   Many applications may wish to maintain some invariant related to the total supply. For instance,
   a `wMina` token contract's admin would have a mechanism to lock or release `Mina` in return for
   minting or burning `wMina`. This would currently be implemented by the `wMina` admin contract
   having a method which calls burn on behalf of the user. However, this would only maintain the
   invariant `wMina supply >= locked Mina`, rather than strict equality.

   This type of invariant is generally of interest to any token representing a share of some wrapped
   assets.

3. Custom `balanceOf()` logic is not supported:
   1. Rebasable (like
      [stEth](https://github.com/lidofinance/lido-dao/blob/5fcedc6e9a9f3ec154e69cff47c2b9e25503a78a/contracts/0.4.24/StETH.sol#L166-L168))
      tokens may be difficult to implement. For more examples, see
      [here](https://github.com/d-xo/weird-erc20?tab=readme-ov-file#balance-modifications-outside-of-transfers-rebasingairdrops).

In the future, Mina Foundation and the community might develop more flexible versions of the token
implementation that get around some or all of those limitations. That might involve additional
hooks, possibly with flags in the main token contract state that determine whether a custom contract
should be called or not. But for now, these limitations remain, and token developers should be aware
of them.
