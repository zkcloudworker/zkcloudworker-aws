import { Table } from "./table";
import { JobData, JobStatus, blockchain, makeString } from "zkcloudworker";

export class Jobs extends Table<JobData> {
  public async createJob(params: {
    id: string;
    developer: string;
    repo: string;
    taskId?: string;
    task?: string;
    userId?: string;
    args?: string;
    metadata?: string;
    webhook?: string;
    chain: blockchain;
    filename?: string;
    timeCreated?: number;
    txNumber: number;
  }): Promise<string | undefined> {
    const {
      id,
      developer,
      repo,
      taskId,
      filename,
      task,
      userId,
      args,
      metadata,
      chain,
      webhook,
    } = params;
    const timeCreated: number = params.timeCreated ?? Date.now();
    const jobId: string =
      id + "." + timeCreated.toString() + "." + makeString(32);
    const item: JobData = {
      id,
      jobId,
      developer,
      repo,
      taskId,
      task,
      userId,
      args,
      metadata,
      chain,
      webhook,
      filename,
      txNumber: params.txNumber,
      timeCreated,
      timeCreatedString: new Date(timeCreated).toISOString(),
      jobStatus: "created" as JobStatus,
      maxAttempts: 0,
    };
    try {
      await this.create(item);
      return jobId;
    } catch (error: any) {
      console.error("Error: Jobs: createJob", error);
      return undefined;
    }
  }

  public async updateStatus(params: {
    id: string;
    jobId: string;
    status: JobStatus;
    result?: string;
    maxAttempts?: number;
    billedDuration?: number;
  }): Promise<void> {
    const { id, jobId, status, result, billedDuration, maxAttempts } = params;
    if (
      status === "finished" &&
      (result === undefined ||
        billedDuration === undefined ||
        maxAttempts === undefined)
    )
      throw new Error(
        "result, maxAttempts and billingDuration is required for finished jobs"
      );
    const time: number = Date.now();
    await this.updateData(
      {
        id: id,
        jobId,
      },
      status === "finished"
        ? {
            "#S": "jobStatus",
            "#T": "timeFinished",
            "#R": "result",
            "#B": "billedDuration",
            "#M": "maxAttempts",
          }
        : status === "started"
        ? { "#S": "jobStatus", "#T": "timeStarted" }
        : status === "used"
        ? { "#S": "jobStatus", "#T": "timeUsed" }
        : { "#S": "jobStatus", "#T": "timeFailed" },
      status === "finished"
        ? {
            ":status": status,
            ":time": time,
            ":result": result,
            ":billedDuration": billedDuration,
            ":maxAttempts": maxAttempts,
          }
        : { ":status": status, ":time": time },
      status === "finished"
        ? "set #S = :status, #T = :time, #R = :result, #B = :billedDuration, #M = :maxAttempts"
        : "set #S = :status, #T = :time"
    );
  }

  public async queryBilling(id: string): Promise<JobData[]> {
    return await this.queryData(
      "id = :id",
      { ":id": id },
      "id, billedDuration, timeCreated, timeFinished, jobStatus, jobName, task"
    );
  }
}
