import { Steps } from "../table/steps";
import { Proofs } from "../table/proofs";
import { Jobs } from "../table/jobs";
import { StepsData, MAX_STEP_ATTEMPTS } from "../model/stepsData";
import { zkCloudWorker, Memory } from "../cloud";
import { cacheDir } from "./cloud";
import { listFiles } from "../storage/files";

export async function runStep(
  step: StepsData,
  worker: zkCloudWorker
): Promise<void> {
  console.time("runStep");
  console.log(`runStep start:`, {
    task: step.task,
    stepId: step.stepId,
    jobId: step.jobId,
    attempts: step.attempts,
  });
  Memory.info(`start`);

  const StepsTable = new Steps(process.env.STEPS_TABLE!);

  try {
    if (step.attempts > MAX_STEP_ATTEMPTS) {
      await StepsTable.updateStatus({
        jobId: step.jobId,
        stepId: step.stepId,
        status: "failed",
      });
      console.error("runStep: maximum number of attempts is reached");
      return;
    }

    await StepsTable.updateStatus({
      jobId: step.jobId,
      stepId: step.stepId,
      status: "started",
      attempts: step.attempts + 1,
      logStreams: step.logStreams,
    });

    let result: string | undefined = undefined;

    await listFiles(cacheDir);

    if (step.task === "create") {
      if (step.stepData.length !== 1)
        throw new Error("Input length not 1 for create");
      console.time(`created proof`);
      result = await worker.create(step.stepData[0]);
      console.timeEnd(`created proof`);
    } else if (step.task === "merge") {
      if (step.stepData.length !== 2)
        throw new Error("Input length not 2 for merge");

      console.time(`step: merged proofs`);
      result = await worker.merge(step.stepData[0], step.stepData[1]);
      console.timeEnd(`step: merged proofs`);
    } else throw new Error("unsupported task");
    Memory.info(`calculated`);
    if (result === undefined) {
      console.error("runStep: result is undefined", step);
      await StepsTable.updateStatus({
        jobId: step.jobId,
        stepId: step.stepId,
        status: "failed",
      });
      const JobsTable = new Jobs(process.env.JOBS_TABLE!);
      await JobsTable.updateStatus({
        id: step.id,
        jobId: step.jobId,
        status: "failed",
        billedDuration: step.billedDuration ?? 0,
      });
      Memory.info(`failed`);
      console.timeEnd("runStep");
      return;
    }

    await StepsTable.updateStatus({
      jobId: step.jobId,
      stepId: step.stepId,
      status: "finished",
      result: result,
    });

    const ProofsTable = new Proofs(process.env.PROOFS_TABLE!);
    await ProofsTable.create({
      jobId: step.jobId,
      stepId: step.stepId,
    });
  } catch (error) {
    console.error("runStep error:", (<any>error).toString());
    await StepsTable.updateStatus({
      jobId: step.jobId,
      stepId: step.stepId,
      status: "failed",
    });

    const JobsTable = new Jobs(process.env.JOBS_TABLE!);
    await JobsTable.updateStatus({
      id: step.id,
      jobId: step.jobId,
      status: "failed",
      billedDuration: step.billedDuration ?? 0,
    });
    Memory.info(`failed`);
  }
  Memory.info(`finished`);
  console.timeEnd("runStep");
}
