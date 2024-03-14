import { Handler } from "aws-lambda";
import TasksData from "./src/model/tasksData";
import callLambda from "./src/lambda/lambda";
import Tasks from "./src/table/tasks";
const TASKS_TABLE = process.env.TASKS_TABLE!;

export const check: Handler = async () =>
//event: any,
//context: Context,
//callback: Callback
{
  try {
    const table = new Tasks(TASKS_TABLE);
    const data: TasksData[] = await table.scan();
    const count: number = data.length;

    if (count > 0) {
      console.log("count", count, "items:", data);

      let i: number;
      const time = Date.now();
      for (i = 0; i < count; i++) {
        console.log("item", i, ":", data[i]);
        if (time > data[i].startTime) {
          if (data[i].startTime + 24 * 60 * 60 * 1000 < time) {
            console.error("Removing stuck task", data[i]);
            await table.remove(data[i].id);
          }
          console.log("Executing");

          await callLambda(
            data[i].task,
            data[i].taskdata
              ? JSON.stringify({
                id: data[i].id,
                data: data[i].taskdata,
              })
              : JSON.stringify({ id: data[i].id }),
          );
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
