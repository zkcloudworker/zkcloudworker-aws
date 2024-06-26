import { connect } from "nats";
import { JobData, JobEvent, TransactionMetadata } from "../cloud";
import { VerificationAnswer } from "../api/verify";
import config from "../cloud/config";

export async function publishJobStatusNats(params: {
  job: JobData;
  event: JobEvent;
  publishFull?: boolean;
}): Promise<void> {
  const { job, event, publishFull } = params;
  try {
    const nc = await connect({
      servers: config.ZKCLOUDWORKER_NATS,
      timeout: 3000,
    });
    const js = nc.jetstream();
    const kv = await js.views.kv("profiles", { timeout: 2000 });
    if (publishFull === true) {
      await kv.put(
        `zkcloudworker.job.${clean(job.developer)}.${clean(job.repo)}`,
        JSON.stringify(job)
      );
      await kv.put(`zkcloudworker.job`, JSON.stringify(job));
    }

    await kv.put(
      `zkcloudworker.jobStatus.${event.jobId}`,
      JSON.stringify(event)
    );
    await kv.put(`zkcloudworker.jobStatus`, JSON.stringify(event));

    await nc.drain();
  } catch (error) {
    console.error(`NATS: Error publishing job status`, { error, job });
  }
}

export async function publishTransactionNats(params: {
  txId: string;
  metadata: TransactionMetadata;
  developer: string;
  repo: string;
  id: string;
  jobId: string;
}): Promise<void> {
  const { txId, metadata, developer, repo } = params;
  try {
    const nc = await connect({
      servers: config.ZKCLOUDWORKER_NATS,
      timeout: 3000,
    });
    const js = nc.jetstream();
    const kv = await js.views.kv("profiles", { timeout: 2000 });
    await kv.put(
      `zkcloudworker.tx.${clean(developer)}.${clean(repo)}`,
      JSON.stringify(params)
    );
    await kv.put(`zkcloudworker.transaction`, JSON.stringify(params));

    await nc.drain();
  } catch (error) {
    console.error(`NATS: Error publishing job status`, params, error);
  }
}

export async function publishVerificationNats(params: {
  chain: string;
  account: string;
  metadata: VerificationAnswer;
  developer: string;
  repo: string;
}): Promise<void> {
  const { chain, metadata, developer, repo, account } = params;
  try {
    const nc = await connect({
      servers: config.ZKCLOUDWORKER_NATS,
      timeout: 3000,
    });
    const js = nc.jetstream();
    const kv = await js.views.kv("profiles", { timeout: 2000 });
    await kv.put(`zkcloudworker.zkapp`, JSON.stringify(params));

    await nc.drain();
  } catch (error) {
    console.error(`NATS: Error publishing job status`, params, error);
  }
}

function clean(input: string): string {
  // Define the allowed characters based on the regular expression
  const allowedChars = /^[-/=.\w]+$/;

  // Filter the input string to include only the allowed characters
  const filtered = input
    .split("")
    .filter((char) => allowedChars.test(char))
    .join("");

  return filtered;
}
