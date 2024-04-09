import { JobStatus } from "zkcloudworker";

export type StepTask = "create" | "merge";
export const MAX_STEP_ATTEMPTS = 5;

export interface StepsData {
  jobId: string;
  stepId: string;

  id: string;
  developer: string;
  repo: string;
  jobTask?: string;
  args?: string;
  task: StepTask;
  userId?: string;
  metadata?: string;
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
}

export interface ProofsData {
  jobId: string;
  stepId: string;
}
