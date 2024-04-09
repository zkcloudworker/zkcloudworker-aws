export type JobStatus = "created" | "started" | "finished" | "failed" | "used";

export interface JobData {
  id: string;
  jobId: string;

  developer: string;
  repo: string;
  task?: string;
  userId?: string;
  args?: string;
  metadata?: string;

  filename?: string;
  txNumber: number;
  timeCreated: number;
  timeCreatedString: string;
  timeStarted?: number;
  timeFinished?: number;
  timeFailed?: number;
  timeUsed?: number;
  billedDuration?: number;
  jobStatus: JobStatus;
  maxAttempts: number;
  result?: string;
}
