import { listFiles, copyFiles } from "../storage/files";
import { unzip } from "../storage/install";
import fs from "fs/promises";
import { Jobs } from "../table/jobs";
import { Memory, sleep, LocalCloud, JobData } from "zkcloudworker";
import { Cache } from "o1js";

const { BUCKET } = process.env;

export async function deploy(params: {
  developer: string;
  repo: string;
  id: string;
  jobId: string;
}): Promise<boolean> {
  console.log("deploy", params);
  const { developer, repo, id, jobId } = params;
  const timeStarted = Date.now();
  console.time("deployed");
  Memory.info("start");
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);

  try {
    if (jobId !== "test")
      await JobsTable.updateStatus({
        id,
        jobId: jobId,
        status: "started",
      });
    const contractsDirRoot = "/mnt/efs/worker";
    const developerDir = contractsDirRoot + "/" + developer;
    const contractsDir = contractsDirRoot + "/" + developer + "/" + repo;
    const cacheDir = "/mnt/efs/cache";
    const fileName = repo + ".zip";
    const fullFileName = developer + "/" + fileName;
    if (BUCKET === undefined) throw new Error("BUCKET is undefined");

    // Copy compiled from TypeScript to JavaScript source code of the contracts
    // from S3 bucket to AWS lambda /tmp/contracts folder

    await fs.rm(contractsDirRoot, { recursive: true });
    await listFiles(contractsDirRoot, true);
    await listFiles(developerDir, true);
    await listFiles(contractsDir, true);
    //await fs.rm(contractsDir, { recursive: true });

    //await listFiles(contractsDirRoot, true);
    //await listFiles(contractsDir, true);
    await listFiles(cacheDir, false);

    await copyFiles({
      bucket: BUCKET,
      developer: developer,
      folder: contractsDirRoot,
      files: [fileName],
      overwrite: true,
      //move: true,
    });
    await listFiles(developerDir, true);
    await listFiles(contractsDir, true);
    console.log("loaded repo");

    console.time("unzipped");
    await unzip({
      folder: developerDir,
      repo,
    });
    console.timeEnd("unzipped");
    await listFiles(developerDir, true);
    await listFiles(contractsDir, true);
    await fs.rm(developerDir + "/" + fileName);
    await listFiles(developerDir, true);

    if (jobId !== "test")
      await JobsTable.updateStatus({
        id,
        jobId: jobId,
        status: "finished",
        result: "deployed",
        billedDuration: Date.now() - timeStarted,
      });

    Memory.info("deployed");
    console.timeEnd("deployed");

    const distDir = contractsDir + "/dist";
    await listFiles(distDir, true);
    console.log("Importing worker from:", distDir);
    const zkcloudworker = await import(distDir);
    console.log("Getting zkCloudWorker object...");

    const functionName = "zkcloudworker";
    const timeCreated = Date.now();
    const job: JobData = {
      id: "local",
      jobId: "jobId",
      developer: "@dfst",
      repo: "simple-example",
      task: "example",
      userId: "userId",
      args: Math.ceil(Math.random() * 100).toString(),
      metadata: "simple-example",
      txNumber: 1,
      timeCreated,
      timeCreatedString: new Date(timeCreated).toISOString(),
      timeStarted: timeCreated,
      jobStatus: "started",
      maxAttempts: 0,
    } as JobData;
    const cache = Cache.FileSystem(cacheDir);
    const cloud = new LocalCloud({ job, cache });
    const worker = await zkcloudworker[functionName](cloud);
    console.log("Executing job...");
    const result = await worker.execute();
    console.log("Job result:", result);
    await sleep(1000);

    return true;
  } catch (err: any) {
    console.error(err);
    console.error("Error deploying package");
    if (jobId !== "test")
      await JobsTable.updateStatus({
        id,
        jobId: jobId,
        status: "failed",
        result: "deploy error: " + err.toString(),
        billedDuration: Date.now() - timeStarted,
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
