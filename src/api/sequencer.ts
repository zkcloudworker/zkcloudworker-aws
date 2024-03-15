import Jobs from "../table/jobs";
import Steps from "../table/steps";
import Proofs from "../table/proofs";
import { JobStatus, JobsData } from "../model/jobsData";
import { StepsData, StepTask, ProofsData } from "../model/stepsData";

import callLambda from "../lambda/lambda";
import { makeString, sleep } from "zkcloudworker";
import { S3File, copyStringToS3 } from "../storage/s3";

export default class Sequencer {
  jobsTable: string;
  stepsTable: string;
  proofsTable: string;
  username: string;
  jobId?: string;
  startTime: number;
  readonly MAX_RUN_TIME: number = 1000 * 60 * 10; // 10 minutes
  readonly MAX_JOB_TIME: number = 1000 * 60 * 60 * 2; // 2 hours TODO: enforce this

  constructor(params: {
    jobsTable: string;
    stepsTable: string;
    proofsTable: string;
    username: string;
    jobId?: string;
  }) {
    this.startTime = Date.now();
    this.jobsTable = params.jobsTable;
    this.stepsTable = params.stepsTable;
    this.proofsTable = params.proofsTable;
    this.username = params.username;
    this.jobId = params.jobId;
  }

  public async createJob(params: {
    username: string;
    developer: string;
    name: string;
    jobData: string[];
    task: string;
    args: string[];
    txNumber?: number;
  }): Promise<string | undefined> {
    const { username, developer, name, jobData, task, args } = params;
    if (this.username !== params.username) throw new Error("username mismatch");
    if ((task === "verify" || task === "send") && jobData.length !== 1)
      throw new Error("jobData length is not 1 for task:verify or send");
    const JobsTable = new Jobs(this.jobsTable);
    const jobId = await JobsTable.createJob({
      username,
      developer,
      jobName: name,
      jobData,
      task,
      args,
      txNumber: params.txNumber ?? jobData.length,
    });
    if (jobId !== undefined && task !== "mint")
      await callLambda(
        "sequencer",
        JSON.stringify({ task: "start", username: this.username, jobId })
      );
    return jobId;
  }

  public async updateJobStatus(params: {
    status: JobStatus;
    result?: string;
  }): Promise<void> {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const JobsTable = new Jobs(this.jobsTable);
    await JobsTable.updateStatus({
      ...params,
      username: this.username,
      jobId: this.jobId,
    });
  }

  public async startJob() {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const JobsTable = new Jobs(this.jobsTable);
    const StepsTable = new Steps(this.stepsTable);
    const job: JobsData | undefined = await JobsTable.get({
      id: this.username,
      jobId: this.jobId,
    });
    if (job === undefined) throw new Error("job not found");
    if ((job.task === "verify" || job.task === "send") && job.txNumber !== 1) {
      await JobsTable.updateStatus({
        username: this.username,
        jobId: this.jobId,
        status: "failed",
      });
      throw new Error("jobData length is not 1 for task:verify or send");
    }
    if (job.txNumber === 0) {
      await JobsTable.updateStatus({
        username: this.username,
        jobId: this.jobId,
        status: "failed",
      });
      throw new Error("jobData length is 0");
    }
    let transactions: string[] = job.jobData;
    if (job.developer === "@staketab") {
      const file = new S3File(process.env.BUCKET!, job.jobData[0]);
      const data = await file.get();
      const streamToString = await data.Body?.transformToString("utf8");
      if (streamToString === undefined) {
        throw new Error("Error: streamToString is undefined");
      }
      const json = JSON.parse(streamToString.toString());
      transactions = json.transactions;
      console.log(
        "Sequencer: startJob: @staketab transactions",
        transactions.length
      );
    }
    for (let i = 0; i < transactions.length; i++) {
      const stepId: string = i.toString();
      const task =
        job.task === "verify"
          ? "verify"
          : job.task === "mint"
          ? "mint"
          : job.task === "send"
          ? "send"
          : "create";
      const stepData: StepsData = {
        jobId: this.jobId,
        stepId,
        username: this.username,
        developer: job.developer,
        name: job.jobName,
        jobTask: job.task,
        args: job.args,
        task: task as StepTask,
        origins: [i.toString()],
        stepData: [transactions[i]],
        timeCreated: Date.now(),
        stepStatus: "created" as JobStatus,
      };
      try {
        await StepsTable.create(stepData);
        await callLambda("step", JSON.stringify({ stepData }));
      } catch (error: any) {
        console.error("Error: Sequencer: startJob", error);
        throw new Error("Error: Sequencer: startJob");
      }
    }
    await JobsTable.updateStatus({
      username: this.username,
      jobId: this.jobId,
      status: "started",
    });
    await this.run();
  }

