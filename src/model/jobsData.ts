export type JobStatus = "created" | "started" | "finished" | "failed" | "used";

export interface JobsData {
  id: string;
  jobId: string;

  developer: string;
  jobName: string;
  task: string;
  args: string[];
  jobData: string[];
  txNumber: number;
  timeCreated: number;
  timeStarted?: number;
  timeFinished?: number;
  timeFailed?: number;
  timeUsed?: number;
  billedDuration?: number;
  jobStatus: JobStatus;
  result?: string;
}
