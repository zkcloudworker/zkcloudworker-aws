import { Jobs } from "../table/jobs.js";
import { Steps } from "../table/steps.js";
import { Proofs } from "../table/proofs.js";
import {
  JobStatus,
  JobData,
  blockchain,
  makeString,
  sleep,
  formatTime,
  LogStream,
} from "@silvana-one/prover";
import { StepsData, StepTask } from "../model/stepsData.js";
import { callLambda } from "../lambda/lambda.js";
import { S3File } from "../storage/s3.js";
import { getLogs } from "./logs.js";
import { charge } from "../table/balance.js";

export class Sequencer {
  jobsTable: string;
  stepsTable: string;
  proofsTable: string;
  id: string;
  jobId?: string;
  startTime: number;
  logStream?: LogStream;
  readonly MAX_RUN_TIME: number = 1000 * 60 * 10; // 10 minutes
  readonly MAX_STEP_START_TIME: number = 1000 * 60 * 5; // 5 minutes
  readonly MAX_STEP_RUN_TIME: number = 1000 * 60 * 10; // 10 minutes
  readonly MAX_JOB_TIME: number = 1000 * 60 * 30; // 30 minutes
  readonly MIN_ITERATION_INTERVAL: number = 1000 * 10; // 10 seconds

  constructor(params: {
    jobsTable: string;
    stepsTable: string;
    proofsTable: string;
    id: string;
    jobId?: string;
    logStream?: LogStream;
  }) {
    this.startTime = Date.now();
    this.jobsTable = params.jobsTable;
    this.stepsTable = params.stepsTable;
    this.proofsTable = params.proofsTable;
    this.id = params.id;
    this.jobId = params.jobId;
    this.logStream = params.logStream;
  }

  public async createJob(params: {
    id: string;
    developer: string;
    repo: string;
    taskId?: string;
    filename: string;
    task?: string;
    args?: string;
    txNumber: number;
    metadata?: string;
    userId?: string;
    webhook?: string;
    chain: blockchain;
  }): Promise<string | undefined> {
    const {
      id,
      developer,
      repo,
      taskId,
      filename,
      task,
      args,
      metadata,
      userId,
      txNumber,
      webhook,
      chain,
    } = params;
    if (chain !== "zeko" && chain !== "devnet" && chain !== "mainnet") {
      console.error(
        "Error: Sequencer: createJob: chain is not supported",
        chain
      );
      return undefined;
    }
    if (this.id !== params.id) throw new Error("id mismatch");
    const JobsTable = new Jobs(this.jobsTable);
    const jobId = await JobsTable.createJob({
      id,
      developer,
      repo,
      taskId,
      filename,
      task,
      args,
      txNumber,
      metadata,
      userId,
      chain,
      logStreams: this.logStream ? [this.logStream] : [],
    });
    if (jobId !== undefined)
      await callLambda(
        "sequencer",
        JSON.stringify({ task: "start", id: this.id, jobId })
      );
    return jobId;
  }

  public async updateJobStatus(params: {
    status: JobStatus;
    result?: string;
    logStreams: LogStream[];
  }): Promise<void> {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const { status, result, logStreams } = params;
    const JobsTable = new Jobs(this.jobsTable);
    const job = await JobsTable.get({
      id: this.id,
      jobId: this.jobId,
    });
    await JobsTable.updateStatus({
      status,
      result,
      id: this.id,
      jobId: this.jobId,
      logStreams: job?.logStreams
        ? [...job.logStreams, ...logStreams]
        : logStreams,
    });
  }

