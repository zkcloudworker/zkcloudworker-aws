import { Memory, blockchain, JobData, JobStatus } from "../cloud";
import { ExecuteCloudWorker } from "./cloud";
import { isWorkerExist } from "./worker";
import { Jobs } from "../table/jobs";
import { getWorker } from "./worker";
import { callLambda } from "../lambda/lambda";
import { S3File } from "../storage/s3";
import { forceRestartLambda } from "../lambda/lambda";
import { charge } from "../table/balance";
import { makeString } from "../cloud";
import {
  rateLimit,
  initializeRateLimiter,
  initializeDynamoRateLimiter,
  penalizeRateLimit,
} from "./rate-limit";
import { stringHash } from "./hash";

initializeRateLimiter({
  name: "repoSync",
  points: 1000,
  duration: 60 * 60,
});

const REPO_POINTS = 500;

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
    taskId,
    mode,
  } = data;
  const transactions = data.transactions ?? [];
  try {
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
      if (
        await rateLimit({
          name: "repoSync",
          key: developer + "/" + repo,
        })
      ) {
        console.log("repoSync rate limit", developer + "/" + repo);
        return {
          success: false,
          error: "error: execute sync: repo rate limit",
        };
      }
      const timeCreated = Date.now();
      const jobId: string =
        "zkCWsync" +
        stringHash(
          JSON.stringify({
            id,
            developer,
            repo,
            chain,
            timeCreated,
            salt: makeString(32),
          })
        );
      const item: JobData = {
        id,
        jobId,
        developer,
        repo,
        taskId,
        task,
        userId,
        args,
        metadata,
        chain,
        txNumber: transactions.length,
        timeCreated,
        jobStatus: "started" as JobStatus,
      };
      const JobsTable = new Jobs(process.env.JOBS_TABLE!);
      try {
        const result = await executeSync({
          command,
          developer,
          repo,
          job: item,
          transactions,
        });
        const timeFinished = Date.now();
        await JobsTable.createJob({
          id,
          developer,
          repo,
          task,
          taskId,
          userId,
          args,
          txNumber: transactions.length,
          timeCreated,
          timeFinished,
          metadata,
          chain,
          logStreams: [],
          jobId,
          result: typeof result === "string" ? result : undefined,
          billedDuration: timeFinished - timeCreated,
          status: "used" as JobStatus,
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
        console.error(
          "error: catch: execute: executeSync",
          error?.message ?? ""
        );
        const timeFinished = Date.now();
        await JobsTable.createJob({
          id,
          developer,
          repo,
          task,
          taskId,
          userId,
          args,
          txNumber: transactions.length,
          timeCreated,
          timeFinished,
          metadata,
          chain,
          logStreams: [],
          jobId,
          result: error?.message ?? undefined,
          billedDuration: timeFinished - timeCreated,
          status: "failed" as JobStatus,
        });
        return {
          success: false,
          jobId: undefined,
          error: "error: catch: execute: executeSync " + (error?.message ?? ""),
        };
      }
    } else {
      await initializeDynamoRateLimiter({
        name: "repo",
        points: REPO_POINTS,
        duration: 60 * 60,
      });
      if (
        await rateLimit({
          name: "repo",
          key: developer + "/" + repo,
        })
      ) {
        console.log("repo rate limit", developer + "/" + repo);
        return {
          success: false,
          error: "error: execute: repo rate limit",
        };
      }
      let filename: string | undefined = undefined;
      if (transactions.length > 0) {
        filename =
          developer + "/" + "execute." + Date.now().toString() + ".json";
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
        logStreams: [],
      });
      if (jobId !== undefined) {
        if (chain !== "devnet" && chain !== "zeko" && chain !== "mainnet") {
          console.error(
            "error: execute: createJob: chain is not supported",
            chain
          );
          return {
            success: false,
            jobId,
            error: `error: chain ${chain} is not supported`,
          };
        } else {
          await callLambda(
            "worker-" + chain,
            JSON.stringify({ command, id, jobId, developer, repo, args, chain })
          );
          return { success: true, jobId, error: undefined };
        }
      } else {
        console.error("error: execute: createJob: jobId is undefined");
        return {
          success: false,
          jobId: undefined,
          error: "error: execute: createJob: jobId is undefined",
        };
      }
    }
  } catch (error: any) {
    console.error("error: execute: catch", error);
    return {
      success: false,
      jobId: undefined,
      error: "error: execute: catch " + (error?.message ?? ""),
    };
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

  try {
    const cloud = new ExecuteCloudWorker(job);
    const { worker, error } = await getWorker({
      developer: developer,
      repo: repo,
      cloud,
    });

    if (worker === undefined) {
      console.error("executeSync: worker not found", error);
      return error ?? "error: worker not found";
    }

    const result =
      command === "execute"
        ? await worker.execute(transactions)
        : await worker.task();

    Memory.info(`finished`);
    console.timeEnd("zkCloudWorker Execute Sync");
    if (result === undefined) return undefined;
    if (typeof result !== "string") {
      console.error("executeSync: Result is not a string");
      return undefined;
    }
    return result;
  } catch (error: any) {
    console.error("executeSync: catch:", error);
    return undefined;
  }
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
      if (data?.Body === undefined)
        throw new Error(`Error reading file ${job.filename} from S3`);
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

    const billedDuration = Date.now() - timeStarted;
    await charge({
      id,
      billedDuration,
      jobId,
    });
    if (billedDuration > 1000 * 150) {
      await initializeDynamoRateLimiter({
        name: "repo",
        points: REPO_POINTS,
        duration: 60 * 60,
      });
      await penalizeRateLimit({
        name: "repo",
        key: developer + "/" + repo,
        points: billedDuration > 1000 * 60 * 5 ? 50 : 10,
      });
    }

    if (result !== undefined) {
      await JobsTable.updateStatus({
        id,
        jobId,
        status: "finished",
        result: result,
        billedDuration,
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
        billedDuration,
      });
      Memory.info(`failed`);
      await forceRestartLambda();
      console.timeEnd("zkCloudWorker Execute");
      return false;
    }
  } catch (error: any) {
    console.error("zkCloudWorker Execute: catch:", error);
    const billedDuration = Date.now() - timeStarted;
    await charge({
      id,
      billedDuration,
      jobId,
    });
    await JobsTable.updateStatus({
      id,
      jobId,
      status: "failed",
      result: "execute error",
      billedDuration,
    });
    await forceRestartLambda();
    console.timeEnd("zkCloudWorker Execute");
    return false;
  }
}
