import { JobData } from "../cloud";
import algoliasearch from "algoliasearch";

export async function publishJobStatusAlgolia(job: JobData): Promise<void> {
  try {
    const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT;
    const ALGOLIA_KEY = process.env.ALGOLIA_KEY;
    if (!ALGOLIA_PROJECT || !ALGOLIA_KEY) {
      throw new Error("ALGOLIA_PROJECT or ALGOLIA_KEY is not set");
    }
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("jobs");
    const data = {
      objectID: job.jobId,
      ...job,
      args: undefined,
      transactions: undefined,
      webhook: undefined,
      cloudhook: undefined,
      previousJob: undefined,
      filename: undefined,
      result: undefined,
      logStreams: undefined,
      logs: undefined,
    };
    /*
    console.log(
      "publishJobStatusAlgolia: Algolia write data for job",
      job.jobId,
      "is ",
      data
    );
    */
    const result = await index.saveObject(data);
    if (result.taskID === undefined) {
      console.error(
        "publishJobStatusAlgolia: Algolia write result for job",
        job.jobId,
        "is ",
        result
      );
    }
  } catch (error) {
    console.error("publishJobStatusAlgolia error:", { error, job });
  }
}
