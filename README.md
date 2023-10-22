The purpose of this project is to survey all[^1] [ERC-1155](https://eips.ethereum.org/EIPS/eip-1155) contracts deployed to the Ethereum mainnet to understand to what extent the ERC-1155 standard, despite being able to support both nonfungible and fungible tokens (supply ≥ 1), is being used “in the wild” for nonfungible tokens only (supply = 1) (see [related PR](https://github.com/OpenZeppelin/openzeppelin-contracts/pull/4684).)

To this end, all ERC-1155 `TransferSingle` and `TransferBatch` events are indexed in [a subgraph](./subgraph.yaml) (no further checks are made to verify ERC-1155 compliance — if the events match it is assumed they’ve been emitted by a ERC-1155 contract), and the total supply of each token-id on each contract is tracked.

Finally the index is queried to generate a list of the top 1000 ERC-1155 contracts that never had a token with supply > 1 (nor a transfer with value > 1), sorted by the contracts’ total supply of (nonfungible) tokens.

Subgraph is [live](https://thegraph.com/hosted-service/subgraph/dwardu/erc1155). To generate [list](./SURVEY.md) run:

```sh
npm install
OPENSEA_API_KEY=XXXX ETHERSCAN_API_KEY_TOKEN=XXXXXX BLOCK=18402500 npm run survey
```

[^1]: To speed things up, subgraph indexing was started only from block [16000000](https://etherscan.io/block/16000000), so any token amounts minted earlier were not indexed. This means that the survey is non-exhaustive, and that some fungible ERC-1155 contracts might appear to be nonfungible. Nevertheless in certain scenarios the indexer is able to correct itself, e.g. if the subgraph thinks that only amount 1 of a certain token-id has ever been minted, but suddenly it encounters a transfer of _3_ of this token, it will [correct counts retroactively](./assemblyscript/mapping.ts). All in all, despite not being exhaustive and exact, the survey result is still useful for the original purpose of understanding nonfungible ERC-1155 usage.