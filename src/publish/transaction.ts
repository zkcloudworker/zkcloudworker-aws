import { S3File } from "../storage/s3.js";
import { TransactionMetadata, sleep } from "@silvana-one/prover";
import { publishTransactionNats } from "./nats.js";
import { publishTransactionAlgolia } from "./algolia.js";
const { VERIFICATION_BUCKET } = process.env;

export async function publishTransactionMetadata(params: {
  chain: string;
  txId: string;
  metadata: TransactionMetadata;
  developer: string;
  repo: string;
  id: string;
  jobId: string;
}): Promise<void> {
  if (VERIFICATION_BUCKET === undefined)
    throw new Error("VERIFICATION_BUCKET is undefined");
  const { txId, metadata, chain } = params;
  const natsPromise = publishTransactionNats(params);
  const algoliaPromise = publishTransactionAlgolia(params);

  const file = new S3File(VERIFICATION_BUCKET, chain + "/tx/" + txId + ".json");
  // https://verification.zkcloudworker.com/devnet/tx/5JuNBnEtrDFtTGHG6nJyxJbEQY4bNHBW4fqAw5Y2D5rjLMvzPLUJ.json

  await file.put(JSON.stringify(metadata, null, 2), "application/json");
  await Promise.all([natsPromise, algoliaPromise]);
  await sleep(1000);
}
