import assert from 'assert';
import fs from 'fs';
import { Chain, OpenSeaAPI, OpenSeaCollection } from 'opensea-js';
import { env } from 'process';
import { getBuiltGraphSDK } from './.graphclient';
import { cached } from './utils';

const { GetNonfungibleERC1155Contracts } = getBuiltGraphSDK();

const ETHERSCAN_API_KEY_TOKEN = env.ETHERSCAN_API_KEY_TOKEN;
const OPENSEA_API_KEY = env.OPENSEA_API_KEY;
const BLOCK = env.BLOCK;

assert(ETHERSCAN_API_KEY_TOKEN);
assert(OPENSEA_API_KEY);
assert(BLOCK);

const openseaAPI = new OpenSeaAPI({ chain: Chain.Mainnet, apiKey: OPENSEA_API_KEY });

// @cached('opensea', 'ethereum', 'contracts')
// async function getOpenSeaContract(addr: string): Promise<{ collection: string } | null> {
const getOpenSeaContract = cached('opensea', 'ethereum', 'contracts')(
  async (addr: string): Promise<{ collection: string } | null> => {
    const openseaRsp = await fetch(`https://api.opensea.io/api/v2/chain/ethereum/contract/${addr}`, { headers: { 'x-api-key': OPENSEA_API_KEY } });
    if (openseaRsp.status === 200) {
      const data = JSON.parse(await openseaRsp.text());
      return data;
    } else {
      return null;
    }
  }
)

const getOpenSeaCollection = cached('opensea', 'ethereum', 'collections')(
  async (collection: string): Promise<OpenSeaCollection | null> => {
    try {
      return await openseaAPI.getCollection(collection);
    } catch (e: any) {
      console.warn(`Error getting OpenSea collection ${collection}: ${e.status}`);
      return null;
    }
  }
)

const getEtherscanSourceCode = cached('etherscan.io')(
  async (addr: string): Promise<any | null> => {
    const rsp = await fetch(`https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${addr}&apikey=${ETHERSCAN_API_KEY_TOKEN}`);
    if (rsp.status === 200) {
      const data = JSON.parse(await rsp.text()); // as `await rsp.toJSON() bypasses json-bigint-patch`
      const { status, result } = data;
      if (status === '1') {
        return data;
      } else {
        console.warn(`Error fetching Etherscan source-code for contract ${addr}: ${result}`)
      }
    }
    return null;
  }
)

async function getOpenSeaInfo(addr: string): Promise<string | null> {
  const openSeaContract = await getOpenSeaContract(addr);
  if (openSeaContract !== null) {
    const { collection } = openSeaContract;
    const openSeaCollection = await getOpenSeaCollection(collection);
    if (openSeaCollection !== null) {
      const { name } = openSeaCollection;
      return `[${name}](${`https://opensea.io/collection/${collection}`})`;
    }
  }
  return null;
}

async function getEtherscanInfo(addr: string): Promise<string | null> {
  const etherscanSourceCode = await getEtherscanSourceCode(addr);
  if (etherscanSourceCode) {
    const { result: [{ ContractName: name }] } = etherscanSourceCode;
    if (name) {
      return `[${name}](${`https://etherscan.io/address/${addr}#code`})`
    }
  }
  return null;
}

const PER_PAGE = 100;

const START_BLOCK = 16_000_000; // copied from subgraph.yaml
const endBlock = parseInt(BLOCK);

async function main() {
  const tokenContracts = (await Promise.all([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(async page0 => {
    const { contracts } = await GetNonfungibleERC1155Contracts({
      blockNumber: endBlock,
      skip: page0 * PER_PAGE,
      first: PER_PAGE
    })
    return contracts;
  })))
    .flat()
    .map(({ id, totalSupply, maxEverTotalSupply, uniqueTokenOwnerCount }) => ({
      id,
      totalSupply: parseInt(totalSupply),
      maxEverTotalSupply: parseInt(maxEverTotalSupply),
      uniqueTokenOwnerCount: parseInt(uniqueTokenOwnerCount),
    }))

  console.log(`${tokenContracts.length} results`)

  const lines = await Promise.all(tokenContracts.map(async ({ id: addr, maxEverTotalSupply, totalSupply, uniqueTokenOwnerCount }, pos) => {
    return [
      `${(1 + pos).toString().padStart(4, ' ')}`,
      `[\`${addr}\`](https://etherscan.io/token/${addr})`,
      totalSupply.toString().padStart(6, ' '),
      maxEverTotalSupply.toString().padStart(6, ' '),
      uniqueTokenOwnerCount.toString().padStart(6, ' '),
      (await getOpenSeaInfo(addr)) || '—',
      (await getEtherscanInfo(addr)) || '—',
    ].join(' | ')
  }));

  fs.writeFileSync(`./SURVEY.md`, [
    `Top ${tokenContracts.length} ERC-1155 contracts used for nonfungible tokens. [More info](./README.md).`,
    '',
    `Based on blocks [${START_BLOCK}](${`https://etherscan.io/block/${START_BLOCK}`})…[${endBlock}](${`https://etherscan.io/block/${endBlock}`}).`,
    '',
    '№ | Address | `totalSupply` | `maxEverTotalSupply` | `uniqueTokenOwnerCount` | OpenSea | Etherscan code',
    '-:| ------- | -------------:| --------------------:| -----------------------:| ------- | --------------',
    ...lines
  ].join('\n'))

}

main().catch(console.error);
