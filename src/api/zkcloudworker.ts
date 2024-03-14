import { listFiles, loadCache } from "../mina/cache";
import { unzip } from "../storage/zip";
import fs from "fs/promises";
import { CloudWorker } from "./cloudobject";
import { Cache } from "o1js";
import { runCLI } from "jest";
import { minaInit } from "../mina/init";
import Jobs from "../table/jobs";
import { JobsData } from "../model/jobsData";
import { Memory, sleep } from "zkcloudworker";

const { PROVER_KEYS_BUCKET } = process.env;

export async function zkCloudWorkerDeploy(params: {
  name: string;
  username: string;
  jobId: string;
}) {
  console.log("zkCloudWorkerDeploy", params);
  const { name, username, jobId } = params;
  const timeStarted = Date.now();
  console.time("all");
  Memory.info("start");
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);

  try {
    await JobsTable.updateStatus({
      username,
      jobId: jobId,
      status: "started",
    });
    const contractsDirRoot = "/mnt/efs/worker";
    const contractsDir = contractsDirRoot + "/" + name;
    const cacheDir = "/mnt/efs/cache";
    const fileName = name + ".zip";
    const files = [fileName];

    // Copy compiled from TypeScript to JavaScript source code of the contracts
    // from S3 bucket to AWS lambda /tmp/contracts folder

    await listFiles(contractsDirRoot, true);
    await listFiles(contractsDir, true);
    await fs.rm(contractsDir, { recursive: true });
    //await fs.rm(contractsDirRoot, { recursive: true });
    //await listFiles(contractsDirRoot, true);
    await listFiles(contractsDir, true);
    await listFiles(cacheDir, false);

    await loadCache({
      cacheBucket: PROVER_KEYS_BUCKET!,
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
    await listFiles(contractsDir, true);
    await fs.rm(contractsDir + "/" + fileName);
    await listFiles(contractsDir, true);
    await JobsTable.updateStatus({
      username,
      jobId: jobId,
      status: "finished",
      result: "deployed",
      billedDuration: Date.now() - timeStarted,
    });

    console.timeEnd("all");
    await sleep(1000);
  } catch (err: any) {
    console.error(err);
    console.error("Error deploying package");
    await JobsTable.updateStatus({
      username,
      jobId: jobId,
      status: "failed",
      result: "deploy error: " + err.toString(),
      billedDuration: Date.now() - timeStarted,
    });
    Memory.info("deploy error");
    console.timeEnd("all");
    await sleep(1000);
  }
}

export async function zkCloudWorkerRunJestOracle(params: {
  name: string;
  username: string;
  jobId: string;
}) {
  console.log("zkCloudWorkerRunJestOracle", params);
  const { name, username, jobId } = params;
  const timeStarted = Date.now();
  console.time("all");
  Memory.info("start");
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);

  try {
    const job: JobsData | undefined = await JobsTable.get({
      id: username,
      jobId,
    });
    if (job === undefined) throw new Error("job not found");
    if (job.jobName !== name) throw new Error("job name mismatch");
    await JobsTable.updateStatus({
      username,
      jobId: jobId,
      status: "started",
    });
    const contractsDirRoot = "/mnt/efs/worker";
    const contractsDir = contractsDirRoot + "/" + name;
    const cacheDir = "/mnt/efs/cache";
    const fileName = name + ".zip";
    const files = [fileName];
    const functionName = job.task;
    const args = job.args;

    await listFiles(contractsDir, true);

    const relativeDir = "../../../../mnt/efs/worker/" + name + "/dist/index.js";
    await listFiles(contractsDir, true);
    await listFiles(contractsDir + "/dist", true);

    /*
    Jest Oracle code for Proof-Of-Knowledge NFTs
    */
    const jestConfig = {
      roots: [relativeDir + "/tests"],
      //testRegex: "\\.spec\\.js$",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jestResult = await runCLI(jestConfig as any, [relativeDir]);
    console.log("jest result", jestResult.results?.success);

    await JobsTable.updateStatus({
      username,
      jobId: jobId,
      status: "finished",
      result: jestResult.results?.success ? "success" : "failure",
      billedDuration: Date.now() - timeStarted,
    });

    console.timeEnd("all");
    await sleep(1000);
  } catch (err: any) {
    console.error(err);
    console.error("worker: Error running package");
    await JobsTable.updateStatus({
      username,
      jobId: jobId,
      status: "failed",
      result: "run error: " + err.toString(),
      billedDuration: Date.now() - timeStarted,
    });
    Memory.info("run error");
    console.timeEnd("all");
    await sleep(1000);
  }
}

export async function zkCloudWorkerRunTypeScriptOracle(params: {
  name: string;
  username: string;
  jobId: string;
}) {
  console.log("zkCloudWorkerRun", params);
  const { name, username, jobId } = params;
  const timeStarted = Date.now();
  console.time("all");
  Memory.info("start");
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);

  try {
    const job: JobsData | undefined = await JobsTable.get({
      id: username,
      jobId,
    });
    if (job === undefined) throw new Error("job not found");
    if (job.jobName !== name) throw new Error("job name mismatch");
    await JobsTable.updateStatus({
      username,
      jobId: jobId,
      status: "started",
    });
    const contractsDirRoot = "/mnt/efs/worker";
    const contractsDir = contractsDirRoot + "/" + name;
    const cacheDir = "/mnt/efs/cache";
    const fileName = name + ".zip";
    const files = [fileName];
    const functionName = job.task;
    const args = job.args;

    await listFiles(contractsDir, true);

    const relativeDir = "../../../../mnt/efs/worker/" + name + "/dist/index.js";
    await listFiles(contractsDir, true);
    await listFiles(contractsDir + "/dist", true);

    console.log("Importing contracts...");

    const code = await import(relativeDir);
    console.log("imported contracts");
    minaInit();
    const cache: Cache = Cache.FileSystem(cacheDir);
    const cloud = new CloudWorker(cache);
    console.log("running function", functionName, args);
    const result = await code[functionName](cloud, args);
    console.log("function result:", result);

    await JobsTable.updateStatus({
      username,
      jobId: jobId,
      status: "finished",
      result,
      billedDuration: Date.now() - timeStarted,
    });

    console.timeEnd("all");
    await sleep(1000);
  } catch (err: any) {
    console.error(err);
    console.error("worker: Error running package");
    await JobsTable.updateStatus({
      username,
      jobId: jobId,
      status: "failed",
      result: "run error: " + err.toString(),
      billedDuration: Date.now() - timeStarted,
    });
    Memory.info("run error");
    console.timeEnd("all");
    await sleep(1000);
  }
}
