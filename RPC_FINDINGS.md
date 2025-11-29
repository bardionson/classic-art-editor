The codebase does not contain a hardcoded RPC endpoint URL.

The application uses the `viem` library's `createPublicClient` function with a default `http()` transport, which means it is using `viem`'s default public RPC provider.

Based on the `viem` source code and documentation, the default RPC provider is Infura, and the endpoint is `https://mainnet.infura.io/v3/`.
