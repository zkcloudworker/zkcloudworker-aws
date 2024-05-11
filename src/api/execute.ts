import {
  zkCloudWorker,
  Memory,
  blockchain,
  JobData,
  JobStatus,
} from "zkcloudworker";
import { ExecuteCloudWorker } from "./cloud";
import { isWorkerExist } from "./worker";
import { Jobs } from "../table/jobs";
import { getWorker } from "./worker";
import { callLambda } from "../lambda/lambda";
import { S3File } from "../storage/s3";

export async function createExecuteJob(params: {
  command: string;
  data: {
    id: string;
    developer: string;
    taskId?: string;
    transactions: string[];
    repo: string;
    task: string;
    args?: string;
    userId?: string;
    metadata?: string;
    chain: blockchain;
    webhook?: string;
    mode?: string;
  };
}): Promise<{
  success: boolean;
  jobId?: string;
  result?: string;
  error?: string;
}> {
  const { command, data } = params;
  const {
    id,
    developer,
    repo,
    task,
    args,
    metadata,
    userId,
    chain,
    webhook,
    taskId,
    mode,
  } = data;
  const transactions = data.transactions ?? [];

  if (
    id === undefined ||
    typeof id !== "string" ||
    transactions === undefined ||
    developer === undefined ||
    typeof developer !== "string" ||
    repo === undefined ||
    typeof repo !== "string" ||
    chain === undefined ||
    typeof chain !== "string" ||
    (taskId === undefined && command === "task") ||
    (command !== "deploy" &&
      (await isWorkerExist({
        developer,
        repo,
      })) === false)
  ) {
    console.error("Wrong execute command", {
      command,
      ...data,
      transactions: undefined,
    });

    return {
      success: false,
      jobId: undefined,
      error: "error: wrong execute command",
    };
  }

  if (mode === "sync") {
    const timeCreated = Date.now();
    const item: JobData = {
      id,
      jobId: "sync",
      developer,
      repo,
      taskId,
      task,
      userId,
      args,
      metadata,
      chain,
      webhook,
      txNumber: transactions.length,
      timeCreated,
      timeCreatedString: new Date(timeCreated).toISOString(),
      jobStatus: "started" as JobStatus,
      maxAttempts: 0,
    };
    try {
      const result = await executeSync({
        command,
        developer,
        repo,
        job: item,
        transactions,
      });
      if (result !== undefined) return { success: true, result };
      else {
        console.error("error: execute: executeSync");
        return {
          success: false,
          error: "error: execute: executeSync",
        };
      }
    } catch (error: any) {
      console.error("error: catch: execute: executeSync", error);
      return {
        success: false,
        jobId: undefined,
        error: "error: catch: execute: executeSync",
      };
    }
  } else {
    let filename: string | undefined = undefined;
    if (transactions.length > 0) {
      filename = developer + "/" + "execute." + Date.now().toString() + ".json";
      const file = new S3File(process.env.BUCKET!, filename);
      await file.put(JSON.stringify({ transactions }), "application/json");
    }
    const JobsTable = new Jobs(process.env.JOBS_TABLE!);
    const jobId = await JobsTable.createJob({
      id,
      developer,
      repo,
      filename,
      task,
      taskId,
      args,
      txNumber: 1,
      metadata,
      chain,
      webhook,
      logStreams: [],
    });
    if (jobId !== undefined) {
      await callLambda(
        "worker",
        JSON.stringify({ command, id, jobId, developer, repo, args })
      );
      return { success: true, jobId, error: undefined };
    } else {
      console.error("error: execute: createJob: jobId is undefined");
      return {
        success: false,
        jobId: undefined,
        error: "error: execute: createJob: jobId is undefined",
      };
    }
  }
}

export async function executeSync(params: {
  command: string;
  developer: string;
  repo: string;
  job: JobData;
  transactions: string[];
}): Promise<string | undefined> {
  const { command, developer, repo, job, transactions } = params;
  Memory.info(`start`);
  console.time("zkCloudWorker Execute Sync");

  const cloud = new ExecuteCloudWorker(job);
  const worker: zkCloudWorker | undefined = await getWorker({
    developer: developer,
    repo: repo,
    cloud,
  });

  if (worker === undefined) {
    console.error("executeSync: worker not found");
    return "error: worker not found";
  }

  const result =
    command === "execute"
      ? await worker.execute(transactions)
      : await worker.task();

  Memory.info(`finished`);
  console.timeEnd("zkCloudWorker Execute Sync");
  return result;
}

export async function execute(params: {
  command: string;
  developer: string;
  repo: string;
  id: string;
  jobId: string;
  job: JobData;
}): Promise<boolean> {
  const { developer, repo, id, jobId, command, job } = params;
  const timeStarted = Date.now();
  console.time("zkCloudWorker Execute");
  console.log(`zkCloudWorker Execute start:`, params);
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);
  try {
    let transactions: string[] = [];
    if (job.filename !== undefined) {
      const file = new S3File(process.env.BUCKET!, job.filename);
      const data = await file.get();
      const streamToString = await data.Body?.transformToString("utf8");
      if (streamToString === undefined) {
        throw new Error("Error: streamToString is undefined");
      }
      const json = JSON.parse(streamToString.toString());
      transactions = json.transactions;
      console.log("execute: number of transactions:", transactions.length);
    }

    const result = await executeSync({
      command,
      developer,
      repo,
      job,
      transactions,
    });

    if (result !== undefined) {
      await JobsTable.updateStatus({
        id,
        jobId,
        status: "finished",
        result: result,
        billedDuration: Date.now() - timeStarted,
        maxAttempts: 1,
      });
      console.timeEnd("zkCloudWorker Execute");
      return true;
    } else {
      await JobsTable.updateStatus({
        id,
        jobId,
        status: "failed",
        result: "execute error",
        maxAttempts: 1,
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info(`failed`);
      console.timeEnd("zkCloudWorker Execute");
      return false;
    }
  } catch (error: any) {
    console.error("zkCloudWorker Execute: catch:", error);
    await JobsTable.updateStatus({
      id,
      jobId,
      status: "failed",
      result: "execute error",
      billedDuration: Date.now() - timeStarted,
    });
    console.timeEnd("zkCloudWorker Execute");
    return false;
  }
}
