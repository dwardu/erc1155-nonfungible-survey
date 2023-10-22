// Note: Despite the .ts file extension, this is AssemblyScript not TypeScript!

import { BigInt } from "@graphprotocol/graph-ts";

export const ZERO = BigInt.zero();

export function max(a: BigInt, b: BigInt): BigInt {
  return a > b ? a : b;
}

export function min(a: BigInt, b: BigInt): BigInt {
  return a < b ? a : b;
}
