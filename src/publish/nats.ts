import { connect } from "nats";
import { JobData } from "../cloud";
import config from "../cloud/config";

export async function publishJobStatusNats(
  job: JobData,
  publishFull: boolean = false
): Promise<void> {
  try {
    const nc = await connect({
      servers: config.ZKCLOUDWORKER_NATS,
    });
    const js = nc.jetstream();
    const kv = await js.views.kv("profiles");
    if (publishFull) {
      const updateFull = await kv.put(`zkcloudworker.job`, JSON.stringify(job));
      console.log(`NATS: Job status updated for ${job.jobId}:`, {
        updateFull,
      });
    }

    const updateStatus = await kv.put(
      `zkcloudworker.jobStatus.${job.jobId}`,
      JSON.stringify({
        status: job.jobStatus,
        time: Date.now(),
        result: job.result,
      })
    );
    console.log(`NATS: Job status updated for ${job.jobId}:`, {
      updateStatus,
    });

    await nc.drain();
  } catch (error) {
    console.error(`NATS: Error publishing job status`, { error, job });
  }
}
