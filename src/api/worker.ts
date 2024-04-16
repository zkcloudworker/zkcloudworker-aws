import { zkCloudWorker, Cloud } from "zkcloudworker";
import { zkcloudworker as DomainNameServiceWorker } from "../external/DomainNameService/worker";

export async function isWorkerExist(params: {
  developer: string;
  repo: string;
}): Promise<boolean> {
  const { developer, repo } = params;
  if (developer === "@dfst") {
    switch (repo) {
      default:
        return false;
    }
  } else if (developer === "@staketab") {
    switch (repo) {
      case "nameservice":
        return true;
      default:
        return false;
    }
  }
  return false;
}

export async function getWorker(params: {
  developer: string;
  repo: string;
  cloud: Cloud;
}): Promise<zkCloudWorker> {
  const { developer, repo, cloud } = params;
  if (developer === "@dfst") {
    switch (repo) {
      default:
        throw new Error("unknown repo");
    }
  } else if (developer === "@staketab") {
    switch (repo) {
      case "nameservice":
        return await DomainNameServiceWorker(cloud);
      default:
        throw new Error("unknown repo");
    }
  } else throw new Error("unknown developer");
}
