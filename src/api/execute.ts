import { zkCloudWorker, Memory } from "zkcloudworker";
import { ExecuteCloudWorker } from "./cloud";
import { Jobs } from "../table/jobs";
import { getWorker } from "./worker";

const MAX_JOB_AGE: number = 1000 * 60 * 60; // 60 minutes

export async function execute(params: {
  developer: string;
  repo: string;
  id: string;
  jobId: string;
}): Promise<boolean> {
  const { developer, repo, id, jobId } = params;
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
    const result = await worker.execute([]);
    if (result !== undefined) {
      await JobsTable.updateStatus({
        id,
        jobId,
        status: "finished",
        result: result,
        billedDuration: Date.now() - timeStarted,
      });
      return true;
    } else {
      await JobsTable.updateStatus({
        id,
        jobId,
        status: "failed",
        result: "execute error",
        billedDuration: Date.now() - timeStarted,
      });
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
