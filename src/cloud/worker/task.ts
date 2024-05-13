import { blockchain } from "../networks";

/**
 * TaskData is the data structure for a task, keeping track of the task status, result, logs, and metadata
 * @param id the id of the user
 * @param taskId the id of the task
 *
 * @param startTime the time the task was started
 * @param timeCreated the time the task was created
 * @param maxAttempts the maximum number of attempts
 * @param attempts the number of attempts
 *
 * @param developer the developer of the repo executing the task
 * @param repo the repo executing the task
 * @param task the task to execute
 * @param userId the id of the user
 * @param args the arguments for the task
 * @param metadata the metadata for the task
 * @param chain the blockchain to execute the task on
 */
export interface TaskData {
  id: string;
  taskId: string;

  startTime?: number;
  timeCreated: number;
  maxAttempts?: number; // default is 5
  attempts: number;

  developer: string;
  repo: string;
  task: string;
  userId?: string;
  args?: string;
  metadata?: string;
  chain: blockchain;
}
