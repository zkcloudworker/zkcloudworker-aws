import { blockchain } from "../networks";
export type JobStatus =
  | "created"
  | "started"
  | "finished"
  | "failed"
  | "used"
  | "restarted";

/**
 * LogStream is a subset of the log stream data returned by AWS CloudWatch Logs when running the worker.
 * @see {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/cloudwatch-logs/command/GetLogEventsCommand/}
 *
 * Example:
 * ```
 * {
 *   logGroupName: '/aws/lambda/zkcloudworker-dev-test',
 *   logStreamName: '2024/05/09/[$LATEST]52d048f64e894d2e8ba2800df93629c5',
 *   awsRequestId: '581d0d45-9165-47e8-84d9-678599938811'
 * }
 * ```
 */
export interface LogStream {
  /** The log group name */
  logGroupName: string;

  /** The log stream name */
  logStreamName: string;

  /** The AWS request ID */
  awsRequestId: string;
}

/**
 * JobData is the data structure for a job, keeping track of the job status, result, logs, and metadata.
 */
export interface JobData {
  /** The ID of the user */
  id: string;

  /** The ID of the job */
  jobId: string;

  /** The ID of the task (optional) */
  taskId?: string;

  /** The developer of the repo executing the job */
  developer: string;

  /** The repo executing the job */
  repo: string;

  /** The task to execute (optional) */
  task?: string;

  /** The ID of the user (optional) */
  userId?: string;

  /** The arguments for the job (optional) */
  args?: string;

  /** The metadata for the job (optional) */
  metadata?: string;

  /** The blockchain to execute the job on */
  chain: blockchain;

  /** The filename where transactions data is stored (optional) */
  filename?: string;

  /** The number of transactions */
  txNumber: number;

  /** The time the job was created */
  timeCreated: number;

  /** The time the job was started (optional) */
  timeStarted?: number;

  /** The time the job was finished (optional) */
  timeFinished?: number;

  /** The time the job failed (optional) */
  timeFailed?: number;

  /** The time the job result was used (optional) */
  timeUsed?: number;

  /** The status of the job */
  jobStatus: JobStatus;

  /** The duration the job was billed for in ms (optional) */
  billedDuration?: number;

  /** The result of the job (optional) */
  result?: string;

  /** The log streams of the job (optional) */
  logStreams?: LogStream[];

  /** The logs of the job (optional) */
  logs?: string[];

  /** Whether the logs are full (optional) */
  isFullLog?: boolean;
}

/**
 * JobEvent is the data structure for a job events, keeping track of the job status changes.
 */
export interface JobEvent {
  /** The ID of the job */
  jobId: string;

  /** The time the event occurred */
  eventTime: number;

  /** The status of the job */
  jobStatus: JobStatus;

  /** The result of the job (optional) */
  result?: string;
}
