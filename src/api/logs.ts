import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { LogStream } from "@silvana-one/prover";

export async function getLogs(
  logStreams: LogStream[] | undefined
): Promise<{ logs: string[]; isFullLog: boolean }> {
  //console.log("getLogs logStreams", logStreams);
  if (logStreams === undefined) return { logs: [], isFullLog: false };
  if (Array.isArray(logStreams) === false)
    return { logs: [], isFullLog: false };
  if (logStreams.length === 0) return { logs: [], isFullLog: false };
  const result: string[] = [];
  const options = {};
  let isFullLog = true;

  try {
    const client = new CloudWatchLogsClient(options);
    for (const log of logStreams) {
      const command = new GetLogEventsCommand({
        logGroupName: log.logGroupName,
        logStreamName: log.logStreamName,
      });

      const data = await client.send(command);
      /*
      console.log(
        "getLogs",
        data.$metadata,
        data.nextBackwardToken,
        data.nextForwardToken
      );
      */
      //console.log("getLogs events", data.events);
      if (data.events !== undefined && log.awsRequestId !== undefined) {
        const searchString = log.awsRequestId + "\t";
        const events = data.events
          .filter((event) => event.message?.includes(searchString))
          .map((event) => event.message?.replace(searchString, "") as string);
        isFullLog =
          isFullLog && events.some((log) => log.includes("Billed Duration"));
        result.push(...events);
      }
    }
    //console.log("getLogs result", result);
    return { logs: result, isFullLog };
  } catch (error: any) {
    console.error("getLogs error:", error);
    return { logs: [], isFullLog: false };
  }
}
