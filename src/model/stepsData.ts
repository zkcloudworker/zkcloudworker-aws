import { JobStatus } from "zkcloudworker";
import { blockchain, LogStream } from "zkcloudworker";

export type StepTask = "create" | "merge";
export const MAX_STEP_ATTEMPTS = 5;

export interface StepsData {
  id: string;
  jobId: string;
  stepId: string;

  developer: string;
  repo: string;
  jobTask?: string;
  args?: string;
  task: StepTask;
  userId?: string;
  metadata?: string;
  chain: blockchain;
  origins: string[];
  stepData: string[];
  timeCreated: number;
  attempts: number;
  timeStarted?: number;
  timeFinished?: number;
  timeFailed?: number;
  billedDuration?: number;
  stepStatus: JobStatus;
  maxAttempts: number;
  result?: string;
  logStreams: LogStream[];
}

export interface ProofsData {
  jobId: string;
  stepId: string;
}