  /*
  public async restart() {
    await sleep(5000);
    await callLambda(
      "sequencer",
      JSON.stringify({
        task: "run",
        username: this.username,
        jobId: this.jobId,
      })
    );
    console.log("Sequencer: run: restarting");
  }
*/
  public async run(): Promise<void> {
    let shouldRun: boolean = true;
    while (shouldRun && Date.now() - this.startTime < this.MAX_RUN_TIME) {
      await sleep(1000);
      shouldRun = await this.runIteration();
    }
    if (shouldRun) {
      const JobsTable = new Jobs(this.jobsTable);
      const job = await JobsTable.get({
        id: this.username,
        jobId: this.jobId,
      });
      console.log("Sequencer: run: job", job);
      if (job === undefined) throw new Error("job not found");

      if (job.jobStatus === "failed") {
        console.log("Sequencer: run: job is failed, exiting");
        return;
      }
      if (job.jobStatus === "finished" || job.jobStatus === "used") {
        console.log("Sequencer: run: job is finished or used, exiting");
        return;
      }
      if (Date.now() - job.timeCreated > this.MAX_JOB_TIME) {
        console.error("Sequencer: run: job is too old, exiting");
        return;
      }
      await callLambda(
        "sequencer",
        JSON.stringify({
          task: "run",
          username: this.username,
          jobId: this.jobId,
        })
      );
      console.log("Sequencer: run: restarting");
    } else console.log("Sequencer: run: finished");
  }

