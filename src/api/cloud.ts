import { listFiles, loadCache } from "../mina/cache";
import { unzip } from "../storage/zip";
import fs from "fs/promises";
import { CloudWorker } from "./cloudobject";
import { Cache } from "o1js";
import { runCLI } from "jest";
import { minaInit } from "../mina/init";

/*
const { BUCKET } = process.env;
const downloadZip = false;

export async function runZip(params: {
  fileName: string;
  functionName: string;
  args: string[];
}) {
  const { fileName, functionName, args } = params;
  console.log("runZip", fileName, functionName, params);
  const contractsDir = "/mnt/efs/zip";
  const cacheDir = "/mnt/efs/cache";
  const files = [fileName];

  if (downloadZip) {
    // Copy compiled from TypeScript to JavaScript source code of the contracts
    // from S3 bucket to AWS lambda /tmp/contracts folder

    await fs.rm(contractsDir, { recursive: true });
    await listFiles(contractsDir, true);
    await listFiles(cacheDir, false);

    await loadCache({
      cacheBucket: BUCKET!,
      folder: contractsDir,
      files: files,
      overwrite: true,
    });
    await listFiles(contractsDir, true);
    console.log("loaded cache");

    console.time("unzipped");
    await unzip({
      folder: contractsDir,
      filename: fileName,
      targetDir: contractsDir,
    });
    console.timeEnd("unzipped");
  }
  await listFiles(contractsDir, true);

  const macDir = contractsDir + "/mac";
  const relativeDir = "../../../../mnt/efs/zip/mac/dist/index.js";
  await listFiles(macDir, true);
  await listFiles(macDir + "/dist", true);

  const jestConfig = {
    roots: ["../../../../mnt/efs/zip/mac/dist/tests"],
    //testRegex: "\\.spec\\.js$",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jestResult = await runCLI(jestConfig as any, [
    "../../../../mnt/efs/zip/mac",
  ]);
  console.log("jest result", jestResult.results?.success);

  console.log("Importing contracts...", __filename, "folder", __dirname);
  //await listFiles(relativeDir, true);

  try {
    const zip = await import(relativeDir);
    console.log("imported contracts");
    const functionName = "compile";
    minaInit();
    const cache: Cache = Cache.FileSystem(cacheDir);
    const cloud = new CloudWorker(cache);
    const result = await zip[functionName](cloud);
    console.log("compile function done", result);
    return result;
  } catch (error: any) {
    console.error("cloud contracts catch", (error as any).toString());
  }
}

export async function cloud(
  fileNames: string[],
  functionName: string,
  params: string[]
) {
  console.log("cloud", fileNames, functionName, params);
  const contractsDir = "/mnt/efs/cloud";
  const cacheDir = "/mnt/efs/cache";
  const files = fileNames;

  // Copy compiled from TypeScript to JavaScript source code of the contracts
  // from S3 bucket to AWS lambda /tmp/contracts folder
  await listFiles(contractsDir, true);
  await listFiles(cacheDir, false);
  await loadCache({
    cacheBucket: BUCKET!,
    folder: contractsDir,
    files: files,
    overwrite: true,
  });
  await listFiles(contractsDir, true);
  //await listFiles(cacheDir, true);
  //const file = "a.txt";
  //await fs.writeFile(`${contractsDir}/${file}`, "a.txt content", "utf8");
  //await listFiles(contractsDir, true);

  const contracts = await import(contractsDir + "/" + fileNames[0]);
  console.log("imported contracts");

  const result = await contracts[functionName](params);
  console.log("cloud result", result);
  return result;
}

*/
