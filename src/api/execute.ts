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
import { minaInit } from "../mina/init";

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
  const worker: zkCloudWorker = await getWorker({
    developer: developer,
    repo: repo,
    cloud,
  });

  await minaInit(job.chain);
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

/*
import { listFiles, loadCache } from "../storage/cache";
import { unzip } from "../storage/zip";
import fs from "fs/promises";
import { CloudWorker } from "./cloudobject";
import { Cache } from "o1js";
import { runCLI } from "jest";
import { minaInit } from "../mina/init";


const { BUCKET } = process.env;
const downloadZip = false;

export async function runZip(params: {
  fileName: string;
  functionName: string;
  args: string[];
}) {
  const { fileName, functionName, args } = params;
  console.log("runZip", fileName, functionName, params);
  const contractsDir = "/mnt/efs/zip";
  const cacheDir = "/mnt/efs/cache";
  const files = [fileName];

  if (downloadZip) {
    // Copy compiled from TypeScript to JavaScript source code of the contracts
    // from S3 bucket to AWS lambda /tmp/contracts folder

    await fs.rm(contractsDir, { recursive: true });
    await listFiles(contractsDir, true);
    await listFiles(cacheDir, false);

    await loadCache({
      cacheBucket: BUCKET!,
      folder: contractsDir,
      files: files,
      overwrite: true,
    });
    await listFiles(contractsDir, true);
    console.log("loaded cache");

    console.time("unzipped");
    await unzip({
      folder: contractsDir,
      filename: fileName,
      targetDir: contractsDir,
    });
    console.timeEnd("unzipped");
  }
  await listFiles(contractsDir, true);

  const macDir = contractsDir + "/mac";
  const relativeDir = "../../../../mnt/efs/zip/mac/dist/index.js";
  await listFiles(macDir, true);
  await listFiles(macDir + "/dist", true);

  const jestConfig = {
    roots: ["../../../../mnt/efs/zip/mac/dist/tests"],
    //testRegex: "\\.spec\\.js$",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jestResult = await runCLI(jestConfig as any, [
    "../../../../mnt/efs/zip/mac",
  ]);
  console.log("jest result", jestResult.results?.success);

  console.log("Importing contracts...", __filename, "folder", __dirname);
  //await listFiles(relativeDir, true);

  try {
    const zip = await import(relativeDir);
    console.log("imported contracts");
    const functionName = "compile";
    minaInit();
    const cache: Cache = Cache.FileSystem(cacheDir);
    const cloud = new CloudWorker(cache);
    const result = await zip[functionName](cloud);
    console.log("compile function done", result);
    return result;
  } catch (error: any) {
    console.error("cloud contracts catch", (error as any).toString());
  }
}

export async function cloud(
  fileNames: string[],
  functionName: string,
  params: string[]
) {
  console.log("cloud", fileNames, functionName, params);
  const contractsDir = "/mnt/efs/cloud";
  const cacheDir = "/mnt/efs/cache";
  const files = fileNames;

  // Copy compiled from TypeScript to JavaScript source code of the contracts
  // from S3 bucket to AWS lambda /tmp/contracts folder
  await listFiles(contractsDir, true);
  await listFiles(cacheDir, false);
  await loadCache({
    cacheBucket: BUCKET!,
    folder: contractsDir,
    files: files,
    overwrite: true,
  });
  await listFiles(contractsDir, true);
  //await listFiles(cacheDir, true);
  //const file = "a.txt";
  //await fs.writeFile(`${contractsDir}/${file}`, "a.txt content", "utf8");
  //await listFiles(contractsDir, true);

  const contracts = await import(contractsDir + "/" + fileNames[0]);
  console.log("imported contracts");

  const result = await contracts[functionName](params);
  console.log("cloud result", result);
  return result;
}

*/
