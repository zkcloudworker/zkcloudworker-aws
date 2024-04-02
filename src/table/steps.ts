import Table from "./table";
import { StepsData } from "../model/stepsData";
import { JobStatus } from "../model/jobsData";

export class Steps extends Table<StepsData> {
  public async updateStatus(params: {
    jobId: string;
    stepId: string;
    status: JobStatus;
    result?: string;
    requiredStatus?: JobStatus;
    attempts?: number;
  }): Promise<StepsData | undefined> {
    const { jobId, stepId, status, result, requiredStatus, attempts } = params;
    const time: number = Date.now();
    try {
      let key = {
        jobId,
        stepId,
      };
      let names: any = undefined;
      let values: any = undefined;
      let updateExpression: string | undefined = undefined;
      let conditionExpression: string | undefined = requiredStatus
        ? "#S = :required"
        : undefined;

      switch (status) {
        case "finished":
          if (result === undefined)
            throw new Error("result is required for finished jobs");
          names = { "#S": "stepStatus", "#T": "timeFinished", "#R": "result" };
          values = {
            ":status": status,
            ":time": time,
            ":result": result,
          };
          updateExpression = "set #S = :status, #T = :time, #R = :result";
          break;

        case "started":
          if (attempts === undefined)
            throw new Error("attempts is required for started jobs");
          names = { "#S": "stepStatus", "#T": "timeStarted", "#A": "attempts" };
          values = {
            ":status": status,
            ":time": time,
            ":attempts": attempts,
          };
          updateExpression = "set #S = :status, #T = :time, #A = :attempts";
          break;

        case "used":
          names = { "#S": "stepStatus", "#T": "timeUsed" };
          values = {
            ":status": status,
            ":time": time,
          };
          updateExpression = "set #S = :status, #T = :time";
          break;

        case "created":
          names = { "#S": "stepStatus", "#T": "timeCreated", "#A": "attempts" };
          values = {
            ":status": status,
            ":time": time,
            ":attempts": attempts ?? 0,
          };
          updateExpression = "set #S = :status, #T = :time, #A = :attempts";
          break;

        case "failed":
          names = { "#S": "stepStatus", "#T": "timeFailed" };
          values = {
            ":status": status,
            ":time": time,
          };
          updateExpression = "set #S = :status, #T = :time";
          break;

        default:
          throw new Error("Unknown status");
      }

      if (requiredStatus !== undefined) {
        values = { ...values, ":required": requiredStatus };
      }

      if (attempts !== undefined && status === "created")
        console.log(
          `attempts: ${attempts}, jobId: ${jobId}, stepId: ${stepId}, names: ${JSON.stringify(
            names
          )}, values: ${JSON.stringify(
            values
          )}, updateExpression: ${updateExpression}, conditionExpression: ${conditionExpression}`
        );

      const updateResult = await this.updateData(
        key,
        names,
        values,
        updateExpression,
        conditionExpression
      );
      if (attempts !== undefined && status === "created")
        console.log(`updateData result: ${updateResult}`);
      return updateResult;
    } catch (e) {
      console.error(`Steps.updateStatus error:`, e);
      try {
        return await this.updateData(
          {
            jobId,
            stepId,
          },
          { "#S": "stepStatus", "#T": "timeFailed" },
          {
            ":time": time,
            ":status": "failed",
          },

          "set #S = :status, #T = :time"
        );
      } catch (e) {
        console.error(`Steps.updateStatus to failed error:`, e);
      }
      return undefined;
    }
    /*
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
          : status === "created"
          ? { "#S": "stepStatus", "#T": "timeCreated", "#A": "attempts" }
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
          ? status === "started"
            ? {
                ":status": status,
                ":time": time,
                ":attempts": attempts,
              }
            : {
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
          : status === "started"
          ? "set #S = :status, #T = :time, #A = :attempts"
          : "set #S = :status, #T = :time",
        requiredStatus === undefined ? undefined : "#S = :required"
      );
      */
  }
}