  public async startJob() {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const JobsTable = new Jobs(this.jobsTable);
    const StepsTable = new Steps(this.stepsTable);
    const job: JobData | undefined = await JobsTable.get({
      id: this.id,
      jobId: this.jobId,
    });
    if (job === undefined) throw new Error("job not found");
    if (job.txNumber === 0) {
      await JobsTable.updateStatus({
        id: this.id,
        jobId: this.jobId,
        status: "failed",
      });
      throw new Error("txNumber is 0");
    }
    if (job.filename === undefined) throw new Error("filename is undefined");
    let transactions: string[] = [];
    const file = new S3File(process.env.BUCKET!, job.filename);
    const data = await file.get();
    if (data?.Body === undefined)
      throw new Error("Error: data.Body is undefined");
    const streamToString = await data.Body?.transformToString("utf8");
    if (streamToString === undefined) {
      throw new Error("Error: streamToString is undefined");
    }
    const json = JSON.parse(streamToString.toString());
    transactions = json.transactions;
    console.log(
      "Sequencer: startJob: number of transactions:",
      transactions.length
    );
    if (job.txNumber !== transactions.length) {
      console.error(
        "Sequencer: startJob: job.txNumber does not match transactions length",
        job.txNumber,
        transactions.length
      );
      await JobsTable.updateStatus({
        id: this.id,
        jobId: this.jobId,
        status: "failed",
      });
      return;
    }

    for (let i = 0; i < transactions.length; i++) {
      const stepId: string = i.toString();
      const stepData: StepsData = {
        jobId: this.jobId,
        stepId,
        id: this.id,
        developer: job.developer,
        repo: job.repo,
        jobTask: job.task,
        args: job.args,
        metadata: job.metadata,
        chain: job.chain,
        userId: job.userId,
        task: "create" as StepTask,
        origins: [i.toString()],
        stepData: [transactions[i]],
        timeCreated: Date.now(),
        attempts: 0,
        stepStatus: "created" as JobStatus,
        maxAttempts: 0,
        logStreams: [],
      };
      try {
        await StepsTable.create(stepData);
        await callLambda("step-" + job.chain, JSON.stringify({ stepData }));
      } catch (error: any) {
        console.error("Error: Sequencer: startJob", error);
        throw new Error("Error: Sequencer: startJob");
      }
    }
    await JobsTable.updateStatus({
      id: this.id,
      jobId: this.jobId,
      status: "started",
      logStreams: job?.logStreams
        ? this.logStream
          ? [...job.logStreams, this.logStream]
          : job.logStreams
        : this.logStream
        ? [this.logStream]
        : [],
    });
    await this.run();
  }

  public async run(): Promise<void> {
    if (this.jobId === undefined)
      throw new Error("Error: Sequencer: run: jobId is undefined");
    const JobsTable = new Jobs(this.jobsTable);
    let shouldRun: boolean = true;
    let counter = 0;
    let iterationStartTime = Date.now();
    while (shouldRun && Date.now() - this.startTime < this.MAX_RUN_TIME) {
      const iterationDuration = Date.now() - iterationStartTime;
      if (iterationDuration < this.MIN_ITERATION_INTERVAL) {
        await sleep(this.MIN_ITERATION_INTERVAL - iterationDuration);
      }
      try {
        //shouldRun = (await this.runIteration()) && (await this.checkHealth());
        iterationStartTime = Date.now();
        shouldRun = await this.runIteration();
        if (counter % 4 === 0) await this.checkHealth();
      } catch (error: any) {
        console.error("Error: Sequencer: run: iteration", error);
        shouldRun = false;

        await JobsTable.updateStatus({
          id: this.id,
          jobId: this.jobId,
          status: "failed",
        });
      }
    }
    if (shouldRun) {
      const job = await JobsTable.get({
        id: this.id,
        jobId: this.jobId,
      });
      console.log("Sequencer: run: job", job);
      if (job === undefined) throw new Error("job not found");
      if (job.timeCreated === undefined) {
        console.error("Sequencer: run: job.timeStarted is undefined");
        return;
      }
      if (job.jobStatus === undefined) {
        console.error("Sequencer: run: job.jobStatus is undefined");
        return;
      }

      if (job.jobStatus === "failed") {
        console.log("Sequencer: run: job is failed, exiting");
        return;
      }
      if (job.jobStatus === "finished" || job.jobStatus === "used") {
        console.log("Sequencer: run: job is finished or used, exiting");
        return;
      }
      if (Date.now() - job.timeCreated > this.MAX_JOB_TIME) {
        console.error(
          "Sequencer: run: job is too old, exiting, jobId:",
          this.jobId
        );
        if (this.jobId !== undefined) {
          const JobsTable = new Jobs(this.jobsTable);
          await JobsTable.updateStatus({
            id: this.id,
            jobId: this.jobId,
            status: "failed",
          });
        }
        return;
      }
      await callLambda(
        "sequencer",
        JSON.stringify({
          task: "run",
          id: this.id,
          jobId: this.jobId,
        })
      );
      // TODO: check that the sequencer is actually restarted
      console.log("Sequencer: run: restarting");
    } else console.log("Sequencer: run: finished");
  }

