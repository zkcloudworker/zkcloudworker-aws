import { CanonicalBlockchain } from "@silvana-one/api";

export function chainName(chain: CanonicalBlockchain): string | undefined {
  if (chain === "mina:devnet") return "devnet";
  if (chain === "mina:mainnet") return "mainnet";
  if (chain === "mina:testnet") return "testnet";
  if (chain === "zeko:testnet") return "zeko";
  return undefined;
}
