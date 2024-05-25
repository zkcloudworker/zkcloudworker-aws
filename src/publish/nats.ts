import { connect } from "nats";
import { JobData } from "../cloud";
import config from "../cloud/config";

export async function publishJobStatusNats(job: JobData): Promise<void> {
  const nc = await connect({
    servers: config.ZKCLOUDWORKER_NATS,
  });
  const js = nc.jetstream();
  const kv = await js.views.kv("profiles");

  await kv.put(
    `zkcloudworker.job.${job.developer}.${job.repo}.${job.jobId}`,
    JSON.stringify(job)
  );
  await kv.put(
    `zkcloudworker.jobStatus.${job.jobId}`,
    JSON.stringify({
      status: job.jobStatus,
      time: Date.now(),
      result: job.result,
    })
  );
  await nc.drain();
}
