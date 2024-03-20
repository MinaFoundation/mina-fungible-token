const errors = {
  onlyNewAccountsCanBeInitialized:
    'You can call .initialize() only on new accounts',

  mayUseTokenNotProvided:
    'You must specify the account update token ownership with `mayUseToken`',

  nonZeroBalanceChange: 'Account update has a non-zero balance change',
  fromOrToNotProvided: `You must provide from & to, or either of those to issue a token transfer account update(s)`,

  mintAmountExceedsTotalSupply:
    'Minting the provided amount would overflow the total supply',

  tokenPaused: 'Token is paused',
};

export default errors;
