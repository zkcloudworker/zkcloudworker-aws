import fs from "fs/promises";
import { S3File } from "./s3";

export async function listFiles(
  folder: string,
  isVerbose: boolean = false
): Promise<string[]> {
  try {
    const files = await fs.readdir(folder);
    if (isVerbose) console.log(`${files.length} files in ${folder}`, files);
    else console.log(`${files.length} files in ${folder}`);
    return files;
  } catch (error) {
    console.log(`"Folder ${folder} not found, creating...`);
    try {
      await fs.mkdir(folder);
      const files = await fs.readdir(folder);
      console.log(`files in ${folder}:`, files.length);
      return files;
    } catch (error) {
      console.log(`"Error creating folder ${folder}`, error);
      return [];
    }
  }
}

export async function createFolders(
  folders: string[],
  isVerbose: boolean = false
) {
  if (isVerbose) console.log("createFolders", folders);
  for (const folder of folders) {
    try {
      if ((await isExist(folder)) === false) await fs.mkdir(folder);
    } catch (error) {
      console.log(`"Error creating folder ${folder}`, error);
    }
  }
}

export async function copyFiles(params: {
  bucket: string;
  developer: string;
  folder: string;
  files: string[];
  overwrite?: boolean;
  move?: boolean;
}): Promise<void> {
  const { bucket, developer, folder, files, overwrite, move } = params;
  console.log(`copying files`, params);
  const existingFiles = await listFiles(`${folder}/${developer}`, true);
  for (const file of files) {
    if (overwrite === true || !existingFiles.includes(file)) {
      try {
        if (existingFiles.includes(file)) {
          console.log(`deleting ${file}`);
          await fs.unlink(`${folder}/${developer}/${file}`);
          await listFiles(`${folder}/${developer}`, true);
        }
        console.log(`downloading ${file}`);
        const s3File = new S3File(bucket, `${developer}/${file}`);
        const data = await s3File.get();
        await fs.writeFile(`${folder}/${developer}/${file}`, data.Body);
        console.log(`downloaded ${file}`);
        if (move === true) {
          console.log(`removing ${file} from cache`);
          await s3File.remove();
        }
      } catch (error) {
        console.log(`error downloading ${file}`, error);
      }
    } else {
      console.log(`file ${file} already exists`);
    }
  }
}

export async function moveZip(params: {
  bucket: string;
  key: string;
  folder: string;
  file: string;
}): Promise<void> {
  const { bucket, key, folder, file } = params;
  //console.log(`moveZip`, params);
  try {
    if (await isExist(file)) {
      console.log(`deleting ${file}`);
      await fs.unlink(file);
    }
    const s3File = new S3File(bucket, key);
    const data = await s3File.get();
    await fs.writeFile(`${folder}/${file}`, data.Body);
    await s3File.remove();
    //console.log(`moved ${file} to ${folder}`);
  } catch (error) {
    console.log(`error moving ${file}`, error);
  }
}

export async function isExist(name: string): Promise<boolean> {
  // check if file exists
  try {
    await fs.access(name);
    return true;
  } catch (e) {
    // if not, return
    return false;
  }
}
