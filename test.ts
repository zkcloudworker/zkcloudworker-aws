import type { Handler, Context, Callback } from "aws-lambda";
//import { listFiles } from "./src/storage/files";
//import fs from "fs/promises";
//import os from "os";
//import { Transactions } from "./src/table/transactions";
//import { restartNatsServer } from "./src/publish/restart";

//const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE!;

export const cloud: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.time("test");
    console.error("test event");
    console.log("event", event);
    console.log("context", context);
    //console.log("context", context);
    //console.log("env", process.env);
    /*
    const parallelism = os.availableParallelism();
    console.log("parallelism", parallelism);
    const cpuCores = os.cpus();
    const numberOfCPUCores = cpuCores.length;
    console.log("CPU cores:", numberOfCPUCores);
    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
    console.log("functionName", functionName);

    //await restartNatsServer();

    const dir = "/mnt/efs/worker/DFST/simple-example";
    await listFiles(dir, true);
    await fs.rm(dir, { recursive: true, force: true });
    console.log("dir removed");
    await listFiles(dir, true);
    
    const cacheDir = "/mnt/efs/cache";
    await listFiles(cacheDir, false);
    await fs.rm(cacheDir, { recursive: true, force: true });
    console.log("cacheDir removed");
    await listFiles(cacheDir, false);
    

    const transactionsTable = new Transactions(TRANSACTIONS_TABLE);
    let txs = await transactionsTable.scan();
    let count = 0;
    while (txs.length > 0 && count < 50) {
      for (const tx of txs) {
        await transactionsTable.remove({ txId: tx.txId, repoId: tx.repoId });
      }
      txs = await transactionsTable.scan();
    }
      */

    console.timeEnd("test");
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};