  public async runIteration(): Promise<boolean> {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const ProofsTable = new Proofs(this.proofsTable);
    const StepsTable = new Steps(this.stepsTable);

    let results = await ProofsTable.queryData("jobId = :id", {
      ":id": this.jobId,
    });

    if (results.length === 0) {
      //console.log("Sequencer: run: no finished results");
      return true;
    }

    const JobsTable = new Jobs(this.jobsTable);
    const job = await JobsTable.get({
      id: this.username,
      jobId: this.jobId,
    });
    if (job === undefined) throw new Error("job not found");

    if (job.jobStatus === "failed") {
      console.log("Sequencer: run: job is failed, exiting");
      return false;
    }
    if (job.jobStatus === "finished" || job.jobStatus === "used") {
      console.log("Sequencer: run: job is finished or used, exiting");
      return false;
    }
    if (Date.now() - job.timeCreated > this.MAX_JOB_TIME) {
      console.error("Sequencer: run: job is too old, exiting");
      return false;
    }

    if (results.length === 1) {
      // We probably have final result, let's check
      //console.log("Sequencer: run: checking for final result");
      const resultMetadata = results[0];
      const result: StepsData | undefined = await StepsTable.get({
        jobId: this.jobId,
        stepId: resultMetadata.stepId,
      });
      if (result === undefined) {
        console.log("Sequencer: run: result is undefined, exiting");
        return true;
      }
      if (result.result === undefined) throw new Error("result is undefined");

      if (job.txNumber !== result.origins.length) {
        /*
        console.log(
          "final result check: jobData length does not match origins length, exiting"
        );
        */
        return true;
      }
      for (let i = 0; i < result.origins.length; i++)
        if (
          result.origins.find((origin) => origin === i.toString()) === undefined
        )
          throw new Error(`origin ${i} not found`);
      await JobsTable.updateStatus({
        username: this.username,
        jobId: this.jobId,
        status: "finished",
        result: result.result,
        billedDuration:
          (result.billedDuration ?? 0) +
          (result.timeFinished ?? 0) -
          (result.timeStarted ?? 0),
      });
      await StepsTable.remove({
        jobId: this.jobId,
        stepId: resultMetadata.stepId,
      });
      await ProofsTable.remove({
        jobId: this.jobId,
        stepId: resultMetadata.stepId,
      });
      console.log("Sequencer: run: final result written");
      return false;
    }
    console.log("Sequencer: run: results", results.length);
    // We have more than one result, we need to merge
    if (job.jobName === "rfc-voting") {
      let txs = [];
      let billedDuration = 0;
      while (true) {
        console.log(
          "Sequencer: run: rfc-voting results length",
          results.length,
          "total length",
          txs.length
        );
        for (let i = 0; i < results.length; i++) {
          const step: StepsData | undefined = await StepsTable.get({
            jobId: this.jobId,
            stepId: results[i].stepId,
          });
          if (step === undefined) throw new Error("step is undefined");
          if (step.result === undefined)
            throw new Error("step.result is undefined");
          if (step.timeStarted === undefined || step.timeFinished === undefined)
            throw new Error("step.time is undefined");
          txs.push(JSON.parse(step.result));
          billedDuration += step.timeFinished - step.timeStarted;
          await StepsTable.remove({
            jobId: this.jobId,
            stepId: step.stepId,
          });
          await ProofsTable.remove({
            jobId: this.jobId,
            stepId: step.stepId,
          });
        }
        if (txs.length === job.txNumber) {
          const filename = await copyStringToS3(JSON.stringify({ txs }));
          await JobsTable.updateStatus({
            username: this.username,
            jobId: this.jobId,
            status: "finished",
            result: filename,
            billedDuration,
          });
          console.log(
            "Sequencer: run: rfc-voting final result written",
            txs.length.toString()
          );
          return false;
        } else {
          await sleep(1000);
          results = await ProofsTable.queryData("jobId = :id", {
            ":id": this.jobId,
          });
          console.log(
            "Sequencer: run: rfc-voting new results total",
            results.length
          );
        }
      }
    }

    const matches: { first: number; second: number }[] = [];
    if (job.task === "proofMap") {
      const lowest: number[] = [];
      const highest: number[] = [];
      for (let i = 0; i < results.length; i++) {
        const step: StepsData | undefined = await StepsTable.get({
          jobId: this.jobId,
          stepId: results[i].stepId,
        });
        if (step === undefined) throw new Error("step is undefined");
        const origins = step.origins;
        // find lowest and highest number in origins
        lowest.push(Math.min(...origins.map((origin) => parseInt(origin))));
        highest.push(Math.max(...origins.map((origin) => parseInt(origin))));
      }
      //console.log("Sequencer: run: lowest", lowest);
      //console.log("Sequencer: run: highest", highest);
      // find matches where the lowest and highest are the different by one
      for (let i = 0; i < lowest.length; i++)
        for (let j = 0; j < highest.length; j++)
          if (lowest[i] === highest[j] + 1) {
            // we can merge these two proofs if the proof is not already merging
            // check is i or j is already in matches
            if (
              i !== j &&
              matches.find(
                (match) =>
                  match.first === j ||
                  match.second === i ||
                  match.first === i ||
                  match.second === j
              ) === undefined
            )
              matches.push({ first: j, second: i });
          }
      //console.log("Sequencer: run: matches", matches);
      /*
      matches.forEach((match) => {
        const { first, second } = match;
        if (first - second !== 1 && second - first !== 1)
          throw new Error(`Sequencer: run: match error ${first}, ${second}`);
      });
      */
    } else {
      for (let i = 0; i < results.length; i += 2)
        if (i + 1 < results.length) matches.push({ first: i, second: i + 1 });
    }
    const stepResults = [];
    for (let i = 0; i < matches.length; i++) {
      const updatedStep1 = await StepsTable.updateStatus({
        jobId: this.jobId,
        stepId: results[matches[i].first].stepId,
        status: "used",
        requiredStatus: "finished",
      });
      if (updatedStep1 === undefined)
        console.log("Sequencer: run: updateStatus operation failed");
      else if (updatedStep1.stepStatus !== "used")
        console.log(
          "Sequencer: run: updateStatus update failed, current status:",
          updatedStep1.stepId,
          updatedStep1.stepStatus
        );
      else stepResults.push(results[matches[i].first]);
      const updatedStep2 = await StepsTable.updateStatus({
        jobId: this.jobId,
        stepId: results[matches[i].second].stepId,
        status: "used",
        requiredStatus: "finished",
      });
      if (updatedStep2 === undefined)
        console.log("Sequencer: run: updateStatus operation failed");
      else if (updatedStep2.stepStatus !== "used")
        console.log(
          "Sequencer: run: updateStatus update failed, current status:",
          updatedStep2.stepId,
          updatedStep2.stepStatus
        );
      else stepResults.push(results[matches[i].second]);
    }

    if (stepResults.length === 0) {
      console.log("Sequencer: run: no results to merge after trying to lock");
      return true;
    }
    /*
    const stepResults = [];
    //console.log("Sequencer: run: results", results.length);
    for (let i = 0; i < results.length; i++) {
      const step = results[i];
      const updatedStep = await StepsTable.updateStatus({
        jobId: this.jobId,
        stepId: step.stepId,
        status: "used",
        requiredStatus: "finished",
      });
      if (updatedStep === undefined)
        console.log("Sequencer: run: updateStatus operation failed");
      else if (updatedStep.stepStatus !== "used")
        console.log(
          "Sequencer: run: updateStatus update failed, current status:",
          updatedStep.stepId,
          updatedStep.stepStatus
        );
      else stepResults.push(step);
    }
    if (stepResults.length === 0) {
      console.log("Sequencer: run: no results to merge after trying to lock");
      return true;
    } else {
      if (stepResults.length % 2 === 1) {
        // We have odd number of results, we need to return the last one back to the queue
        await StepsTable.updateStatus({
          jobId: this.jobId,
          stepId: stepResults[stepResults.length - 1].stepId,
          status: "finished",
          isReverse: true,
          //result: stepResults[stepResults.length - 1].result,
        });
        const updatedStep = await StepsTable.get({
          jobId: this.jobId,
          stepId: stepResults[stepResults.length - 1].stepId,
        });
        if (updatedStep === undefined)
          throw new Error("updatedStep is undefined");
        if (updatedStep.stepStatus !== "finished")
          throw new Error("updatedStep is not finished");
        console.log(
          "Sequencer: run: odd number of results, returning last one"
        );
      }
      */
    const mergeStepsNumber = Math.floor(stepResults.length / 2);
    if (mergeStepsNumber > 0) {
      const JobsTable = new Jobs(this.jobsTable);
      const job = await JobsTable.get({
        id: this.username,
        jobId: this.jobId,
      });
      if (job === undefined) throw new Error("job not found");

      if (job.jobStatus === "failed") {
        console.log("Sequencer: run: job is failed, exiting");
        return false;
      }
      // Let's give previous step instance to exit to reuse the lambda instance
      await sleep(1000);

      for (let i = 0; i < mergeStepsNumber; i++) {
        const stepId: string = Date.now().toString() + "." + makeString(32);
        const step1: StepsData | undefined = await StepsTable.get({
          jobId: this.jobId,
          stepId: stepResults[2 * i].stepId,
        });
        const step2: StepsData | undefined = await StepsTable.get({
          jobId: this.jobId,
          stepId: stepResults[2 * i + 1].stepId,
        });
        if (step1 === undefined || step2 === undefined)
          throw new Error("step is undefined");

        const name = step1.name;
        const jobTask = step1.jobTask;
        const args = step1.args;
        const developer = step1.developer;
        if (name !== step2.name) throw new Error("name mismatch");
        if (jobTask !== step2.jobTask) throw new Error("jobTask mismatch");
        if (args.length !== step2.args.length)
          throw new Error("arguments mismatch");
        if (developer !== step2.developer)
          throw new Error("developer mismatch");
        if (step1.result === undefined || step2.result === undefined)
          throw new Error(`result is undefined`);
        else if (
          step1.timeStarted === undefined ||
          step1.timeFinished === undefined ||
          step2.timeStarted === undefined ||
          step2.timeFinished === undefined
        )
          throw new Error(`time is undefined`);
        else {
          const billedDuration =
            (step1.billedDuration ?? 0) +
            (step2.billedDuration ?? 0) +
            step1.timeFinished -
            step1.timeStarted +
            step2.timeFinished -
            step2.timeStarted;
          const stepData: StepsData = {
            jobId: this.jobId,
            stepId,
            username: this.username,
            developer,
            name,
            jobTask,
            args,
            task: "merge" as StepTask,
            origins: [...step1.origins, ...step2.origins],
            stepData: [step1.result!, step2.result!],
            timeCreated: Date.now(),
            stepStatus: "created" as JobStatus,
            billedDuration,
          };
          try {
            await StepsTable.create(stepData);
            await callLambda("step", JSON.stringify({ stepData }));
            console.log(
              `Sequencer: run: started merging ${stepData.origins.length} proofs`
            );
            await StepsTable.remove({
              jobId: this.jobId,
              stepId: step1.stepId,
            });
            await StepsTable.remove({
              jobId: this.jobId,
              stepId: step2.stepId,
            });
            await ProofsTable.remove({
              jobId: this.jobId,
              stepId: step1.stepId,
            });
            await ProofsTable.remove({
              jobId: this.jobId,
              stepId: step2.stepId,
            });
          } catch (error: any) {
            console.error("Error: Sequencer: createStep", error);
          }
        }
      }
    }

    return true;
  }

  public async getJobStatus(): Promise<JobsData> {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const JobsTable = new Jobs(this.jobsTable);
    const job: JobsData | undefined = await JobsTable.get({
      id: this.username,
      jobId: this.jobId,
    });
    if (job === undefined) throw new Error("job not found");
    if (job.jobStatus === "finished")
      await JobsTable.updateStatus({
        username: this.username,
        jobId: this.jobId,
        status: "used",
      });
    return job;
  }
}
