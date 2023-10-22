// Note: Despite the .ts file extension, this is AssemblyScript not TypeScript!

import {
  Address,
  BigInt
} from "@graphprotocol/graph-ts";
import {
  Contract as ContractEntity,
  Token as TokenEntity,
  UniqueTokenOwner as UniqueTokenOwnerEntity,
} from "../generated/schema";
import { ZERO } from "./utils";

function assertFieldEqual<T>(entityName: string, id: string, fieldName: string, actualFieldValue: T, expectedFieldValue: T): void {
  // Note: Important to use == until === becomes supported
  assert(actualFieldValue == expectedFieldValue, `${entityName}(${id}).${fieldName} == ${actualFieldValue} != ${expectedFieldValue}`);
}

export function assertContractEntity(contractAddr: Address): ContractEntity {
  const entityId = contractAddr.toHex();
  const loaded = ContractEntity.load(entityId);
  if (loaded == null) {
    const created = new ContractEntity(entityId);
    created.maxEverIndividualTokenSupply = ZERO;
    created.totalSupply = ZERO;
    created.maxEverTotalSupply = ZERO;
    created.maxEverTransferValue = ZERO;
    created.minTransferTimestamp = BigInt.fromI32(i32.MAX_VALUE);
    created.maxTransferTimestamp = ZERO;
    created.uniqueTokenOwnerCount = ZERO;
    created.totalCorrection = ZERO;
    created.save();
    return created;
  } else {
    return loaded;
  }
}

export function assertTokenEntity(contractEntity: ContractEntity, tokenId: BigInt): TokenEntity {
  const id = `${contractEntity.id}/tokens/${tokenId}`;
  const loaded = TokenEntity.load(id);
  if (loaded == null) {
    const created = new TokenEntity(id);
    created.contract = contractEntity.id;
    created.tokenId = tokenId;
    created.supply = ZERO;
    created.maxEverSupply = ZERO;
    created.save();
    return created;
  } else {
    assertFieldEqual('Token', id, 'contract', loaded.contract, contractEntity.id);
    assertFieldEqual('Token', id, 'tokenId', loaded.tokenId, tokenId);
    return loaded;
  }
}

export function assertUniqueTokenOwner(contractEntity: ContractEntity, ownerAddr: Address): UniqueTokenOwnerEntity {
  const id = `${contractEntity.id}/owners/${ownerAddr.toHex()}`;
  const loaded = UniqueTokenOwnerEntity.load(id);
  if (loaded == null) {
    const created = new UniqueTokenOwnerEntity(id);
    created.contract = contractEntity.id;
    created.save();
    return created;
  } else {
    assertFieldEqual('UniqueTokenOwnerEntity', id, 'contract', loaded.contract, contractEntity.id);
    return loaded;
  }
}
