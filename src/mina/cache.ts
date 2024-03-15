import fs from "fs/promises";
import { S3File } from "../storage/s3";

export async function listFiles(
  folder: string,
  isVerbose: boolean = false
): Promise<string[]> {
  try {
    const files = await fs.readdir(folder);
    console.log(`files in ${folder}:`, files.length);
    if (isVerbose) console.log(files);
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

/*

import { Cache } from "o1js";
import S3File from "../storage/s3";


export function getCache(cacheBucket: string, debug?: boolean): Cache {
  return FileSystem(cacheBucket, debug);
}

*/

export async function loadCache(params: {
  cacheBucket: string;
  folder: string;
  files: string[];
  overwrite?: boolean;
}): Promise<void> {
  const { cacheBucket, folder, files, overwrite } = params;
  const existingFiles = await listFiles(folder, true);
  for (const file of files) {
    if (overwrite === true || !existingFiles.includes(file)) {
      try {
        if (existingFiles.includes(file)) {
          console.log(`deleting ${file}`);
          await fs.unlink(`${folder}/${file}`);
          await listFiles(folder, true);
        }
        console.log(`downloading ${file}`);
        const s3File = new S3File(cacheBucket, file);
        const data = await s3File.get();
        await fs.writeFile(`${folder}/${file}`, data.Body);
        console.log(`downloaded ${file}`);
      } catch (error) {
        console.log(`error downloading ${file}`, error);
      }
    } else {
      console.log(`file ${file} already exists`);
    }
  }
}
