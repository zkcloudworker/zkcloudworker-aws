import { JobData, JobEvent, TransactionMetadata } from "@silvana-one/prover";
import { VerificationAnswer } from "../api/verify.js";
import { algoliasearch } from "algoliasearch";

export async function publishJobStatusAlgolia(params: {
  job: JobData;
  event: JobEvent;
  publishFull?: boolean;
}): Promise<void> {
  const { job, event } = params;
  try {
    const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT;
    const ALGOLIA_KEY = process.env.ALGOLIA_KEY;
    if (!ALGOLIA_PROJECT || !ALGOLIA_KEY) {
      throw new Error("ALGOLIA_PROJECT or ALGOLIA_KEY is not set");
    }
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);

    const jobIndex = "zk-jobs";
    const data = {
      objectID: job.jobId,
      ...job,
      args: undefined,
      transactions: undefined,
      filename: undefined,
      result: undefined,
      logStreams: undefined,
      logs: undefined,
    };
    let result = await client.saveObject({ indexName: jobIndex, body: data });
    if (result.taskID === undefined) {
      console.error(
        "publishJobStatusAlgolia: Algolia write result for job",
        job.jobId,
        "is ",
        result
      );
    }

    const jobEventIndex = "job_events";
    let resultString = undefined;
    if (event.result !== undefined) {
      if (typeof event.result === "string")
        resultString =
          event.result.substring(0, 100) +
          (event.result.length > 100
            ? `...${event.result.length - 100} more characters`
            : "");
      else resultString = "Error: wrong result format, should be string";
    }
    const dataEvent = {
      objectID: event.jobId + "." + event.eventTime.toString(),
      ...event,
      result: resultString,
    };
    result = await client.saveObject({
      indexName: jobEventIndex,
      body: dataEvent,
    });
    if (result.taskID === undefined) {
      console.error(
        "publishJobStatusAlgolia: Algolia write result for jobEvent",
        job.jobId,
        "is ",
        result
      );
    }
  } catch (error) {
    console.error("publishJobStatusAlgolia error:", { error, job });
  }
}

export async function publishPayment(params: {
  txHash: string;
  account: string;
  amount: number;
}): Promise<void> {
  const { txHash } = params;
  try {
    const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT;
    const ALGOLIA_KEY = process.env.ALGOLIA_KEY;
    if (!ALGOLIA_PROJECT || !ALGOLIA_KEY) {
      throw new Error("ALGOLIA_PROJECT or ALGOLIA_KEY is not set");
    }
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);

    const jobIndex = "payments";
    const data = {
      objectID: txHash,
      ...params,
    };
    let result = await client.saveObject({ indexName: jobIndex, body: data });
    if (result.taskID === undefined) {
      console.error(
        "publishJobStatusAlgolia: Algolia write result for payment",
        txHash,
        "is ",
        result
      );
    }
  } catch (error) {
    console.error("publishPayment error:", { error, params });
  }
}

export async function publishTransactionAlgolia(params: {
  txId: string;
  metadata: TransactionMetadata;
  developer: string;
  repo: string;
  id: string;
  jobId: string;
}): Promise<void> {
  const { txId } = params;
  try {
    const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT;
    const ALGOLIA_KEY = process.env.ALGOLIA_KEY;
    if (!ALGOLIA_PROJECT || !ALGOLIA_KEY) {
      throw new Error("ALGOLIA_PROJECT or ALGOLIA_KEY is not set");
    }
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);

    const jobIndex = "transactions";
    const data = {
      objectID: txId,
      ...params,
    };
    let result = await client.saveObject({ indexName: jobIndex, body: data });
    if (result.taskID === undefined) {
      console.error(
        "publishTransactionAlgolia: Algolia write result for transaction",
        params,
        "is ",
        result
      );
    }
  } catch (error) {
    console.error("publishTransactionAlgolia error:", { error, params });
  }
}

export async function publishChargeAlgolia(params: {
  jobId: string;
  id: string;
  billedDuration: number;
  amount: number;
}): Promise<void> {
  const { jobId } = params;
  try {
    const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT;
    const ALGOLIA_KEY = process.env.ALGOLIA_KEY;
    if (!ALGOLIA_PROJECT || !ALGOLIA_KEY) {
      throw new Error("ALGOLIA_PROJECT or ALGOLIA_KEY is not set");
    }
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);

    const jobIndex = "charges";
    const data = {
      objectID: jobId,
      ...params,
      time: Date.now(),
    };
    let result = await client.saveObject({ indexName: jobIndex, body: data });
    if (result.taskID === undefined) {
      console.error(
        "publishChargeAlgolia: Algolia write result for transaction",
        params,
        "is ",
        result
      );
    }
  } catch (error) {
    console.error("publishChargeAlgolia error:", { error, params });
  }
}

export async function publishVerificationAlgolia(params: {
  chain: string;
  account: string;
  metadata: VerificationAnswer;
  developer: string;
  repo: string;
}): Promise<void> {
  const { chain, metadata, developer, repo, account } = params;
  try {
    const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT;
    const ALGOLIA_KEY = process.env.ALGOLIA_KEY;
    if (!ALGOLIA_PROJECT || !ALGOLIA_KEY) {
      throw new Error("ALGOLIA_PROJECT or ALGOLIA_KEY is not set");
    }
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);

    const jobIndex = "zkapps";
    const data = {
      objectID: chain + "." + account,
      ...params,
    };
    let result = await client.saveObject({ indexName: jobIndex, body: data });
    if (result.taskID === undefined) {
      console.error(
        "publishTransactionAlgolia: Algolia write result for zkapp",
        params,
        "is ",
        result
      );
    }
  } catch (error) {
    console.error("publishTransactionAlgolia error:", { error, params });
  }
}
