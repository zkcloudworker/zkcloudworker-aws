import fs from "fs";
import unzipper from "unzipper";
import { execSync } from "child_process";

export async function unzip(params: {
  folder: string;
  repo: string;
}): Promise<string> {
  console.log("unzip", params);
  const { folder, repo } = params;
  const extractPath = `${folder}/${repo}`;

  try {
    await fs
      .createReadStream(`${folder}/${repo}.zip`)
      .pipe(unzipper.Extract({ path: extractPath }))
      .promise();
  } catch (error) {
    console.log(error);
  }

  console.log(`File unzipped to ${extractPath}`);

  process.chdir(extractPath);
  const currentDir = process.cwd();
  console.log(`Current directory: ${process.cwd()}`);

  //console.log("Enabling corepack...");
  //execSync("corepack enable", { stdio: "inherit" });
  console.log("corepack", process.env.COREPACK_HOME);
  console.log("home", process.env.HOME);
  console.log("Installing yarn...");
  execSync("corepack install", {
    stdio: "inherit",
  });
  console.log("Installing dependencies...");
  execSync("corepack yarn", {
    stdio: "inherit",
  });
  console.log("Dependencies installed successfully.");

  return currentDir.toString();
}
