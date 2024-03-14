import { initBlockchain, MinaNetworkInstance, Berkeley } from "zkcloudworker";

export function minaInit(): MinaNetworkInstance {
  return initBlockchain("berkeley");
}

export function explorerAccount(): string {
  return Berkeley.explorerAccountUrl!;
}

export function explorerTransaction(): string {
  return Berkeley.explorerTransactionUrl!;
}

export function chainId(): string {
  return Berkeley.chainId!;
}
