import { Table } from "./table.js";
import { TaskData } from "@silvana-one/prover";

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
