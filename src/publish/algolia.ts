import { JobData } from "../cloud";
import algoliasearch from "algoliasearch";

export async function publishJobStatusAlgolia(job: JobData): Promise<void> {
  const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT;
  const ALGOLIA_KEY = process.env.ALGOLIA_KEY;
  if (!ALGOLIA_PROJECT || !ALGOLIA_KEY) {
    throw new Error("ALGOLIA_PROJECT or ALGOLIA_KEY is not set");
  }
  try {
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("jobs");
    const result = await index.saveObject({
      objectID: job.jobId,
      ...job,
    });
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
