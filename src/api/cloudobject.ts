import { Cache, PrivateKey } from "o1js";
import { getDeployer } from "../mina/deployers";
import { minaInit } from "../mina/init";
import { Cloud } from "zkcloudworker";
import { StepsData } from "../model/stepsData";

export const cacheDir = "/mnt/efs/cache";

export class CloudWorker extends Cloud {
  constructor(params: {
    jobId: string;
    stepId: string;
    cache: Cache;
    developer: string;
    repo: string;
    task?: string;
    userId?: string;
    args?: string;
    metadata?: string;
  }) {
    super(params);
  }
  async getDeployer(): Promise<PrivateKey> {
    minaInit();
    const deployer = await getDeployer(0);
    return deployer;
  }
  async log(msg: string): Promise<void> {
    console.log("CloudWorker:", msg);
  }

  async getDataByKey(key: string): Promise<string | undefined> {
    throw new Error("Method not implemented.");
  }

  async saveDataByKey(key: string, data: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async saveFile(filename: string, value: Buffer): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async loadFile(filename: string): Promise<Buffer | undefined> {
    throw new Error("Method not implemented.");
  }

  async loadEnvironment(password: string): Promise<void> {
    // TODO: use dotenv to load environment variables
    throw new Error("Method not implemented.");
  }
}

export class StepCloudWorker extends CloudWorker {
  constructor(step: StepsData) {
    const cache: Cache = Cache.FileSystem(cacheDir);
    super({
      jobId: step.jobId,
      stepId: step.stepId,
      cache,
      developer: step.developer,
      repo: step.repo,
      task: step.task,
      userId: step.userId,
      args: step.args,
      metadata: step.metadata,
    });
  }
}
