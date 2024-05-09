import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { LogStream } from "zkcloudworker";

export async function getLogs(
  logStreams: LogStream[] | undefined
): Promise<string[]> {
  console.log("getLogs logStreams", logStreams);
  if (logStreams === undefined) return [];
  if (Array.isArray(logStreams) === false) return [];
  if (logStreams.length === 0) return [];
  const result: string[] = [];
  const options = {};

  try {
    const client = new CloudWatchLogsClient(options);
    for (const log of logStreams) {
      const command = new GetLogEventsCommand({
        logGroupName: log.logGroupName,
        logStreamName: log.logStreamName,
      });

      const data = await client.send(command);
      console.log(
        "getLogs",
        data.$metadata,
        data.nextBackwardToken,
        data.nextForwardToken
      );
      //console.log("getLogs events", data.events);
      if (data.events !== undefined && log.awsRequestId !== undefined) {
        const searchString = log.awsRequestId + "\t";
        const events = data.events
          .filter((event) => event.message?.includes(searchString))
          .map((event) => event.message?.replace(searchString, "") as string);
        result.push(...events);
      }
    }
    console.log("getLogs result", result);
    return result;
  } catch (error: any) {
    console.error("getLogs error:", error);
    return [];
  }
}
