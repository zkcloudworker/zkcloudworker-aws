import { Handler, Context } from "aws-lambda";
import { Sequencer } from "./src/api/sequencer";
import { LogStream } from "zkcloudworker";

const run: Handler = async (event: any, context: Context) => {
  try {
    console.log("run", event);
    if (event.id && event.jobId) {
      const logStream: LogStream = {
        logGroupName: context.logGroupName,
        logStreamName: context.logStreamName,
        awsRequestId: context.awsRequestId,
      };

      const sequencer = new Sequencer({
        jobsTable: process.env.JOBS_TABLE!,
        stepsTable: process.env.STEPS_TABLE!,
        proofsTable: process.env.PROOFS_TABLE!,
        id: event.id,
        jobId: event.jobId,
        logStream: logStream,
      });
      if (event.task === "start") await sequencer.startJob();
      else if (event.task === "run") await sequencer.run();
      else console.error("unknown task");
    } else console.error("no event.id or event.jobId");

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

export { run };
