import Table from "./table";
import { JobsData, JobStatus } from "../model/jobsData";
import { makeString } from "zkcloudworker";

export class Jobs extends Table<JobsData> {
  public async createJob(params: {
    id: string;
    developer: string;
    repo: string;
    task?: string;
    userId?: string;
    args?: string;
    metadata?: string;
    filename?: string;
    timeCreated?: number;
    txNumber: number;
  }): Promise<string | undefined> {
    const { id, developer, repo, filename, task, userId, args, metadata } =
      params;
    const timeCreated: number = params.timeCreated ?? Date.now();
    const jobId: string =
      id + "." + timeCreated.toString() + "." + makeString(32);
    const item: JobsData = {
      id,
      jobId,
      developer,
      repo,
      task,
      userId,
      args,
      metadata,
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
        "result and billingDuration is required for finished jobs"
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

  public async queryBilling(id: string): Promise<JobsData[]> {
    return await this.queryData(
      "id = :id",
      { ":id": id },
      "id, billedDuration, timeCreated, timeFinished, jobStatus, jobName, task"
    );
  }
}
