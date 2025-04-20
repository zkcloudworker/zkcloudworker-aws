import { Handler, Context } from "aws-lambda";
import { StepsData } from "./src/model/stepsData.js";
import { Jobs } from "./src/table/jobs.js";
import { Steps } from "./src/table/steps.js";
import { runStep } from "./src/api/step.js";
import { LogStream } from "@silvana-one/prover";
import { getWorker } from "./src/api/worker.js";
import { StepCloudWorker } from "./src/api/cloud.js";

const run: Handler = async (event: any, context: Context) => {
  if (event.stepData === undefined) {
    console.error("no event.stepData", event);
    return {
      statusCode: 200,
      body: "sequencer step error",
    };
  }
  const logStream: LogStream = {
    logGroupName: context.logGroupName,
    logStreamName: context.logStreamName,
    awsRequestId: context.awsRequestId,
  };

  const step = event.stepData as StepsData;
  step.logStreams = step.logStreams
    ? [...step.logStreams, logStream]
    : [logStream];
  console.log("step", {
    jobId: step.jobId,
    stepId: step.stepId,
    developer: step.developer,
    repo: step.repo,
    task: step.task,
    metadata: step.metadata,
    logStreams: step.logStreams,
  });
  try {
    const cloud = new StepCloudWorker(step);
    const { worker, error } = await getWorker({
      developer: step.developer,
      repo: step.repo,
      cloud,
    });
    if (worker === undefined) {
      console.error("step: worker not found", error);
      throw new Error("step: worker not found");
    }
    await runStep(step, worker);
    return {
      statusCode: 200,
      body: "ok",
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    const StepsTable = new Steps(process.env.STEPS_TABLE!);
    await StepsTable.updateStatus({
      jobId: step.jobId,
      stepId: step.stepId,
      status: "failed",
      logStreams: step.logStreams,
    });

    const JobsTable = new Jobs(process.env.JOBS_TABLE!);
    await JobsTable.updateStatus({
      id: step.id,
      jobId: step.jobId,
      status: "failed",
      billedDuration: step.billedDuration ?? 0,
    });

    return {
      statusCode: 200,
      body: "sequencer step error",
    };
  }
};

export { run };
