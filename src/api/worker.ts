import { zkCloudWorker, Cloud, blockchain } from "../cloud";
import { Workers } from "../table/workers";
import dotenv from "dotenv";

const WORKERS_TABLE = process.env.WORKERS_TABLE!;

declare global {
  namespace NodeJS {
    interface Process {
      noDeprecation: boolean;
    }
  }
}

export async function isWorkerExist(params: {
  developer: string;
  repo: string;
}): Promise<boolean> {
  const { developer, repo } = params;
  /*
  if (developer === "@staketab") {
    switch (repo) {
      case "nameservice":
        return true;
      default:
        return false;
    }
  }
  */
  const workersTable = new Workers(WORKERS_TABLE);
  const result = await workersTable.get({
    developer,
    repo,
  });
  return result === undefined ? false : true;
}

export async function getWorker(params: {
  developer: string;
  repo: string;
  cloud: Cloud;
}): Promise<{ worker?: zkCloudWorker; error?: string }> {
  const { developer, repo, cloud } = params;
  (process as any).noDeprecation = true;
  /*
  if (developer === "@staketab") {
    switch (repo) {
      case "nameservice":
        return { worker: await DomainNameServiceWorker(cloud) };
      default:
        throw new Error("unknown repo");
    }
  }
  */
  const workersTable = new Workers(WORKERS_TABLE);
  const result = await workersTable.get({
    developer,
    repo,
  });
  //console.log("getWorker result:", result);
  if (result === undefined) {
    console.error(`worker not found: ${developer}/${repo}`);
    return { error: `error: worker not found: ${developer}/${repo}` };
  }
  if (result.version === undefined || typeof result.version !== "string") {
    console.error(
      `worker version for ${developer}/${repo} not found or has wrong format: ${result.version}`
    );
    return {
      error: `error: worker version for ${developer}/${repo} not found or has wrong format: ${result.version}`,
    };
  }
  const version: string = result.version;

  // TODO: add balance check
  if (result.countUsed !== undefined && result.countUsed >= 50) {
    if (
      developer !== "@staketab" &&
      developer !== "DFST" &&
      developer !== "MAZ"
    ) {
      console.error(`worker used up: ${developer}/${repo}`);
      return { error: `error: worker used up: ${developer}/${repo}` };
    } else {
      console.log(
        `worker ${developer}/${repo} used already ${result.countUsed} times`
      );
    }
  }

  const workersDirRoot = "/mnt/efs/worker";
  const dist =
    workersDirRoot +
    "/" +
    developer +
    "/" +
    repo +
    "/" +
    version.replaceAll(".", "_") +
    "/dist/index.js";

  const env =
    workersDirRoot +
    "/" +
    developer +
    "/" +
    repo +
    "/" +
    version.replaceAll(".", "_") +
    "/.env";

  const loaded = dotenv.config({ path: env });
  if (loaded?.parsed) console.log("Loaded the worker environment from .env");

  console.log(
    "Running worker",
    `${developer}/${repo}@${version} at ${cloud.chain}`
  );
  const zkcloudworker = await import(dist);
  const functionName = "zkcloudworker";
  const worker = await zkcloudworker[functionName](cloud);
  await workersTable.timeUsed({
    developer,
    repo,
    count: result.countUsed ?? 0,
  });
  return { worker };
}
