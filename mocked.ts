import { Handler, Context } from "aws-lambda";
import { callLambda } from "./src/lambda/lambda";

const sequencer: Handler = async (event: any, context: Context) => {
  try {
    console.log("run", event);
    if (event.delay !== undefined && event.count !== undefined) {
      const startTime = event.startTime ?? Date.now();
      await run(event.delay, event.count, startTime);
    } else console.error("no event.delay or event.count");

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

const MAX_RUN_TIME = 1000 * 60 * 5; // 5 minutes

async function run(
  delay: number,
  count: number,
  startTime: number
): Promise<void> {
  console.log("Sequencer: start:", { delay, count, startTime });
  let shouldRun: boolean = count > 1;
  const runTime = Date.now() - startTime;
  if (shouldRun && runTime < MAX_RUN_TIME) {
    console.log("Sequencer: run: waiting, emulating runIteration()", delay);
    await sleep(delay > 10000 ? 10000 : delay);
    console.log("Sequencer: run: calling lambda");
    await callLambda(
      "mocked-sequencer",
      JSON.stringify({
        count: count - 1,
        delay: delay,
        startTime: startTime,
      })
    );
    console.log("Sequencer: run: restarting", { shouldRun, runTime });
  } else console.log("Sequencer: run: finished", { shouldRun, runTime });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { sequencer };
