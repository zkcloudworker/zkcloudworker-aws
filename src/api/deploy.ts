import {
  listFiles,
  moveZip,
  createFolders,
  isExist,
} from "../storage/files.js";
import { unzip } from "../storage/zip.js";
import { install } from "../storage/install.js";
import fs from "fs/promises";
import { Jobs } from "../table/jobs.js";
import { Workers } from "../table/workers.js";
import { Deployments } from "../table/deployments.js";
import { Memory, sleep } from "@silvana-one/prover";
import { charge } from "../table/balance.js";

const { BUCKET } = process.env;
const WORKERS_TABLE = process.env.WORKERS_TABLE!;
const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE!;
export async function deploy(params: {
  developer: string;
  repo: string;
  id: string;
  jobId: string;
  args: string;
}): Promise<boolean> {
  console.time("deployed");
  //console.log("deploy", params);
  const { developer, repo, id, jobId, args } = params;
  const {
    packageManager = "yarn",
    version,
    size,
    protect,
    build,
    env,
  } = JSON.parse(args);
  console.log("deploy", {
    developer,
    repo,
    packageManager,
    version,
    size,
    protect,
    build,
  });
  const timeStarted = Date.now();

  Memory.info("start");
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);
  const workersTable = new Workers(WORKERS_TABLE);
  try {
    const existingWorker = await workersTable.get({
      developer,
      repo,
    });
    if (existingWorker !== undefined && existingWorker.protected === true) {
      console.log("Existing worker is protected", existingWorker);
      console.error("Worker already exists and is protected", {
        developer,
        repo,
        version,
      });
      await JobsTable.updateStatus({
        id,
        jobId: jobId,
        status: "failed",
        result: "Worker already exists and is protected",
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info("deploy error");
      console.timeEnd("deployed");
      await sleep(1000);
      return false;
    }

    if (BUCKET === undefined) throw new Error("BUCKET is undefined");

    const workersDirRoot = "/mnt/efs/worker";
    const developerDir = workersDirRoot + "/" + developer;
    const repoDir = developerDir + "/" + repo;
    const versionStr = version.replaceAll(".", "_");
    const versionDir = repoDir + "/" + versionStr;
    const distDir = versionDir + "/dist";
    await createFolders([developerDir, repoDir, versionDir]);
    const filename = repo + "." + version + ".zip";

    // Copy compiled from TypeScript to JavaScript source code of the contracts
    // from S3 bucket to AWS lambda /tmp/contracts folder
    console.time(`moved ${filename} to ${developerDir}`);
    await moveZip({
      bucket: BUCKET,
      key: developer + "/" + filename,
      folder: developerDir,
      file: filename,
    });
    console.timeEnd(`moved ${filename} to ${developerDir}`);
    await listFiles(developerDir, true);

    console.time("unzipped");
    await unzip({
      folder: developerDir,
      filename,
      targetDir: versionDir,
    });
    console.timeEnd("unzipped");
    await fs.rm(developerDir + "/" + filename);

    console.time("installed");
    await install({
      folder: versionDir,
      packageManager,
      buildCommand: build,
      env,
    });
    console.timeEnd("installed");

    await listFiles(distDir, true);

    await workersTable.create({
      id,
      developer,
      repo,
      version,
      size,
      protected: protect,
      timeDeployed: Date.now(),
      timeUsed: 0,
      countUsed: 0,
    });
    const deploymentsTable = new Deployments(DEPLOYMENTS_TABLE);
    await deploymentsTable.add({
      developer,
      repo,
      timestamp: Date.now(),
      version,
      size,
      success: true,
    });
    const billedDuration = Date.now() - timeStarted;
    await charge({
      id,
      billedDuration,
      jobId,
    });
    await JobsTable.updateStatus({
      id,
      jobId: jobId,
      status: "finished",
      result: "deployed",
      billedDuration, // TODO: add billed duration for clearing old deployment
      maxAttempts: 1,
    });

    console.time("cleared old deployment");
    const folders = await listFiles(repoDir, false);
    console.log("deployed versions:", folders);
    for (const folder of folders) {
      try {
        if (folder !== versionStr) {
          console.log("deleting old version", folder);
          await fs.rm(repoDir + "/" + folder, { recursive: true });
        }
      } catch (err: any) {
        console.error("error deleting old version", err.message);
      }
    }
    await listFiles(repoDir, true);
    console.timeEnd("cleared old deployment");
    Memory.info("deployed");
    console.timeEnd("deployed");
    await sleep(1000);
    return true;
  } catch (err: any) {
    console.error(err);
    console.error("Error deploying package");
    const msg = err?.message ?? err?.toString();
    if (jobId !== "test")
      await JobsTable.updateStatus({
        id,
        jobId: jobId,
        status: "failed",
        result:
          "deploy error: " +
          (msg && typeof msg === "string"
            ? msg
            : "exception while installing dependencies and compiling"),
        billedDuration: Date.now() - timeStarted,
      });
    const deploymentsTable = new Deployments(DEPLOYMENTS_TABLE);
    await deploymentsTable.add({
      developer,
      repo,
      timestamp: Date.now(),
      version,
      size,
      success: false,
      error: msg,
    });
    Memory.info("deploy error");
    console.timeEnd("deployed");
    await sleep(1000);
    return false;
  }
}

/*
export async function zkCloudWorkerRunJestOracle(params: {
  repo: string;
  id: string;
  jobId: string;
}) {
  console.log("zkCloudWorkerRunJestOracle", params);
  const { repo, id, jobId } = params;
  const timeStarted = Date.now();
  console.time("all");
  Memory.info("start");
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);

  try {
    const job: JobData | undefined = await JobsTable.get({
      id: id,
      jobId,
    });
    if (job === undefined) throw new Error("job not found");
    if (job.repo !== repo) throw new Error("job name mismatch");
    await JobsTable.updateStatus({
      id,
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

    
    //Jest Oracle code for Proof-Of-Knowledge NFTs
    
    const jestConfig = {
      roots: [relativeDir + "/tests"],
      //testRegex: "\\.spec\\.js$",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jestResult = await runCLI(jestConfig as any, [relativeDir]);
    console.log("jest result", jestResult.results?.success);

    await JobsTable.updateStatus({
      id,
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
      id,
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
*/
