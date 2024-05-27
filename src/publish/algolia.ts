import { JobData, JobEvent } from "../cloud";
import algoliasearch from "algoliasearch";

export async function publishJobStatusAlgolia(params: {
  job: JobData;
  event: JobEvent;
  publishFull?: boolean;
}): Promise<void> {
  const { job, event } = params;
  try {
    const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT;
    const ALGOLIA_KEY = process.env.ALGOLIA_KEY;
    if (!ALGOLIA_PROJECT || !ALGOLIA_KEY) {
      throw new Error("ALGOLIA_PROJECT or ALGOLIA_KEY is not set");
    }
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);

    const jobIndex = client.initIndex("jobs");
    const data = {
      objectID: job.jobId,
      ...job,
      args: undefined,
      transactions: undefined,
      filename: undefined,
      result: undefined,
      logStreams: undefined,
      logs: undefined,
    };
    let result = await jobIndex.saveObject(data);
    if (result.taskID === undefined) {
      console.error(
        "publishJobStatusAlgolia: Algolia write result for job",
        job.jobId,
        "is ",
        result
      );
    }

    const jobEventIndex = client.initIndex("job_events");
    let resultString = undefined;
    if (event.result !== undefined) {
      resultString =
        event.result.substring(0, 100) +
        (event.result.length > 100
          ? `...${event.result.length - 100} more characters`
          : "");
    }
    const dataEvent = {
      objectID: event.jobId + "." + event.eventTime.toString(),
      ...event,
      result: resultString,
    };
    result = await jobEventIndex.saveObject(dataEvent);
    if (result.taskID === undefined) {
      console.error(
        "publishJobStatusAlgolia: Algolia write result for jobEvent",
        job.jobId,
        "is ",
        result
      );
    }
  } catch (error) {
    console.error("publishJobStatusAlgolia error:", { error, job });
  }
}
