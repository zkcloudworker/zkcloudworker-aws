import type { Handler, Context, Callback } from "aws-lambda";
import { listFiles } from "./src/storage/files";
import fs from "fs/promises";

export const cloud: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.time("test");
    console.log("event", event);
    const cacheDir = "/mnt/efs/cache";
    await listFiles(cacheDir, false);
    await fs.rm(cacheDir, { recursive: true, force: true });
    console.log("cacheDir removed");
    await listFiles(cacheDir, false);

    console.timeEnd("test");
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};
