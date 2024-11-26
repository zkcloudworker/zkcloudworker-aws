import { blockchain } from "../networks.js";

/**
 * TaskData is the data structure for a task, keeping track of the task status, result, logs, and metadata.
 */
export interface TaskData {
  /** The ID of the user */
  id: string;

  /** The ID of the task */
  taskId: string;

  /** The time the task was started (optional) */
  startTime?: number;

  /** The time the task was created */
  timeCreated: number;

  /** The maximum number of attempts (default is 5) (optional) */
  maxAttempts?: number;

  /** The number of attempts */
  attempts: number;

  /** The developer of the repo executing the task */
  developer: string;

  /** The repo executing the task */
  repo: string;

  /** The task to execute */
  task: string;

  /** The ID of the user (optional) */
  userId?: string;

  /** The arguments for the task (optional) */
  args?: string;

  /** The metadata for the task (optional) */
  metadata?: string;

  /** The blockchain to execute the task on */
  chain: blockchain;
}
