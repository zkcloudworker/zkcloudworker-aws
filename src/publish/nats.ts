import { connect } from "nats";
import { JobData, JobEvent } from "../cloud";
import config from "../cloud/config";

export async function publishJobStatusNats(params: {
  job: JobData;
  event: JobEvent;
  publishFull?: boolean;
}): Promise<void> {
  const { job, event, publishFull } = params;
  try {
    const nc = await connect({
      servers: config.ZKCLOUDWORKER_NATS,
      timeout: 3000,
    });
    const js = nc.jetstream();
    const kv = await js.views.kv("profiles", { timeout: 2000 });
    if (publishFull === true) {
      const updateFull = await kv.put(
        `zkcloudworker.job.${clean(job.developer)}.${clean(job.repo)}`,
        JSON.stringify(job)
      );
      console.log(`NATS: Job status updated for ${job.jobId}:`, {
        updateFull,
      });
    }

    const updateStatus = await kv.put(
      `zkcloudworker.jobStatus.${event.jobId}`,
      JSON.stringify(event)
    );
    console.log(`NATS: Job status updated for ${event.jobId}:`, {
      updateStatus,
    });

    await nc.drain();
  } catch (error) {
    console.error(`NATS: Error publishing job status`, { error, job });
  }
}

function clean(input: string): string {
  // Define the allowed characters based on the regular expression
  const allowedChars = /^[-/=.\w]+$/;

  // Filter the input string to include only the allowed characters
  const filtered = input
    .split("")
    .filter((char) => allowedChars.test(char))
    .join("");

  return filtered;
}
