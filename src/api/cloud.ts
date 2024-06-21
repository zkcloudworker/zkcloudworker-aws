import { getDeployer } from "../mina/deployers";
import {
  Cloud,
  JobData,
  blockchain,
  makeString,
  CloudTransaction,
  TaskData,
  DeployerKeyPair,
  TransactionMetadata,
} from "../cloud";
import { StepsData } from "../model/stepsData";
import { Transactions } from "../table/transactions";
import { KeyValue } from "../table/kv";
import { Deployers } from "../table/deployers";
import { Tasks } from "../table/tasks";
import { createRecursiveProofJob } from "./recursive";
import { createExecuteJob } from "./execute";
import { Sequencer } from "./sequencer";
import { forceRestartLambda } from "../lambda/lambda";
import { stringHash } from "./hash";
import { S3File } from "../storage/s3";
import { publishTransactionMetadata } from "../publish/transaction";

export const cacheDir = "/mnt/efs/cache";
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE!;
const TASKS_TABLE = process.env.TASKS_TABLE!;
const KV_TABLE = process.env.KV_TABLE!;
const DEPLOYERS_TABLE = process.env.DEPLOYERS_TABLE!;
const BUCKET = process.env.BUCKET!;

export class CloudWorker extends Cloud {
  webhook?: string; // TODO: add webhook call to Sequencer

