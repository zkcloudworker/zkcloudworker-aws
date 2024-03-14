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

/*

async function readFile(
  cacheBucket: string,
  filename: string
): Promise<any | undefined> {
  try {
    const file = new S3File(cacheBucket, filename);
    const data = await file.get();
    console.log("readFile success", filename);
    return data;
  } catch (error) {
    console.log("readFile error", filename, error);
    return undefined;
  }
}

function readFileSync(
  cacheBucket: string,
  filename: string
): Buffer | undefined {
  let result: Buffer | undefined = undefined;
  let finished: boolean = false;
  readFile(cacheBucket, filename)
    .then((response) => {
      if (response && response.Body) {
        console.log("readFileSync sucess", filename);
        result = response.Body;
        finished = true;
        return response.Body;
      } else {
        console.log("readFileSync error", filename, response);
        finished = true;
        return undefined;
      }
    })
    .catch((e) => {
      console.log("readFileSync error - catch", e);
      return undefined;
    });

  while (!finished) {}

  return result;
}

const FileSystem = (cacheBucket: string, debug?: boolean): Cache => ({
  read({ persistentId, uniqueId, dataType }) {
    // read current uniqueId, return data if it matches
    const header = readFileSync(cacheBucket, `${persistentId}.header`);
    if (header === undefined) {
      console.log(`Cache FileSystem: ${persistentId}.header not found`);
      return undefined;
    }
    let currentId = header.toString();
    if (currentId !== uniqueId) return undefined;

    const data = readFileSync(cacheBucket, persistentId);
    if (data === undefined) {
      console.log(`Cache FileSystem: ${persistentId} not found`);
      return undefined;
    }
    if (dataType === "string") {
      let string = data.toString();
      return new TextEncoder().encode(string);
    } else {
      let buffer = data;
      return new Uint8Array(buffer.buffer);
    }
  },
  write({ persistentId, uniqueId, dataType }, data) {},
  canWrite: false,
  debug,
});

*/

/*
export { writeFileSync, readFileSync, mkdirSync } from "node:fs";
export { resolve } from "node:path";
export { cachedir as cacheDir };

const cache: Cache = Cache.FileSystem("./nftcache");
const { verificationKey } = await MinaNFTContract.compile({ cache });

const files = [
  { name: "srs-fp-65536", type: "string" },
  { name: "srs-fq-32768", type: "string" },
  { name: "step-vk-invoices-commit", type: "string" },
  { name: "step-vk-invoices-settleinvoice", type: "string" },
  { name: "step-vk-invoices-createinvoice", type: "string" },
  { name: "step-vk-invoices-init", type: "string" },
  { name: "wrap-vk-invoices", type: "string" },
  { name: "lagrange-basis-fp-1024", type: "string" },
  { name: "lagrange-basis-fp-32768", type: "string" },
  { name: "lagrange-basis-fp-65536", type: "string" },
];

function fetchFiles() {
  return Promise.all(
    files.map((file) => {
      return Promise.all([
        fetch(`http://localhost:3000/nftcache/${file.name}.header`).then(
          (res) => res.text()
        ),
        fetch(`http://localhost:3000/nftcache/${file.name}`).then((res) =>
          res.text()
        ),
      ]).then(([header, data]) => ({ file, header, data }));
    })
  ).then((cacheList) =>
    cacheList.reduce((acc: any, { file, header, data }) => {
      acc[file.name] = { file, header, data };

      return acc;
    }, {})
  );
}

const FileSystem = (files: any): MinaCache => ({
  read({ persistentId, uniqueId, dataType }: any) {
    // read current uniqueId, return data if it matches
    if (!files[persistentId]) {
      console.log("read");
      console.log({ persistentId, uniqueId, dataType });

      return undefined;
    }

    const currentId = files[persistentId].header;

    if (currentId !== uniqueId) {
      console.log("current id did not match persistent id");

      return undefined;
    }

    if (dataType === "string") {
      console.log("found in cache", { persistentId, uniqueId, dataType });

      return new TextEncoder().encode(files[persistentId].data);
    }
    // else {
    //   let buffer = readFileSync(resolve(cacheBucket, persistentId));
    //   return new Uint8Array(buffer.buffer);
    // }

    return undefined;
  },
  write({ persistentId, uniqueId, dataType }: any, data: any) {
    console.log("write");
    console.log({ persistentId, uniqueId, dataType });
  },
  canWrite: true,
});

const zkAppAddress = "B62qqQXJmFRSoaxZoCG7cs9NvMsUi5jwSvxBWEvcbNozJVpSaUv1GvT";
const zkApp = new Invoices(PublicKey.fromBase58(zkAppAddress));
const cacheFiles = await fetchFiles();

console.time();
console.log("start compiling");
await Invoices.compile({ cache: FileSystem(cacheFiles) });
console.timeEnd();
console.log("complete compiling");
*/
