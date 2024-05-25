import { JobData } from "../cloud";
import { publishJobStatusNats } from "./nats";
import { publishJobStatusAlgolia } from "./algolia";

export async function publishJobStatus(
  job: JobData,
  publishFull: boolean = false
): Promise<void> {
  await publishJobStatusNats(job, publishFull);
  await publishJobStatusAlgolia(job);
}
