import { Table } from "./table";
import { TaskData } from "zkcloudworker";

export class Tasks extends Table<TaskData> {
  async increaseAttempts(task: TaskData): Promise<void> {
    const { id, taskId, attempts } = task;
    await this.updateData(
      {
        id,
        taskId,
      },
      {
        "#A": "attempts",
      },
      {
        ":attempts": attempts === undefined ? 1 : attempts + 1,
      },
      "set #A = :attempts"
    );
  }
}
