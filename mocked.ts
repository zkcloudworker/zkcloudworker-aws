import { Handler, Context } from "aws-lambda";
import callLambda from "./src/lambda/lambda";
import { sleep } from "zkcloudworker";

const sequencer: Handler = async (event: any, context: Context) => {
  try {
    console.log("run", event);
    if (event.delay && event.count) {
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
  let shouldRun: boolean = count > 0;
  console.log("Sequencer: run:", { delay, count, startTime });
  await sleep(delay < 10000 ? 10000 : delay);
  let counter = 0;
  if (shouldRun && Date.now() - startTime < MAX_RUN_TIME) {
    await callLambda(
      "mocked-sequencer",
      JSON.stringify({
        count: count - 1,
        delay: delay,
        startTime: startTime,
      })
    );
    console.log("Sequencer: run: restarting");
  } else console.log("Sequencer: run: finished");
}

export { sequencer };
