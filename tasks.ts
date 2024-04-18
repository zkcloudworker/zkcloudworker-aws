import { Handler } from "aws-lambda";
import { TaskData } from "zkcloudworker";
import { Tasks } from "./src/table/tasks";
import { createExecuteJob } from "./src/api//execute";
const TASKS_TABLE = process.env.TASKS_TABLE!;

export const check: Handler = async () => {
  try {
    const table = new Tasks(TASKS_TABLE);
    const data: TaskData[] = await table.scan();
    const count: number = data?.length ?? 0;

    if (count > 0) {
      console.log("count", count);

      let i: number;
      const time = Date.now();
      for (i = 0; i < count; i++) {
        const startTime = data[i].startTime;
        if (startTime !== undefined && startTime < time) continue;
        console.log("item", i, ":", data[i]);
        if (data[i].timeCreated + 2 * 60 * 60 * 1000 < time) {
          console.error("Removing stuck task", data[i]);
          await table.remove({ id: data[i].id, taskId: data[i].taskId });
        }
        if (data[i].attempts > (data[i].maxAttempts ?? 5)) {
          console.error("Removing task exceeding max attempts", data[i]);
          await table.remove({ id: data[i].id, taskId: data[i].taskId });
        }
        console.log(
          "Executing task",
          data[i].task,
          data[i].taskId,
          "for",
          data[i].id,
          "at",
          time
        );
        await createExecuteJob({
          command: "task",
          data: { ...data[i], transactions: [] },
        });
        await table.increaseAttempts(data[i]);
      }
    }

    return 200;
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return 200;
  }
};