  public async checkHealth(): Promise<void> {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const StepsTable = new Steps(this.stepsTable);

    const results = await StepsTable.queryData(
      "jobId = :id",
      {
        ":id": this.jobId,
      },
      "stepId, stepStatus, timeCreated, attempts, task, jobTask, timeStarted"
    );
    //console.log("Sequencer: checkHealth: results", results.length);
    const timeNow = Date.now();
    const unhealthy = results.filter((result) => {
      const delay = timeNow - result.timeCreated;
      const allowedStartDelay = this.MAX_STEP_START_TIME;
      const allowedRunDelay = this.MAX_STEP_RUN_TIME;
      const isUnhealthy =
        (result.stepStatus === "created" && delay > allowedStartDelay) ||
        (result.stepStatus === "started" &&
          result.timeStarted !== undefined &&
          timeNow - result.timeStarted > allowedRunDelay);
      if (isUnhealthy)
        console.error("Sequencer: checkHealth: unhealthy step detected", {
          jobId: this.jobId,
          stepId: result.stepId,
          stepStatus: result.stepStatus,
          timeStuck: formatTime(delay), // in milliseconds
          allowedStartDelay: formatTime(allowedStartDelay),
          allowedRunDelay: formatTime(allowedRunDelay),
          attempts: result.attempts,
          task: result.task,
          jobTask: result.jobTask,
          timeCreated: result.timeCreated,
          timeStarted: result.timeStarted,
        });
      return isUnhealthy;
    });
    if (
      unhealthy !== undefined &&
      unhealthy.length !== undefined &&
      unhealthy.length > 0
    ) {
      console.error("Sequencer: checkHealth: unhealthy", {
        results: unhealthy.length,
        jobId: this.jobId,
      });
    }
  }

