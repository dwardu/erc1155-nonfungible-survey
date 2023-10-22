// Note: Despite the .ts file extension, this is AssemblyScript not TypeScript!

import {
  Address,
  BigInt,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  TransferBatch as TransferBatchEvent,
  TransferSingle as TransferSingleEvent,
} from "../generated/ERC1155/ERC1155";
import {
  Contract as ContractEntity,
  UniqueTokenOwner as UniqueTokenOwnerEntity,
} from "../generated/schema";
import {
  assertContractEntity,
  assertTokenEntity,
} from "./entities";
import { min, max, ZERO } from './utils';


export function handleTransferSingle(event: TransferSingleEvent): void {
  handleTransfers(event, event.address, event.params.from, event.params.to, [event.params.id], [event.params.value]);
}

export function handleTransferBatch(event: TransferBatchEvent): void {
  handleTransfers(event, event.address, event.params.from, event.params.to, event.params.ids, event.params.values);
}

function updateUniqueTokenOwnerCount(contractEntity: ContractEntity, ownerAddr: Address): void {
  if (ownerAddr.equals(Address.zero())) {
    return;
  }
  const id = `${contractEntity.id}/owners/${ownerAddr.toHex()}`;
  const loaded = UniqueTokenOwnerEntity.load(id);
  if (loaded != null) {
    return;
  }
  const created = new UniqueTokenOwnerEntity(id);
  created.contract = contractEntity.id;
  created.save();
  contractEntity.uniqueTokenOwnerCount = contractEntity.uniqueTokenOwnerCount.plus(BigInt.fromI32(1));
  contractEntity.save();
}

function handleTransfers(event: ethereum.Event, contractAddr: Address, fromAddr: Address, toAddr: Address, ids: BigInt[], values: BigInt[]): void {
  assert(ids.length == values.length);
  const isMint = fromAddr.equals(Address.zero());
  const isBurn = toAddr.equals(Address.zero());
  if (isMint && isBurn) {
    log.warning(`isMint && isBurn at transaction ${event.transaction.hash.toHex()}`, []);
    return;
  }
  const contractEntity = assertContractEntity(contractAddr);

  contractEntity.minTransferTimestamp = min(contractEntity.minTransferTimestamp, event.block.timestamp);
  contractEntity.maxTransferTimestamp = max(contractEntity.maxTransferTimestamp, event.block.timestamp);

  for (let i = 0; i < ids.length; i++) {
    const tokenId = ids[i];
    const value = values[i];
    const tokenEntity = assertTokenEntity(contractEntity, tokenId);

    if (value.gt(ZERO)) {
      updateUniqueTokenOwnerCount(contractEntity, fromAddr);
      updateUniqueTokenOwnerCount(contractEntity, toAddr);
    }

    if (!isMint && value.gt(tokenEntity.supply)) {
      // Assuming ERC-1155 is implemented correctly,
      // we cannot be transferring or burning more than the supply,
      // so this can only mean that since we did not start indexing at block 0,
      // these tokens were minted before we started indexing.
      // Therefore once we are now aware of the existence of these tokens,
      // we correct our counts retroactively.
      const correction = value.minus(tokenEntity.supply);
      log.warning(`Corrected supply of ${tokenEntity.id} by +${correction} during tx ${event.transaction.hash.toHex()}`, []);
      tokenEntity.supply = tokenEntity.supply.plus(correction);
      tokenEntity.maxEverSupply = tokenEntity.maxEverSupply.plus(correction);
      contractEntity.totalSupply = contractEntity.totalSupply.plus(correction);
      contractEntity.maxEverTotalSupply = contractEntity.maxEverTotalSupply.plus(correction);
      contractEntity.maxEverIndividualTokenSupply = max(contractEntity.maxEverIndividualTokenSupply, tokenEntity.maxEverSupply);
      contractEntity.totalCorrection = contractEntity.totalCorrection.plus(correction);
    }

    if (isMint) {
      tokenEntity.supply = tokenEntity.supply.plus(value);
      contractEntity.totalSupply = contractEntity.totalSupply.plus(value);
      tokenEntity.maxEverSupply = max(tokenEntity.maxEverSupply, tokenEntity.supply);
      contractEntity.maxEverIndividualTokenSupply = max(contractEntity.maxEverIndividualTokenSupply, tokenEntity.maxEverSupply);
      contractEntity.maxEverTotalSupply = max(contractEntity.maxEverTotalSupply, contractEntity.totalSupply);
    } else if (isBurn) {
      tokenEntity.supply = tokenEntity.supply.minus(value);
      contractEntity.totalSupply = contractEntity.totalSupply.minus(value);
    }
    contractEntity.maxEverTransferValue = max(contractEntity.maxEverTransferValue, value);
    tokenEntity.save();
  }

  contractEntity.save();

}
