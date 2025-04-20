import { JobData, JobEvent, sleep } from "@silvana-one/prover";
import { publishJobStatusNats } from "./nats.js";
import { publishJobStatusAlgolia } from "./algolia.js";

export async function publishJobStatus(params: {
  job: JobData;
  event: JobEvent;
  publishFull?: boolean;
}): Promise<void> {
  try {
    const started = Date.now();
    let isNatsReady = false;
    let isAlgoliaReady = false;
    publishJobStatusNats(params).then(() => {
      isNatsReady = true;
    });
    publishJobStatusAlgolia(params).then(() => {
      isAlgoliaReady = true;
    });
    const timeout = 5000;
    while (Date.now() - started < timeout) {
      if (isNatsReady && isAlgoliaReady) {
        return;
      }
      await sleep(100);
    }
  } catch (error: any) {
    console.error("publishJobStatus Error:", error);
  }
}
