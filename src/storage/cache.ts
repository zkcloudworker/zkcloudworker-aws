import fs from "fs/promises";
import { S3File } from "./s3";

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

export async function copyFiles(params: {
  bucket: string;
  folder: string;
  files: string[];
  overwrite?: boolean;
  move?: boolean;
}): Promise<void> {
  const { bucket, folder, files, overwrite, move } = params;
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
        const s3File = new S3File(bucket, file);
        const data = await s3File.get();
        await fs.writeFile(`${folder}/${file}`, data.Body);
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
