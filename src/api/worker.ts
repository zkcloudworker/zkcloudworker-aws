import { zkCloudWorker, Cloud } from "zkcloudworker";
import { zkcloudworker as DomainNameServiceWorker } from "../external/DomainNameService/worker";
import { Workers } from "../table/workers";

const WORKERS_TABLE = process.env.WORKERS_TABLE!;

export async function isWorkerExist(params: {
  developer: string;
  repo: string;
}): Promise<boolean> {
  const { developer, repo } = params;
  if (developer === "@staketab") {
    switch (repo) {
      case "nameservice":
        return true;
      default:
        return false;
    }
  }
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
}): Promise<zkCloudWorker> {
  const { developer, repo, cloud } = params;
  if (developer === "@staketab") {
    switch (repo) {
      case "nameservice":
        return await DomainNameServiceWorker(cloud);
      default:
        throw new Error("unknown repo");
    }
  }
  const workersTable = new Workers(WORKERS_TABLE);
  const result = await workersTable.get({
    developer,
    repo,
  });
  if (result === undefined)
    throw new Error(`worker not found: ${developer}/${repo}`);

  // TODO: add balance check
  if (result.countUsed !== undefined && result.countUsed >= 50) {
    throw new Error(`worker used up: ${developer}/${repo}`);
  }

  const contractsDirRoot = "/mnt/efs/worker";
  const contractsDir = contractsDirRoot + "/" + developer + "/" + repo;
  const distDir = contractsDir + "/dist";

  console.log("Importing worker from:", distDir);
  const zkcloudworker = await import(distDir);
  const functionName = "zkcloudworker";
  const worker = await zkcloudworker[functionName](cloud);
  await workersTable.timeUsed({
    developer,
    repo,
    count: result.countUsed ?? 0,
  });
  return worker;
}
