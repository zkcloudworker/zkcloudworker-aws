import { Cache, PrivateKey } from "o1js";
import { getDeployer } from "../mina/deployers";
import { minaInit } from "../mina/init";
import {
  Cloud,
  JobData,
  blockchain,
  makeString,
  CloudTransaction,
  TaskData,
} from "zkcloudworker";
import { StepsData } from "../model/stepsData";
import { Transactions } from "../table/transactions";
import { Tasks } from "../table/tasks";
import { createRecursiveProofJob } from "./recursive";
import { createExecuteJob } from "./execute";
import { Sequencer } from "./sequencer";

export const cacheDir = "/mnt/efs/cache";
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE!;
const TASKS_TABLE = process.env.TASKS_TABLE!;

export class CloudWorker extends Cloud {
  webhook?: string; // TODO: add webhook call to Sequencer

  constructor(params: {
    id: string;
    jobId: string;
    stepId?: string;
    taskId?: string;
    cache?: Cache;
    developer: string;
    repo: string;
    task?: string;
    userId?: string;
    args?: string;
    metadata?: string;
    chain: blockchain;
    webhook?: string;
  }) {
    console.log("CloudWorker: constructor", params);
    const {
      id,
      jobId,
      stepId,
      taskId,
      cache,
      developer,
      repo,
      task,
      userId,
      args,
      metadata,
      chain,
      webhook,
    } = params;
    super({
      id,
      jobId,
      stepId: stepId ?? "",
      taskId: taskId ?? "",
      cache: cache ?? Cache.FileSystem(cacheDir),
      developer,
      repo,
      task,
      userId,
      args,
      metadata,
      isLocalCloud: false,
      chain,
    });
    this.webhook = webhook;
  }
  async getDeployer(): Promise<PrivateKey> {
    minaInit(this.chain);
    const deployer = await getDeployer(4, this.chain);
    return deployer;
  }

  public async releaseDeployer(txsHashes: string[]): Promise<void> {
    // TODO: add txsHashes to the DynamoDB tables: Jobs, Deployers
    console.log("Cloud: releaseDeployer", txsHashes);
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

  public static async addTransaction(data: {
    id: string;
    developer: string;
    repo: string;
    transaction: string;
  }): Promise<string | undefined> {
    const { id, developer, repo, transaction } = data;
    const timeReceived = Date.now();
    const repoId = id + ":" + developer + ":" + repo;
    const txId = timeReceived.toString() + "." + makeString(32);
    const transactionsTable = new Transactions(TRANSACTIONS_TABLE);
    try {
      await transactionsTable.create({
        txId,
        repoId,
        transaction,
        timeReceived,
      });
      return txId;
    } catch (error) {
      console.error("addTransaction: ", error);
      return undefined;
    }
  }

  public async deleteTransaction(txId: string): Promise<void> {
    const transactionsTable = new Transactions(TRANSACTIONS_TABLE);
    await transactionsTable.remove({
      repoId: this.id + ":" + this.developer + ":" + this.repo,
      txId,
    });
  }

  public async getTransactions(): Promise<CloudTransaction[]> {
    const transactionsTable = new Transactions(TRANSACTIONS_TABLE);
    const repoId = this.id + ":" + this.developer + ":" + this.repo;
    console.log("getTransactions: repoId", repoId);
    let results = await transactionsTable.queryData("repoId = :id", {
      ":id": repoId,
    });
    console.log("getTransactions: results", results);

    if (results === undefined) {
      console.error("getTransactions: results is undefined");
      return [];
    }

    if (results.length === undefined) {
      console.error("getTransactions: results.length is undefined");
      return [];
    }

    if (results.length === 0) {
      console.log("getTransactions: no results");
      return [];
    }
    return results.map((result) => {
      return {
        txId: result.txId,
        transaction: result.transaction,
        timeReceived: result.timeReceived,
      };
    });
  }

  public async recursiveProof(data: {
    transactions: string[];
    task?: string;
    userId?: string;
    args?: string;
    metadata?: string;
  }): Promise<string> {
    const result = await createRecursiveProofJob({
      id: this.id,
      developer: this.developer,
      transactions: data.transactions,
      repo: this.repo,
      task: data.task ?? "recursiveProof",
      args: data.args,
      metadata: data.metadata,
      userId: data.userId,
      chain: this.chain,
      webhook: this.webhook,
    });
    if (result.success === false || result.jobId === undefined) {
      throw new Error(`cloud: recursiveProof: ${result.error}`);
    } else return result.jobId;
  }

  public async execute(data: {
    transactions: string[];
    task: string;
    userId?: string;
    args?: string;
    metadata?: string;
  }): Promise<string> {
    const result = await createExecuteJob({
      command: "execute",
      data: {
        id: this.id,
        developer: this.developer,
        transactions: data.transactions,
        repo: this.repo,
        task: data.task,
        args: data.args,
        metadata: data.metadata,
        chain: this.chain,
        webhook: this.webhook,
      },
    });
    if (result.success === false || result.jobId === undefined) {
      throw new Error(`cloud: recursiveProof: ${result.error}`);
    } else return result.jobId;
  }

  public async jobResult(jobId: string): Promise<JobData | undefined> {
    const sequencer = new Sequencer({
      jobsTable: process.env.JOBS_TABLE!,
      stepsTable: process.env.STEPS_TABLE!,
      proofsTable: process.env.PROOFS_TABLE!,
      id: this.id,
      jobId,
    });
    const jobResult = await sequencer.getJobStatus();
    return jobResult;
  }

  public async addTask(data: {
    task: string;
    userId?: string;
    args?: string;
    metadata?: string;
  }): Promise<string> {
    console.log("addTask", data);
    const { task, userId, args, metadata } = data;
    const timeCreated = Date.now();
    const tasksTable = new Tasks(TASKS_TABLE);
    const taskData: TaskData = {
      id: this.id,
      taskId: timeCreated.toString() + "." + makeString(32),
      timeCreated,
      developer: this.developer,
      repo: this.repo,
      task,
      userId,
      args,
      metadata,
      chain: this.chain,
    };
    console.log("addTask: taskData", taskData);
    await tasksTable.create(taskData);
    return taskData.taskId;
  }

  public async deleteTask(taskId: string): Promise<void> {
    const tasksTable = new Tasks(TASKS_TABLE);
    await tasksTable.remove({ id: this.id, taskId });
  }

  public async processTasks(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export class JobCloudWorker extends CloudWorker {
  constructor(job: JobData) {
    super({
      id: job.id,
      jobId: job.jobId,
      developer: job.developer,
      repo: job.repo,
      task: job.task,
      userId: job.userId,
      args: job.args,
      metadata: job.metadata,
      chain: job.chain,
      webhook: job.webhook,
    });
  }
}

export class StepCloudWorker extends CloudWorker {
  constructor(step: StepsData) {
    super({
      id: step.id,
      jobId: step.jobId,
      stepId: step.stepId,
      developer: step.developer,
      repo: step.repo,
      task: step.task,
      userId: step.userId,
      args: step.args,
      metadata: step.metadata,
      chain: step.chain,
    });
  }
}

export class ExecuteCloudWorker extends CloudWorker {
  constructor(job: JobData) {
    const { jobId, developer, repo, task, userId, args, metadata, id } = job;
    const cache: Cache = Cache.FileSystem(cacheDir);
    super({
      id,
      jobId,
      developer,
      repo,
      task,
      userId,
      args,
      metadata,
      cache,
      chain: job.chain,
      webhook: job.webhook,
    });
  }
}
