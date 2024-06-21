import { S3File } from "../storage/s3";
import { TransactionMetadata } from "../cloud";
import { publishTransactionNats } from "./nats";
import { publishTransactionAlgolia } from "./algolia";

const { VERIFICATION_BUCKET } = process.env;

export async function publishTransactionMetadata(params: {
  chain: string;
  txId: string;
  metadata: TransactionMetadata;
  developer: string;
  repo: string;
}): Promise<void> {
  const { txId, metadata, chain } = params;
  await publishTransactionNats(params);
  await publishTransactionAlgolia(params);
  if (VERIFICATION_BUCKET === undefined)
    throw new Error("VERIFICATION_BUCKET is undefined");
  const file = new S3File(VERIFICATION_BUCKET, chain + "/tx/" + txId + ".json");
  // https://verification.zkcloudworker.com/devnet/tx/5JuNBnEtrDFtTGHG6nJyxJbEQY4bNHBW4fqAw5Y2D5rjLMvzPLUJ.json

  https: await file.put(JSON.stringify(metadata, null, 2), "application/json");
}