  /*
  public async checkHealth(): Promise<boolean> {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const StepsTable = new Steps(this.stepsTable);
    const JobsTable = new Jobs(this.jobsTable);

    const results = await StepsTable.queryData(
      "jobId = :id",
      {
        ":id": this.jobId,
      },
      "stepId, stepStatus, timeCreated, attempts, task, jobTask, timeStarted"
    );
    //console.log("Sequencer: checkHealth: results", results.length);
    const timeNow = Date.now();
    const unhealthy = results.filter((result) => {
      const delay = timeNow - result.timeCreated;
      const attempts = result.attempts ?? 0;
      const allowedDelay = this.MAX_START_TIME * (attempts + 1);
      const isUnhealthy =
        result.stepStatus === "created" && delay > allowedDelay;
      if (isUnhealthy)
        console.error("Sequencer: checkHealth: unhealthy step detected", {
          stepStatus: result.stepStatus,
          stepId: result.stepId,
          attempts: result.attempts,
          timeStuck: delay, // in milliseconds
          allowedDelay,
          task: result.task,
          jobTask: result.jobTask,
          timeCreated: result.timeCreated,
          timeStarted: result.timeStarted,
        });
      return isUnhealthy;
    });
    if (unhealthy === undefined) {
      console.error(
        "Sequencer: checkHealth: unhealthy is undefined",
        unhealthy
      );
      await JobsTable.updateStatus({
        id: this.id,
        jobId: this.jobId,
        status: "failed",
      });
      return false;
    }
    if (unhealthy.length === undefined) {
      console.error(
        "Sequencer: checkHealth: unhealthy.length is undefined",
        unhealthy
      );
      await JobsTable.updateStatus({
        id: this.id,
        jobId: this.jobId,
        status: "failed",
      });
      return false;
    }
    if (unhealthy.length > 0) {
      console.error("Sequencer: checkHealth: unhealthy", {
        results: unhealthy.length,
        jobId: this.jobId,
      });
      for (const result of unhealthy) {
        console.log("Sequencer: checkHealth: restarting unhealthy step 1/3", {
          stepStatus: result.stepStatus,
          stepId: result.stepId,
          attempts: result.attempts,
          timeStuck: timeNow - result.timeCreated, // in milliseconds
          task: result.task,
          jobTask: result.jobTask,
          timeCreated: result.timeCreated,
          timeStarted: result.timeStarted,
        });
        await sleep(1000);
        const stepData: StepsData | undefined = await StepsTable.get({
          jobId: this.jobId,
          stepId: result.stepId,
        });
        if (stepData === undefined) {
          console.error(
            "Sequencer: checkHealth: stepData is undefined, exiting"
          );
          await JobsTable.updateStatus({
            id: this.id,
            jobId: this.jobId,
            status: "failed",
          });
          return false;
        }
        console.log("Sequencer: checkHealth: restarting unhealthy step 2/3", {
          stepStatus: stepData.stepStatus,
          stepId: stepData.stepId,
          attempts: result.attempts,
          getAttempts: stepData.attempts,
          timeStuck: timeNow - stepData.timeCreated, // in milliseconds
          task: stepData.task,
          jobTask: stepData.jobTask,
          timeCreated: stepData.timeCreated,
          timeStarted: stepData.timeStarted,
          queryStatus: result.stepStatus,
          getStatus: stepData.stepStatus,
        });
        if (
          timeNow - stepData.timeCreated >
            this.MAX_START_TIME * (stepData.attempts + 1) &&
          stepData.stepStatus === "created"
        ) {
          if (stepData.attempts > MAX_STEP_ATTEMPTS) {
            console.error("Sequencer: checkHealth: step failed", {
              jobId: this.jobId,
              stepId: result.stepId,
              attempts: stepData.attempts,
            });
            await StepsTable.updateStatus({
              jobId: this.jobId,
              stepId: result.stepId,
              status: "failed",
            });
            await JobsTable.updateStatus({
              id: this.id,
              jobId: this.jobId,
              status: "failed",
            });
            return false;
          } else {
            await StepsTable.updateStatus({
              jobId: this.jobId,
              stepId: result.stepId,
              status: "created",
              attempts: (stepData.attempts ?? 0) + 1,
            });
            await sleep(1000);
            const stepData3: StepsData | undefined = await StepsTable.get({
              jobId: this.jobId,
              stepId: result.stepId,
            });
            if (stepData3 === undefined) {
              console.error(
                "Sequencer: checkHealth: stepData is undefined, exiting"
              );
              await JobsTable.updateStatus({
                id: this.id,
                jobId: this.jobId,
                status: "failed",
              });
              return false;
            }
            console.log(
              "Sequencer: checkHealth: restarting unhealthy step 3/3",
              {
                stepStatus: stepData3.stepStatus,
                stepId: stepData3.stepId,
                attempts: result.attempts,
                getAttempts: stepData3.attempts,
                timeStuck: Date.now() - stepData.timeCreated, // in milliseconds
                task: stepData3.task,
                jobTask: stepData3.jobTask,
                queryStatus: result.stepStatus,
                getStatus: stepData3.stepStatus,
                timeCreated: stepData3.timeCreated,
                timeStarted: stepData3.timeStarted,
              }
            );
            try {
              
              await callLambda(
                "step",
                JSON.stringify({ stepData }),
                stepData3.attempts + 1
              );
              
              await sleep(1000);
            } catch (error: any) {
              console.error("Error: Sequencer: checkHealth:", error);
              await JobsTable.updateStatus({
                id: this.id,
                jobId: this.jobId,
                status: "failed",
              });
              return false;
            }
          }
        } else {
          console.error("Sequencer: checkHealth: step is not stuck, exiting", {
            jobId: this.jobId,
            stepId: result.stepId,
            attempts: result.attempts,
            getAttempts: stepData.attempts,
            queryStatus: result.stepStatus,
            getStatus: stepData.stepStatus,
            timeStuck: Date.now() - result.timeCreated, // in milliseconds
          });
        }
      }
    }
    return true;
  }
*/

