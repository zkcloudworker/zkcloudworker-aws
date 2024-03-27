import { Handler, Context } from "aws-lambda";
import Sequencer from "./src/api/sequencer";
import { StepsData } from "./src/model/stepsData";
import Jobs from "./src/table/jobs";
import Steps from "./src/table/steps";
import { runStep } from "./src/api/step";
import { BackendPlugin } from "zkcloudworker";
import { getBackupPlugin } from "./src/api/plugin";

const step: Handler = async (event: any, context: Context) => {
  if (event.stepData === undefined) {
    console.error("no event.stepData", event);
    return {
      statusCode: 200,
      body: "sequencer step error",
    };
  }
  const step = event.stepData as StepsData;
  console.log("step", step.name, step.jobId, step.stepId);
  try {
    const plugin: BackendPlugin = await getBackupPlugin({
      developer: step.developer,
      name: step.name,
      task: step.task,
      args: step.args,
    });
    await runStep(step, plugin);
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
    });

    const JobsTable = new Jobs(process.env.JOBS_TABLE!);
    await JobsTable.updateStatus({
      username: step.username,
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

const run: Handler = async (event: any, context: Context) => {
  try {
    console.log("run", event);
    if (event.username && event.jobId) {
      const sequencer = new Sequencer({
        jobsTable: process.env.JOBS_TABLE!,
        stepsTable: process.env.STEPS_TABLE!,
        proofsTable: process.env.PROOFS_TABLE!,
        username: event.username,
        jobId: event.jobId,
      });
      if (event.task === "start") await sequencer.startJob();
      else if (event.task === "run") await sequencer.run();
      else console.error("unknown task");
    } else console.error("no event.username or event.jobId");

    return {
      statusCode: 200,
      body: "ok",
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "sequencer run error",
    };
  }
};

export { run, step };
