import { JobStatus } from "./jobsData";

export type StepTask = "create" | "merge" | "verify" | "mint" | "send";

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
  timeStarted?: number;
  timeFinished?: number;
  timeFailed?: number;
  billedDuration?: number;
  stepStatus: JobStatus;
  result?: string;
}

export interface ProofsData {
  jobId: string;
  stepId: string;
}