  public async runIteration(): Promise<boolean> {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const ProofsTable = new Proofs(this.proofsTable);
    const StepsTable = new Steps(this.stepsTable);
    const JobsTable = new Jobs(this.jobsTable);

    try {
      let results = await ProofsTable.queryData("jobId = :id", {
        ":id": this.jobId,
      });

      if (results === undefined) {
        console.error("Sequencer: runIteration: results is undefined");
        return true;
      }

      if (results.length === undefined) {
        console.error("Sequencer: runIteration: results.length is undefined");
        return true;
      }

      if (results.length === 0) {
        //console.log("Sequencer: run: no finished results");
        return true;
      }

      const job = await JobsTable.get({
        id: this.id,
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

        if (job.txNumber !== result.origins?.length) {
          /*
        console.log(
          "final result check: jobData length does not match origins length, exiting"
        );
        */
          return true;
        }
        for (let i = 0; i < result.origins?.length; i++)
          if (
            result.origins.find((origin) => origin === i.toString()) ===
            undefined
          )
            throw new Error(`origin ${i} not found`);
        //console.log("Sequencer: run: final result", result);
        const billedDuration =
          (result.billedDuration ?? 0) +
          (result.timeFinished ?? 0) -
          (result.timeStarted ?? 0);
        await charge({
          id: this.id,
          billedDuration,
          jobId: this.jobId,
        });
        await JobsTable.updateStatus({
          id: this.id,
          jobId: this.jobId,
          status: "finished",
          result: result.result,
          billedDuration,
          maxAttempts: Math.max(result.attempts, result.maxAttempts),
          logStreams: [...(job.logStreams ?? []), ...(result.logStreams ?? [])],
        });
        await StepsTable.remove({
          jobId: this.jobId,
          stepId: resultMetadata.stepId,
        });
        await ProofsTable.remove({
          jobId: this.jobId,
          stepId: resultMetadata.stepId,
        });
        if (job.filename !== undefined) {
          const file = new S3File(process.env.BUCKET!, job.filename);
          await file.remove();
        } else console.error("Sequencer: run: job.filename is undefined");
        console.log("Sequencer: run: final result written");
        return false;
      }
      console.log("Sequencer: run: results", results.length);
      // We have more than one result, we need to merge them

      const matches: { first: number; second: number }[] = [];
      const lowest: number[] = [];
      const highest: number[] = [];
      for (let i = 0; i < results.length; i++) {
        const step: StepsData | undefined = await StepsTable.get({
          jobId: this.jobId,
          stepId: results[i].stepId,
        });
        if (step === undefined) throw new Error("step is undefined");
        const origins = step.origins;
        if (origins === undefined) throw new Error("origins is undefined");
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

      const mergeStepsNumber = Math.floor(stepResults.length / 2);
      if (mergeStepsNumber > 0) {
        const JobsTable = new Jobs(this.jobsTable);
        const job = await JobsTable.get({
          id: this.id,
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

          if (step1.repo === undefined || step2.repo === undefined)
            throw new Error("repo is undefined");
          if (step1.jobTask === undefined || step2.jobTask === undefined)
            throw new Error("jobTask is undefined");
          if (step1.args === undefined || step2.args === undefined)
            throw new Error("args is undefined");
          if (step1.developer === undefined || step2.developer === undefined)
            throw new Error("developer is undefined");
          if (step1.result === undefined || step2.result === undefined)
            throw new Error("result is undefined");
          if (
            step1.timeStarted === undefined ||
            step1.timeFinished === undefined ||
            step2.timeStarted === undefined ||
            step2.timeFinished === undefined
          )
            throw new Error("time is undefined");

          if (
            step1.attempts === undefined ||
            step1.maxAttempts === undefined ||
            step2.attempts === undefined ||
            step2.maxAttempts === undefined
          )
            throw new Error("attempts is undefined");

          const jobTask = step1.jobTask;
          const args = step1.args;
          const developer = step1.developer;
          const metadata = step1.metadata;
          const userId = step1.userId;
          const repo = step1.repo;
          const chain = step1.chain;
          if (repo !== step2.repo) throw new Error("repo mismatch");
          if (jobTask !== step2.jobTask) throw new Error("jobTask mismatch");
          if (step1.chain !== step2.chain) throw new Error("chain mismatch");
          if (args.length !== step2.args.length)
            throw new Error("arguments mismatch");
          if (developer !== step2.developer)
            throw new Error("developer mismatch");
          if (step1.origins === undefined || step2.origins === undefined)
            throw new Error("step origins are undefined");

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
            const maxAttempts = Math.max(
              step1.attempts,
              step1.maxAttempts,
              step2.attempts,
              step2.maxAttempts
            );
            const stepData: StepsData = {
              jobId: this.jobId,
              stepId,
              id: this.id,
              developer,
              repo,
              metadata,
              chain,
              userId,
              jobTask,
              args,
              task: "merge" as StepTask,
              origins: [...step1.origins, ...step2.origins],
              stepData: [step1.result!, step2.result!],
              timeCreated: Date.now(),
              attempts: 0,
              stepStatus: "created" as JobStatus,
              maxAttempts,
              billedDuration,
              logStreams: [
                ...(step1.logStreams ?? []),
                ...(step2.logStreams ?? []),
              ],
            };
            try {
              await StepsTable.create(stepData);
              await callLambda("step-" + chain, JSON.stringify({ stepData }));
              console.log(
                `Sequencer: run: started merging ${
                  stepData.origins?.length
                } proofs \nstep1 started in ${formatTime(
                  step1.timeStarted - step1.timeCreated
                )}, calculated in ${formatTime(
                  step1.timeFinished - step1.timeStarted
                )}, \nstep2 started in ${formatTime(
                  step2.timeStarted - step2.timeCreated
                )}, calculated in ${formatTime(
                  step2.timeFinished - step2.timeStarted
                )}`
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
    } catch (error: any) {
      console.error("Error: Sequencer: runIteration", error);
      await JobsTable.updateStatus({
        id: this.id,
        jobId: this.jobId,
        status: "failed",
      });
      return false;
    }
  }

  public async getJobStatus(includeLogs: boolean): Promise<JobData> {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const JobsTable = new Jobs(this.jobsTable);
    const job: JobData | undefined = await JobsTable.get({
      id: this.id,
      jobId: this.jobId,
    });
    if (job === undefined) throw new Error("job not found");
    if (job.jobStatus === "finished")
      await JobsTable.updateStatus({
        id: this.id,
        jobId: this.jobId,
        status: "used",
      });
    if (includeLogs) {
      const { logs, isFullLog } = await getLogs([
        ...(job.logStreams ?? []),
        ...(this.logStream ? [this.logStream] : []),
      ]);
      job.logs = logs;
      job.isFullLog = isFullLog;
    }
    return job;
  }
}
