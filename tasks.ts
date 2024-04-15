import { Handler } from "aws-lambda";
import { TaskData } from "zkcloudworker";
import { callLambda } from "./src/lambda/lambda";
import { Tasks } from "./src/table/tasks";
const TASKS_TABLE = process.env.TASKS_TABLE!;

export const check: Handler = async () => {
  try {
    const table = new Tasks(TASKS_TABLE);
    const data: TaskData[] = await table.scan();
    const count: number = data.length;

    if (count > 0) {
      console.log("count", count, "items:", data);

      let i: number;
      const time = Date.now();
      for (i = 0; i < count; i++) {
        console.log("item", i, ":", data[i]);
        if (time > data[i].timeCreated) {
          if (data[i].timeCreated + 24 * 60 * 60 * 1000 < time) {
            console.error("Removing stuck task", data[i]);
            await table.remove(data[i].id);
          }
          console.log("Executing");

          /*
          await callLambda(
            data[i].task,
            data[i].taskData
              ? JSON.stringify({
                  id: data[i].id,
                  data: data[i].taskData,
                })
              : JSON.stringify({ id: data[i].id })
          );
          */
        } else {
          console.log("Waiting");
        }
      }
    }

    return 200;
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return 200;
  }
};
