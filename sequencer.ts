import { Handler, Context } from "aws-lambda";
import Sequencer from "./src/api/sequencer";

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

export { run };
