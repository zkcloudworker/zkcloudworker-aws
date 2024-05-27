import { blockchain } from "../networks";
export type JobStatus =
  | "created"
  | "started"
  | "finished"
  | "failed"
  | "used"
  | "restarted";

/**
 * LogStream is a subset of the log stream data returned by AWS CloudWatch Logs when running the worker
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/cloudwatch-logs/command/GetLogEventsCommand/
 * example:
 * {
 * logGroupName: '/aws/lambda/zkcloudworker-dev-test',
 * logStreamName: '2024/05/09/[$LATEST]52d048f64e894d2e8ba2800df93629c5'
 * awsRequestId: '581d0d45-9165-47e8-84d9-678599938811',
 * }
 * @param logGroupName the log group name
 * @param logStreamName the log stream name
 * @param awsRequestId the AWS request ID
 */
export interface LogStream {
  logGroupName: string;
  logStreamName: string;
  awsRequestId: string;
}

/**
 * JobData is the data structure for a job, keeping track of the job status, result, logs, and metadata
 * @param id the id of the user
 * @param jobId the id of the job
 * @param taskId the id of the task
 *
 * @param developer the developer of the repo executing the job
 * @param repo the repo executing the job
 *
 * @param task the task to execute
 * @param userId the id of the user
 * @param args the arguments for the job
 * @param metadata the metadata for the job
 * @param chain the blockchain to execute the job on
 * @param filename the filename where transactions data is stored
 * @param txNumber the number of transactions
 * @param timeCreated the time the job was created
 * @param timeStarted the time the job was started
 * @param timeFinished the time the job was finished
 * @param timeFailed the time the job failed
 * @param timeUsed the time the job result was used
 * @param jobStatus the status of the job
 * @param billedDuration the duration the job was billed for
 * @param logStreams the log streams of the job
 * @param logs the logs of the job
 * @param isFullLog whether the logs are full
 */
export interface JobData {
  id: string;
  jobId: string;
  taskId?: string;

  developer: string;
  repo: string;

  task?: string;
  userId?: string;
  args?: string;
  metadata?: string;
  chain: blockchain;
  filename?: string;
  txNumber: number;
  timeCreated: number;
  timeStarted?: number;
  timeFinished?: number;
  timeFailed?: number;
  timeUsed?: number;
  jobStatus: JobStatus;
  billedDuration?: number;
  result?: string;
  logStreams?: LogStream[];
  logs?: string[];
  isFullLog?: boolean;
}

/**
 * JobData is the data structure for a job, keeping track of the job status, result, logs, and metadata
 * @param jobId the id of the job
 * @param eventTime the time the event occurred
 * @param jobStatus the status of the job
 * @param result the result of the job
 */
export interface JobEvent {
  jobId: string;
  eventTime: number;
  jobStatus: JobStatus;
  result?: string;
}
