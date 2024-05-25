import { JobData } from "../cloud";
import { publishJobStatusNats } from "./nats";
import { publishJobStatusAlgolia } from "./algolia";

export async function publishJobStatus(job: JobData): Promise<void> {
  await publishJobStatusNats(job);
  await publishJobStatusAlgolia(job);
}
