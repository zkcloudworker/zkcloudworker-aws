import { Table } from "./table";
import {
  JobData,
  JobStatus,
  blockchain,
  makeString,
  LogStream,
  JobEvent,
} from "../cloud";
import { stringHash } from "../api/hash";
import { publishJobStatus } from "../publish/publish";
import { sleep } from "../cloud";

const JOB_EVENTS_TABLE = process.env.JOB_EVENTS_TABLE!;

export class JobEvents extends Table<JobEvent> {}

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
    chain: blockchain;
    filename?: string;
    timeCreated?: number;
    txNumber: number;
    logStreams: LogStream[];
    status?: JobStatus;
    result?: string;
    billedDuration?: number;
    jobId?: string;
    timeFinished?: number;
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
      logStreams,
      status,
      result,
      billedDuration,
      timeFinished,
    } = params;
    const timeCreated: number = params.timeCreated ?? Date.now();
    const jobId: string =
      params.jobId ??
      "zkCW" +
        stringHash(
          JSON.stringify({
            id,
            developer,
            repo,
            chain,
            timeCreated,
            salt: makeString(32),
          })
        );
    //id + "." + timeCreated.toString() + "." + makeString(32);
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
      filename,
      txNumber: params.txNumber,
      timeCreated,
      jobStatus: status ?? ("created" as JobStatus),
      logStreams,
      result,
      billedDuration,
      timeFinished,
    };
    try {
      const event = {
        jobId,
        eventTime: timeCreated,
        jobStatus: status ?? ("created" as JobStatus),
      };
      const publishPromise = publishJobStatus({
        job: item,
        event,
        publishFull: true,
      });
      await this.create(item);
      await publishPromise;

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
    logStreams?: LogStream[];
    maxAttempts?: number;
    billedDuration?: number;
  }): Promise<void> {
    const {
      id,
      jobId,
      status,
      result,
      logStreams,
      billedDuration,
      maxAttempts,
    } = params;
    if (
      status === "finished" &&
      (result === undefined ||
        billedDuration === undefined ||
        maxAttempts === undefined)
    )
      throw new Error(
        "result, maxAttempts, logStreams and billingDuration are required for finished jobs"
      );
    if (status === "started" && logStreams === undefined)
      throw new Error("logStreams is required for started jobs");

    const time: number = Date.now();
    try {
      await this.updateData(
        {
          id: id,
          jobId,
        },
        status === "finished" && logStreams !== undefined
          ? {
              "#S": "jobStatus",
              "#T": "timeFinished",
              "#R": "result",
              "#B": "billedDuration",
              "#M": "maxAttempts",
              "#L": "logStreams",
            }
          : status === "finished" && logStreams === undefined
          ? {
              "#S": "jobStatus",
              "#T": "timeFinished",
              "#R": "result",
              "#B": "billedDuration",
              "#M": "maxAttempts",
            }
          : status === "started"
          ? { "#S": "jobStatus", "#T": "timeStarted", "#L": "logStreams" }
          : status === "used"
          ? { "#S": "jobStatus", "#T": "timeUsed" }
          : { "#S": "jobStatus", "#T": "timeFailed" },
        status === "finished" && logStreams !== undefined
          ? {
              ":status": status,
              ":time": time,
              ":result": result,
              ":billedDuration": billedDuration,
              ":maxAttempts": maxAttempts,
              ":logStreams": logStreams,
            }
          : status === "finished" && logStreams === undefined
          ? {
              ":status": status,
              ":time": time,
              ":result": result,
              ":billedDuration": billedDuration,
              ":maxAttempts": maxAttempts,
            }
          : status === "started"
          ? {
              ":status": status,
              ":time": time,
              ":logStreams": logStreams,
            }
          : { ":status": status, ":time": time },
        status === "finished" && logStreams !== undefined
          ? "set #S = :status, #T = :time, #R = :result, #B = :billedDuration, #M = :maxAttempts, #L = :logStreams"
          : status === "finished" && logStreams === undefined
          ? "set #S = :status, #T = :time, #R = :result, #B = :billedDuration, #M = :maxAttempts"
          : status === "started"
          ? "set #S = :status, #T = :time, #L = :logStreams"
          : "set #S = :status, #T = :time"
      );
      await sleep(100);
      const job = await this.get({
        id,
        jobId,
      });
      if (job === undefined)
        throw new Error("Job not found after updateStatus");
      if (job.jobStatus !== status)
        console.error(
          "Error: Jobs: updateStatus: jobStatus mismatch",
          job.jobStatus,
          status
        );
      const jobEvents = new JobEvents(JOB_EVENTS_TABLE);
      const event: JobEvent = {
        jobId,
        eventTime: time,
        jobStatus: status,
        result,
      };
      await publishJobStatus({ job, event });
      await jobEvents.create(event);
    } catch (error: any) {
      console.error("Error: Jobs: updateStatus", error);
    }
  }

  public async queryBilling(id: string): Promise<JobData[]> {
    return await this.queryData(
      "id = :id",
      { ":id": id },
      "id, billedDuration, timeCreated, timeFinished, jobStatus, jobName, task"
    );
  }
}