  constructor(params: {
    id: string;
    jobId: string;
    stepId?: string;
    taskId?: string;
    cache?: string;
    developer: string;
    repo: string;
    task?: string;
    userId?: string;
    args?: string;
    metadata?: string;
    chain: blockchain;
    webhook?: string;
  }) {
    //console.log("CloudWorker: constructor", params);
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
      cache: cache ?? cacheDir,
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
  async getDeployer(): Promise<DeployerKeyPair | undefined> {
    const deployer = await getDeployer(4, this.chain);
    return deployer;
  }

  public async releaseDeployer(params: {
    publicKey: string;
    txsHashes: string[];
  }): Promise<void> {
    console.log("Cloud: releaseDeployer", params);
    const { publicKey, txsHashes } = params;
    const deployersTable = new Deployers(DEPLOYERS_TABLE);
    try {
      await deployersTable.create({
        publicKey,
        chain: this.chain,
        timeUsed: Date.now(),
        txs: txsHashes,
      });
    } catch (error) {
      console.error("releaseDeployer: error", params, error);
    }
  }

  async getDataByKey(key: string): Promise<string | undefined> {
    const kvTable = new KeyValue(KV_TABLE);
    const result = await kvTable.get({
      repoId: this.repoId(),
      keyId: key,
    });
    return result?.valueJSON;
  }

  private repoId(): string {
    return this.id + ":" + this.developer + ":" + this.repo;
  }

  async saveDataByKey(key: string, data: string | undefined): Promise<void> {
    const kvTable = new KeyValue(KV_TABLE);
    if (data !== undefined) {
      try {
        await kvTable.create({
          repoId: this.repoId(),
          keyId: key,
          valueJSON: data,
        });
      } catch (error) {
        console.error("saveDataByKey error: ", { error, key, data });
        return undefined;
      }
    } else {
      try {
        await kvTable.remove({
          repoId: this.repoId(),
          keyId: key,
        });
      } catch (error) {
        console.error("saveDataByKey error: ", { error, key, data });
        return undefined;
      }
    }
  }

  async saveFile(filename: string, value: Buffer): Promise<void> {
    //throw new Error("Method not implemented.");
    const key = this.developer + "/" + this.repo + "/" + filename;
    const file = new S3File(process.env.BUCKET!, key);
    await file.put(value, undefined);
  }

  async loadFile(filename: string): Promise<Buffer | undefined> {
    //throw new Error("Method not implemented.");
    const key = this.developer + "/" + this.repo + "/" + filename;
    const file = new S3File(process.env.BUCKET!, key);
    const data = await file.get();
    const buffer = await data?.Body?.transformToByteArray();
    return buffer ? Buffer.from(buffer) : undefined;
  }

  async loadEnvironment(password: string): Promise<void> {
    // TODO: use dotenv to load environment variables
    throw new Error("Method not implemented.");
  }

  public static async addTransactions(data: {
    id: string;
    developer: string;
    repo: string;
    transactions: string[] | CloudTransaction[];
  }): Promise<CloudTransaction[]> {
    const { id, developer, repo, transactions } = data;
    const transactionsTable = new Transactions(TRANSACTIONS_TABLE);
    const repoId = id + ":" + developer + ":" + repo;
    const txs: CloudTransaction[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const timeReceived = Date.now();
      const tx = transactions[i];
      if (typeof tx === "string") {
        const txId = stringHash(JSON.stringify({ tx, time: timeReceived }));
        const ct: CloudTransaction = {
          txId,
          transaction: tx,
          timeReceived,
          status: "received",
        };
        txs.push(ct);
        try {
          await transactionsTable.create({ ...ct, repoId });
        } catch (error) {
          console.error("addTransaction: error", error);
        }
      } else if (tx.txId === undefined) {
        txs.push({
          txId: "invalid",
          transaction: tx.transaction,
          timeReceived: tx.timeReceived,
          status: "invalid",
        });
      } else {
        try {
          txs.push(tx);
          await transactionsTable.create({
            txId: tx.txId,
            repoId,
            transaction: tx.transaction,
            timeReceived: tx.timeReceived,
            status: tx.status,
          });
        } catch (error) {
          console.error("addTransaction: error", error);
        }
      }
    }
    return txs;
  }

  public async sendTransactions(
    transactions: string[] | CloudTransaction[]
  ): Promise<CloudTransaction[]> {
    return CloudWorker.addTransactions({
      id: this.id,
      developer: this.developer,
      repo: this.repo,
      transactions,
    });
  }

  public async deleteTransaction(txId: string): Promise<void> {
    const transactionsTable = new Transactions(TRANSACTIONS_TABLE);
    try {
      await transactionsTable.remove({
        repoId: this.repoId(),
        txId,
      });
    } catch (error) {
      console.log("Transaction does not exist", txId);
    }
  }

  public async getTransactions(): Promise<CloudTransaction[]> {
    const transactionsTable = new Transactions(TRANSACTIONS_TABLE);
    const repoId = this.repoId();
    //console.log("getTransactions: repoId", repoId);
    let results = await transactionsTable.queryData("repoId = :id", {
      ":id": repoId,
    });
    //console.log("getTransactions: results", results);

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
    // sort by timeReceived, old txs first
    results.sort((a, b) => a.timeReceived - b.timeReceived);

    return results.map((result) => {
      return {
        txId: result.txId,
        transaction: result.transaction,
        timeReceived: result.timeReceived,
        status: result.status,
      };
    });
  }

  public async publishTransactionMetadata(params: {
    txId: string;
    metadata: TransactionMetadata;
  }): Promise<void> {
    const { txId, metadata } = params;
    await publishTransactionMetadata({
      chain: this.chain,
      txId,
      metadata,
      developer: this.developer,
      repo: this.repo,
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
    const jobResult = await sequencer.getJobStatus(false);
    return jobResult;
  }

  public async addTask(data: {
    task: string;
    userId?: string;
    args?: string;
    metadata?: string;
    maxAttempts?: number;
  }): Promise<string> {
    console.log("addTask", data);
    const { task, userId, args, metadata, maxAttempts } = data;
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
      maxAttempts: maxAttempts ?? 5,
      attempts: 0,
      chain: this.chain,
    };
    console.log("addTask: taskData", taskData);
    await tasksTable.create(taskData);
    return taskData.taskId;
  }

  public async deleteTask(taskId: string): Promise<void> {
    const tasksTable = new Tasks(TASKS_TABLE);
    console.log("deleteTask", { id: this.id, taskId });
    await tasksTable.remove({ id: this.id, taskId });
  }

  public async processTasks(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async forceWorkerRestart(): Promise<void> {
    console.error("forceWorkerRestart", {
      developer: this.developer,
      repo: this.repo,
      jobId: this.jobId,
      task: this.task,
    });
    await forceRestartLambda();
  }
}

export class JobCloudWorker extends CloudWorker {
  constructor(job: JobData) {
    super({
      id: job.id,
      jobId: job.jobId,
      developer: job.developer,
      repo: job.repo,
      taskId: job.taskId,
      task: job.task,
      userId: job.userId,
      args: job.args,
      metadata: job.metadata,
      chain: job.chain,
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
    const { jobId, developer, repo, task, userId, args, metadata, id, taskId } =
      job;
    super({
      id,
      jobId,
      developer,
      repo,
      task,
      taskId,
      userId,
      args,
      metadata,
      cache: cacheDir,
      chain: job.chain,
    });
  }
}
