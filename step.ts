import { Handler, Context } from "aws-lambda";
import { StepsData } from "./src/model/stepsData";
import Jobs from "./src/table/jobs";
import Steps from "./src/table/steps";
import { runStep } from "./src/api/step";
import { BackendPlugin } from "zkcloudworker";
import { getBackupPlugin } from "./src/api/plugin";

const run: Handler = async (event: any, context: Context) => {
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

export { run };
