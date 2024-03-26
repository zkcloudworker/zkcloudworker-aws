import { JobStatus } from "./jobsData";

export type StepTask = "create" | "merge" | "verify" | "mint" | "send";
export const MAX_STEP_ATTEMPTS = 5;

export interface StepsData {
  jobId: string;
  stepId: string;

  username: string;
  developer: string;
  name: string;
  jobTask: string;
  args: string[];
  task: StepTask;
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
