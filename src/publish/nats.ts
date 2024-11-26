import { connect } from "@nats-io/transport-node";
import { jetstream } from "@nats-io/jetstream";
import { Kvm } from "@nats-io/kv";

import {
  JobData,
  JobEvent,
  TransactionMetadata,
  CloudTransaction,
} from "../cloud";
import { VerificationAnswer } from "../api/verify";
import config from "../cloud/config";

export async function publishJobStatusNats(params: {
  job: JobData;
  event: JobEvent;
  publishFull?: boolean;
}): Promise<boolean> {
  const { job, event, publishFull } = params;
  try {
    const nc = await connect({
      servers: config.ZKCLOUDWORKER_NATS,
      timeout: 1000,
    });

    const js = jetstream(nc, { timeout: 2_000 });
    const kvm = new Kvm(js);
    const kv = await kvm.create("profiles");
    // const kv = await js.views.kv("profiles");

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
    return true;
  } catch (error) {
    console.error(`NATS: Error publishing job status`, { error, job });
    return false;
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
      timeout: 1000,
    });
    const js = jetstream(nc, { timeout: 2_000 });
    const kvm = new Kvm(js);
    const kv = await kvm.create("profiles");
    await kv.put(
      `zkcloudworker.tx.${clean(developer)}.${clean(repo)}`,
      JSON.stringify(params)
    );
    await kv.put(`zkcloudworker.transaction`, JSON.stringify(params));

    await nc.drain();
  } catch (error) {
    console.error(`NATS: Error publishing transaction`, params, error);
  }
}

export interface CloudTransactionNatsParams {
  txs: CloudTransaction[];
  developer: string;
  repo: string;
  id: string;
  jobId?: string;
}

export async function publishCloudTransactionsNats(
  params: CloudTransactionNatsParams
): Promise<void> {
  const { txs, developer, repo, id, jobId } = params;
  const statusTime = Date.now();
  try {
    const nc = await connect({
      servers: config.ZKCLOUDWORKER_NATS,
      timeout: 1000,
    });
    const js = jetstream(nc, { timeout: 10_000 });
    const kvm = new Kvm(js);
    const kv = await kvm.create("profiles");
    await kv.put(
      `zkcloudworker.rolluptxs.${clean(developer)}.${clean(repo)}`,
      JSON.stringify({ ...params, statusTime })
    );
    for (const tx of txs) {
      await kv.put(
        `zkcloudworker.rolluptx.${tx.txId}`,
        JSON.stringify({ ...tx, statusTime })
      );
    }

    await nc.drain();
  } catch (error) {
    console.error(`NATS: Error publishing transaction`, params, error);
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
      timeout: 1000,
    });
    const js = jetstream(nc, { timeout: 10_000 });
    const kvm = new Kvm(js);
    const kv = await kvm.create("profiles");
    await kv.put(`zkcloudworker.zkapp`, JSON.stringify(params));

    await nc.drain();
  } catch (error) {
    console.error(`NATS: Error publishing verification`, params, error);
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
