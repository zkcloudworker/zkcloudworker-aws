import { Sequencer } from "./sequencer";
import { isWorkerExist } from "./worker";
import { S3File } from "../storage/s3";
import { blockchain } from "zkcloudworker";

export async function createRecursiveProofJob(params: {
  id: string;
  developer: string;
  transactions: string[];
  repo: string;
  task: string;
  args?: string;
  metadata?: string;
  userId?: string;
  chain: blockchain;
  webhook?: string;
}): Promise<{
  success: boolean;
  jobId: string | undefined;
  error: string | undefined;
}> {
  const {
    id,
    developer,
    transactions,
    repo,
    task,
    args,
    metadata,
    chain,
    webhook,
    userId,
  } = params;
  if (
    id === undefined ||
    transactions === undefined ||
    developer === undefined ||
    repo === undefined ||
    chain === undefined ||
    (await isWorkerExist({
      developer,
      repo,
    })) === false
  ) {
    console.error("Wrong recursiveProof command", {
      ...params,
      transactions: undefined,
    });

    return {
      success: false,
      jobId: undefined,
      error: "Wrong recursiveProof command",
    };
  }

  const filename =
    developer + "/" + "recursiveProof." + Date.now().toString() + ".json";
  const file = new S3File(process.env.BUCKET!, filename);
  await file.put(JSON.stringify({ transactions }), "application/json");
  const sequencer = new Sequencer({
    jobsTable: process.env.JOBS_TABLE!,
    stepsTable: process.env.STEPS_TABLE!,
    proofsTable: process.env.PROOFS_TABLE!,
    id,
  });
  const jobId = await sequencer.createJob({
    id,
    developer,
    repo,
    filename,
    task: task ?? "recursiveProof",
    args: args,
    txNumber: transactions.length,
    metadata: metadata ?? "",
    userId,
    chain,
    webhook,
  });
  return { success: true, jobId, error: undefined };
}
