import Table from "./table";
import { StepsData } from "../model/stepsData";
import { JobStatus } from "../model/jobsData";

export default class Steps extends Table<StepsData> {
  public async updateStatus(params: {
    jobId: string;
    stepId: string;
    status: JobStatus;
    result?: string;
    requiredStatus?: JobStatus;
    attempts?: number;
  }): Promise<StepsData | undefined> {
    const { jobId, stepId, status, result, requiredStatus } = params;
    if (status === "finished" && result === undefined)
      throw new Error("result is required for finished jobs");
    if (status === "started" && params.attempts === undefined)
      throw new Error("attempts is required for started jobs");
    const attempts: number = params.attempts ?? 1;
    const time: number = Date.now();
    return await this.updateData(
      {
        jobId,
        stepId,
      },
      status === "finished"
        ? { "#S": "stepStatus", "#T": "timeFinished", "#R": "result" }
        : status === "started"
        ? { "#S": "stepStatus", "#T": "timeStarted", "#A": "attempts" }
        : status === "used"
        ? { "#S": "stepStatus", "#T": "timeUsed" }
        : { "#S": "stepStatus", "#T": "timeFailed" },
      status === "finished"
        ? requiredStatus === undefined
          ? {
              ":status": status,
              ":time": time,
              ":result": result,
            }
          : {
              ":status": status,
              ":time": time,
              ":required": requiredStatus,
              ":result": result,
            }
        : requiredStatus === undefined
        ? {
            ":status": status,
            ":time": time,
            ":attempts": attempts,
          }
        : {
            ":status": status,
            ":time": time,
            ":required": requiredStatus ?? "none",
            ":attempts": attempts,
          },
      status === "finished"
        ? "set #S = :status, #T = :time, #R = :result"
        : status === "started"
        ? "set #S = :status, #T = :time, #A = :attempts"
        : "set #S = :status, #T = :time",
      requiredStatus === undefined ? undefined : "#S = :required"
    );
  }
}
