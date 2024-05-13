import { Handler } from "aws-lambda";
import { TaskData, makeString } from "./src/cloud";
import { Tasks } from "./src/table/tasks";
import { getSystemDataByKey, saveSystemDataByKey } from "./src/table/kv";
import { createExecuteJob } from "./src/api//execute";
const TASKS_TABLE = process.env.TASKS_TABLE!;

export const check: Handler = async () => {
  try {
    const time = Date.now();
    const handlerId = makeString(20);
    const invocation = await getSystemDataByKey("tasks.invocation");
    if (invocation !== undefined) {
      const { timeStarted, handlerId } = JSON.parse(invocation);

      if (Date.now() - timeStarted < 1000 * 60) {
        console.error(
          "task handler is already running, detected double invocation, exiting",
          { timeStarted, handlerId, time }
        );
        return 200;
      }

      await saveSystemDataByKey(
        "tasks.invocation",
        JSON.stringify({ timeStarted: time, handlerId })
      );
    }
    const table = new Tasks(TASKS_TABLE);
    const data: TaskData[] = await table.scan();
    const count: number = data?.length ?? 0;
    const invocation2 = await getSystemDataByKey("tasks.invocation");
    if (invocation2 !== undefined) {
      const { timeStarted, handlerId: handlerId2 } = JSON.parse(invocation2);

      if (handlerId !== handlerId2 || timeStarted !== time) {
        console.error(
          "task handler is already running, detected double invocation (handlerId or time mismatch), exiting",
          { timeStarted, time, handlerId, handlerId2 }
        );
        return 200;
      }
    }

    if (count > 0) {
      console.log("count", count);
      let i: number;
      const time = Date.now();
      for (i = 0; i < count; i++) {
        const startTime = data[i].startTime;
        if (startTime !== undefined && startTime < time) continue;
        console.log("item", i, ":", data[i]);

        if (data[i].timeCreated + 4 * 60 * 60 * 1000 < time) {
          console.error("Removing stuck task", data[i]);
          await table.remove({ id: data[i].id, taskId: data[i].taskId });
        } else if (data[i].attempts > (data[i].maxAttempts ?? 5)) {
          console.error("Removing task exceeding max attempts", data[i]);
          await table.remove({ id: data[i].id, taskId: data[i].taskId });
        } else {
          await table.increaseAttempts(data[i]);
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
        }
      }
    }

    return 200;
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return 200;
  }
};
