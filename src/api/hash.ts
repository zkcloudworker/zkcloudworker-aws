import crypto from "crypto";
import { bigintToBase56 } from "../cloud";

export function stringHash(jsonString: string): string {
  if (typeof jsonString !== "string")
    throw new Error("stringHash: input must be a string");
  return bigintToBase56(
    BigInt("0x" + crypto.createHash("sha256").update(jsonString).digest("hex"))
  );
}
