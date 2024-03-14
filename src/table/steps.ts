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
    isReverse?: boolean;
  }): Promise<StepsData | undefined> {
    const { jobId, stepId, status, result, requiredStatus, isReverse } = params;
    if (status === "finished" && result === undefined && isReverse !== true)
      throw new Error("result is required for finished jobs");
    const time: number = Date.now();
    if (isReverse === true)
      return await this.updateData(
        {
          jobId,
          stepId,
        },
        { "#S": "stepStatus" },
        {
          ":status": status,
        },
        "set #S = :status"
      );
    else
      return await this.updateData(
        {
          jobId,
          stepId,
        },
        status === "finished"
          ? { "#S": "stepStatus", "#T": "timeFinished", "#R": "result" }
          : status === "started"
          ? { "#S": "stepStatus", "#T": "timeStarted" }
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
            }
          : {
              ":status": status,
              ":time": time,
              ":required": requiredStatus ?? "none",
            },
        status === "finished"
          ? "set #S = :status, #T = :time, #R = :result"
          : "set #S = :status, #T = :time",
        requiredStatus === undefined ? undefined : "#S = :required"
      );
  }
}
