import crypto from "crypto";
import { bigintToBase56 } from "@silvana-one/prover";

export function stringHash(jsonString: string): string {
  if (typeof jsonString !== "string")
    throw new Error("stringHash: input must be a string");
  return bigintToBase56(
    BigInt("0x" + crypto.createHash("sha256").update(jsonString).digest("hex"))
  );
}
