import type { Handler, Context, Callback } from "aws-lambda";
import { listFiles } from "./src/storage/files";
import fs from "fs/promises";
import os from "os";

export const cloud: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.time("test");
    console.log("event", event);
    //console.log("context", context);
    //console.log("env", process.env);
    const parallelism = os.availableParallelism();
    console.log("parallelism", parallelism);
    const cpuCores = os.cpus();
    const numberOfCPUCores = cpuCores.length;
    console.log("CPU cores:", numberOfCPUCores);
    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
    console.log("functionName", functionName);
    /*
    const cacheDir = "/mnt/efs/cache";
    await listFiles(cacheDir, false);
    await fs.rm(cacheDir, { recursive: true, force: true });
    console.log("cacheDir removed");
    await listFiles(cacheDir, false);
    */

    console.timeEnd("test");
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};
