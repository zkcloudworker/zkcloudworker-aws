import { blockchain } from "../networks";
export type JobStatus = "created" | "started" | "finished" | "failed" | "used";

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
 * @param developer the developer of the repo executing the job
 * @param repo the repo executing the job
 * @param task the task to execute
 * @param userId the id of the user
 * @param args the arguments for the job
 * @param metadata the metadata for the job
 * @param chain the blockchain to execute the job on
 * @param webhook the webhook to call after the job finishes
 * @param cloudhook the cloudhook to call after the job finishes
 * @param cloudIteration the recursive call number, must be less than 5
 * @param previousJob the previous job data, provided in case of the cloudhook
 *
 * @param filename the filename where transactions data is stored
 * @param txNumber the number of transactions
 * @param timeCreated the time the job was created
 * @param timeCreatedString the time the job was created as a string
 * @param timeStarted the time the job was started
 * @param timeFinished the time the job was finished
 * @param timeFailed the time the job failed
 * @param timeUsed the time the job result was used
 * @param billedDuration the duration the job was billed for
 * @param feeMINA the fee in MINA
 * @param feeUSD the fee in USD
 * @param jobStatus the status of the job
 * @param maxAttempts the maximum number of attempts
 * @param result the result of the job
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
  webhook?: string; // the sequencer call webhook after the job finished
  cloudhook?: string; // the cloudhook call execute with task in cloudhook after job finished
  cloudIteration?: number; // recursive call number, must be less than 5
  previousJob?: JobData; // provided in case of the cloudhook

  filename?: string;
  txNumber: number;
  timeCreated: number;
  timeCreatedString: string;
  timeStarted?: number;
  timeFinished?: number;
  timeFailed?: number;
  timeUsed?: number;
  billedDuration?: number;
  feeMINA?: number;
  feeUSD?: number;
  jobStatus: JobStatus;
  maxAttempts: number;
  result?: string;
  logStreams?: LogStream[];
  logs?: string[];
  isFullLog?: boolean;
}
