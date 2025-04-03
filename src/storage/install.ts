import { execSync } from "child_process";
import { listFiles } from "./files";
import { decryptWithPrivateKey } from "./rsa";
import * as fs from "fs/promises";
import * as path from "path";

const key = process.env.CLI_KEY;

export async function install(params: {
  folder: string;
  packageManager: string;
  buildCommand?: string;
  env: string;
}) {
  const { folder, packageManager } = params;
  if (key === undefined) throw Error("CLI_KEY is not set");
  if (params.env) {
    try {
      console.log("Decrypting and installing .env file");
      const env = decryptWithPrivateKey({
        encryptedData: params.env,
        privateKey: key,
      });
      if (env === undefined) throw Error("Failed to decrypt env");
      // Save the decrypted env string to a .env file in the folder

      const envFilePath = path.join(folder, ".env");

      await fs.writeFile(envFilePath, env);
      console.log(`Successfully created .env file`);
    } catch (error: any) {
      console.error(`Error writing .env file: ${error.message}`);
      throw new Error("Failed to write .env file");
    }
  }
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
  const buildCommand =
    params.buildCommand ??
    "corepack " +
      packageManager +
      (packageManager === "npm" ? " run" : "") +
      " tsc";
  console.log("Build command:", buildCommand);
  execSync(buildCommand, {
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
