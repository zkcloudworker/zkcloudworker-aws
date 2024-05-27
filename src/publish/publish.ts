import { JobData, JobEvent } from "../cloud";
import { publishJobStatusNats } from "./nats";
import { publishJobStatusAlgolia } from "./algolia";

export async function publishJobStatus(params: {
  job: JobData;
  event: JobEvent;
  publishFull?: boolean;
}): Promise<void> {
  await publishJobStatusNats(params);
  await publishJobStatusAlgolia(params);
}
