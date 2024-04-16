import { zkCloudWorker, Memory, blockchain } from "zkcloudworker";
import { ExecuteCloudWorker } from "./cloud";
import { isWorkerExist } from "./worker";
import { Jobs } from "../table/jobs";
import { getWorker } from "./worker";
import { callLambda } from "../lambda/lambda";
import { S3File } from "../storage/s3";
import { minaInit } from "../mina/init";

const MAX_JOB_AGE: number = 1000 * 60 * 60; // 60 minutes

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
    metadata?: string;
    chain: blockchain;
    webhook?: string;
  };
}): Promise<{
  success: boolean;
  jobId: string | undefined;
  error: string | undefined;
}> {
  const { command, data } = params;
  const {
    id,
    developer,
    repo,
    transactions,
    task,
    args,
    metadata,
    chain,
    webhook,
    taskId,
  } = data;

  if (
    id === undefined ||
    transactions === undefined ||
    developer === undefined ||
    repo === undefined ||
    chain === undefined ||
    (taskId === undefined && command === "task") ||
    (await isWorkerExist({
      developer,
      repo,
    })) === false
  ) {
    console.error("Wrong execute command", {
      ...params,
      transactions: undefined,
    });

    return {
      success: false,
      jobId: undefined,
      error: "Wrong execute command",
    };
  }

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
    args,
    txNumber: 1,
    metadata,
    chain,
    webhook,
  });
  if (jobId !== undefined) {
    await callLambda(
      "worker",
      JSON.stringify({ command, id, jobId, developer, repo })
    );
    return { success: true, jobId, error: undefined };
  } else {
    console.error("execute: createJob: jobId is undefined");
    return {
      success: false,
      jobId: undefined,
      error: "execute: createJob: jobId is undefined",
    };
  }
}

export async function execute(params: {
  command: string;
  developer: string;
  repo: string;
  id: string;
  jobId: string;
}): Promise<boolean> {
  const { developer, repo, id, jobId, command } = params;
  const timeStarted = Date.now();
  console.time("zkCloudWorker Execute");
  console.log(`zkCloudWorker Execute start:`, params);
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);
  try {
    Memory.info(`start`);

    const job = await JobsTable.get({
      id,
      jobId,
    });
    if (job === undefined) throw new Error("job not found");

    if (job.jobStatus === "failed") {
      console.log("zkCloudWorker Execute: job is failed, exiting");
      return false;
    }
    if (job.jobStatus === "finished" || job.jobStatus === "used") {
      console.log("zkCloudWorker Execute: job is finished or used, exiting");
      return false;
    }
    if (Date.now() - job.timeCreated > MAX_JOB_AGE) {
      console.error("zkCloudWorker Execute: job is too old, exiting");
      return false;
    }
    const cloud = new ExecuteCloudWorker(job);
    const worker: zkCloudWorker = await getWorker({
      developer: developer,
      repo: repo,
      cloud,
    });
    await JobsTable.updateStatus({
      id,
      jobId,
      status: "started",
    });
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
    await minaInit(job.chain);
    const result =
      command === "execute"
        ? await worker.execute(transactions)
        : await worker.task();

    if (result !== undefined) {
      await JobsTable.updateStatus({
        id,
        jobId,
        status: "finished",
        result: result,
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info(`finished`);
      return true;
    } else {
      await JobsTable.updateStatus({
        id,
        jobId,
        status: "failed",
        result: "execute error",
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info(`failed`);
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
