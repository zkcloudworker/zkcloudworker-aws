import zip from "adm-zip";
import fs from "fs/promises";

export async function unzip(params: {
  folder: string;
  filename: string;
  targetDir: string;
}): Promise<void> {
  const { folder, filename, targetDir } = params;
  try {
    //console.log("unzip", folder, filename, targetDir);
    const file = await fs.readFile(`${folder}/${filename}`);
    //console.log("unzip: reading file...");
    const zipFile = new zip(file);
    //console.log("unzip: unzipping file...");
    zipFile.extractAllTo(targetDir, true);
  } catch (error: any) {
    console.error("Error: unzip", error);
  }
}
