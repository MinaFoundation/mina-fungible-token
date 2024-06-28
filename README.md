# `mina-fungible-token`

Standard implementation of fungible tokens in Mina, as per
[RFC14: Fungible Token Standard on Mina](https://github.com/o1-labs/rfcs/blob/main/0014-fungible-token-standard.md).

This implementation is currently a beta. We do not expect the API to change anytime soon. We are
awaiting an audit of the code before removing the beta status.

## Running tests

```sh
npm run test
```

If you want disable proof generation during testing, you can do so via

```sh
SKIP_PROOFS=true npm run test
```

The tests will run much faster that way, which is nice when you're testing locally while developing.
Note that this will skip one test does

## Running [Examples](./examples)

```sh
npm i
npm run task examples/<example-file-name>.ts
```

## License

`mina-fungible-token` is [Apache licensed](LICENSE).
