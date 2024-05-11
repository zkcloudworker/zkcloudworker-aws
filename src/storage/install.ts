import { execSync } from "child_process";
import { listFiles } from "./files";

import zip from "adm-zip";
import fs from "fs/promises";

export async function install(params: {
  folder: string;
  packageManager: string;
}) {
  //console.log("install", params);
  const { folder, packageManager } = params;
  process.chdir(folder);
  //const currentDir = process.cwd();
  //console.log(`Current directory: ${process.cwd()}`);
  //console.log("corepack", process.env.COREPACK_HOME);
  //console.log("home", process.env.HOME);
  console.log(`Installing package manager ${packageManager}...`);
  execSync("corepack install", {
    stdio: "inherit",
  });
  await listFiles(folder, true);
  console.log(`Installing dependencies with ${packageManager}...`);
  execSync("corepack " + packageManager + " install", {
    stdio: "inherit",
  });

  await listFiles(folder, true);
  process.chdir(folder);

  console.log("Compiling...");
  console.time("compiled");
  execSync("corepack " + packageManager + " tsc", {
    stdio: "inherit",
  });
  console.timeEnd("compiled");
  await listFiles(folder, true);
}

/*

export async function unzip(params: {
  folder: string;
  repo: string;
  packageManager: string;
}): Promise<string> {
  console.log("unzip", params);
  const { folder, repo, packageManager } = params;
  const extractPath = `${folder}/${repo}`;
  await listFiles(extractPath, true);

  const file = await fs.readFile(`${folder}/${repo}.zip`);
  console.log("unzip: read file");
  const zipFile = new zip(file);
  console.log("unzip: unzip file");
  zipFile.extractAllTo(extractPath, true);
  console.log("unzip: unzipped");

  console.log(`File unzipped to ${extractPath}`);
  await listFiles(extractPath, true);

  process.chdir(extractPath);
  const currentDir = process.cwd();
  console.log(`Current directory: ${process.cwd()}`);

  //console.log("Enabling corepack...");
  //execSync("corepack enable", { stdio: "inherit" });
  console.log("corepack", process.env.COREPACK_HOME);
  console.log("home", process.env.HOME);
  console.log(`Installing package manager ${packageManager}...`);
  execSync("corepack install", {
    stdio: "inherit",
  });
  await listFiles(extractPath, true);
  console.log("Installing dependencies...");
  execSync("corepack " + packageManager + " install", {
    stdio: "inherit",
  });

  await listFiles(extractPath, true);
  process.chdir(extractPath);
  console.log(`Current directory: ${process.cwd()}`);
  console.log(`Extract directory: ${extractPath}`);
  await listFiles(extractPath, true);

  console.log("Compiling...");
  execSync("corepack " + packageManager + " tsc", {
    stdio: "inherit",
  });
  console.log("Compiled");
  await listFiles(extractPath, true);

  return extractPath;
}
*/
