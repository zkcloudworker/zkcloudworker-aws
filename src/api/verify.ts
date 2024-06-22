import {
  listFiles,
  moveZip,
  createFolders,
  isExist,
  copyZip,
} from "../storage/files";
import { unzip } from "../storage/zip";
import { install } from "../storage/install";
import fs from "fs/promises";
import { Jobs } from "../table/jobs";
import { Workers } from "../table/workers";
import {
  Memory,
  blockchain,
  sleep,
  getAccountFromGraphQL,
  networks,
} from "../cloud";
import { charge } from "../table/balance";
import { S3File } from "../storage/s3";
import { publishVerification } from "../publish/verify";

const { BUCKET, VERIFICATION_BUCKET } = process.env;
const WORKERS_TABLE = process.env.WORKERS_TABLE!;

export interface VerificationAnswer {
  name: string;
  account: string;
  image?: string;
  verificationKey: { verificationKey: string; hash: string };
  methods: Record<
    string,
    {
      actions: number;
      rows: number;
      digest: string;
      gates: any[];
    }
  >;
}

export async function verify(params: {
  developer: string;
  repo: string;
  id: string;
  jobId: string;
  args: string;
  chain: blockchain;
}): Promise<boolean> {
  console.time("deployed");
  //console.log("deploy", params);
  const { developer, repo, id, jobId, args, chain } = params;
  const { packageManager, version } = JSON.parse(args);
  const timeStarted = Date.now();
  if (VERIFICATION_BUCKET === undefined)
    throw new Error("VERIFICATION_BUCKET is undefined");

  Memory.info("start");
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);
  const workersTable = new Workers(WORKERS_TABLE);
  try {
    if (BUCKET === undefined) throw new Error("BUCKET is undefined");

    const workersDirRoot = "/mnt/efs/verify";
    const developerDir = workersDirRoot + "/" + developer;
    const repoDir = developerDir + "/" + repo;
    const versionStr = version.replaceAll(".", "_");
    const versionDir = repoDir + "/" + versionStr;
    const distDir = versionDir + "/dist";
    const oldFolders = await listFiles(repoDir, false);
    for (const folder of oldFolders) {
      await fs.rm(repoDir + "/" + folder, { recursive: true });
    }
    await createFolders([workersDirRoot, developerDir, repoDir, versionDir]);
    const filename = repo + "." + version + ".zip";

    // Copy compiled from TypeScript to JavaScript source code of the contracts
    // from S3 bucket to AWS lambda /tmp/contracts folder
    console.time(`moved ${filename} to ${developerDir}`);
    await moveZip({
      bucket: BUCKET,
      key: developer + "/" + filename,
      folder: developerDir,
      file: filename,
    });
    console.timeEnd(`moved ${filename} to ${developerDir}`);
    await listFiles(developerDir, true);

    console.time("unzipped");
    await unzip({
      folder: developerDir,
      filename,
      targetDir: versionDir,
    });
    console.timeEnd("unzipped");

    console.time("installed");
    await install({
      folder: versionDir,
      packageManager,
    });
    console.timeEnd("installed");

    console.time("verified");
    console.log("Importing worker", { developer, repo, version });
    const zkcloudworker = await import(distDir);
    const functionName = "verify";
    const verificationData = await zkcloudworker[functionName](chain);

    /*
    const verifierDir = "/mnt/efs/worker/DFST/verifier/0_1_0/dist";
    const verifier = await import(verifierDir);
    const verificationResult: VerificationAnswer | undefined = await verifier[
      "verify"
    ](verificationData);
    */

    const verificationResult: VerificationAnswer | undefined =
      await verifyContract(verificationData);
    console.log("verificationResult", verificationResult);
    console.timeEnd("verified");

    if (verificationResult === undefined) {
      console.error("Error verifying contract");
      const billedDuration = Date.now() - timeStarted;
      await charge({
        id,
        billedDuration,
        jobId,
      });
      await JobsTable.updateStatus({
        id,
        jobId: jobId,
        status: "failed",
        result: "verification failed",
        billedDuration, // TODO: add billed duration for clearing old deployment
        maxAttempts: 1,
      });
      return false;
    }

    //TODO: add algolia event
    const address = verificationResult.account;
    await listFiles(developerDir, true);

    await copyZip({
      bucket: VERIFICATION_BUCKET,
      key: chain + "/zkapp/" + address + ".zip",
      folder: developerDir,
      file: filename,
    });
    // https://verification.zkcloudworker.com/devnet/zkapp/B62qrZso6WMaxZPrkDHW9sa7BTtVKjHon6BJxUbN3q6PwdTNQXWvADD.zip

    const file = new S3File(
      VERIFICATION_BUCKET,
      chain + "/zkapp/" + address + ".json"
    );
    await file.put(
      JSON.stringify(verificationResult, null, 2),
      "application/json"
    );
    // https://verification.zkcloudworker.com/devnet/zkapp/B62qrZso6WMaxZPrkDHW9sa7BTtVKjHon6BJxUbN3q6PwdTNQXWvADD.json
    await publishVerification({
      chain,
      account: address,
      metadata: verificationResult,
      developer,
      repo,
    });
    await fs.rm(developerDir + "/" + filename);
    const billedDuration = Date.now() - timeStarted;
    await charge({
      id,
      billedDuration,
      jobId,
    });
    await JobsTable.updateStatus({
      id,
      jobId: jobId,
      status: "finished",
      result: "verified",
      billedDuration, // TODO: add billed duration for clearing old deployment
      maxAttempts: 1,
    });

    console.time("cleared old deployment");
    const folders = await listFiles(repoDir, false);
    console.log("deployed versions:", folders);
    for (const folder of folders) {
      if (folder !== versionStr) {
        console.log("deleting old version", folder);
        await fs.rm(repoDir + "/" + folder, { recursive: true });
      }
    }
    await listFiles(repoDir, true);
    console.timeEnd("cleared old deployment");
    Memory.info("deployed");
    console.timeEnd("deployed");
    await sleep(1000);
    return true;
  } catch (err: any) {
    console.error(err);
    console.error("Error deploying package");
    const msg = err?.message ?? err?.toString();
    if (jobId !== "test")
      await JobsTable.updateStatus({
        id,
        jobId: jobId,
        status: "failed",
        result:
          "deploy error: " +
          (msg && typeof msg === "string"
            ? msg
            : "exception while installing dependencies and compiling"),
        billedDuration: Date.now() - timeStarted,
      });
    Memory.info("deploy error");
    console.timeEnd("deployed");
    await sleep(1000);
    return false;
  }
}

export async function verifyContract(
  data: any
): Promise<VerificationAnswer | undefined> {
  const {
    contract,
    address,
    image,
    chain,
    programDependencies,
    contractDependencies,
  } = data;

  const net = networks.find((n) => n.chainId === chain);
  if (net === undefined) {
    console.error("Network not found");
    return undefined;
  }
  const account = await getAccountFromGraphQL({
    publicKey: address,
    mina: net.mina,
  });
  if (account?.verificationKey === undefined) {
    console.error("Account does not have a verification key");
    return undefined;
  } else
    console.log(
      `Account ${address} verification key hash:`,
      account.verificationKey.hash
    );

  for (const program of programDependencies ?? []) {
    if (program.compile === undefined) {
      console.error("Program does not have a compile method:", program.name);
      return undefined;
    }
    console.log("Compiling program", program.name);
    await program.compile();
  }

  for (const contract of contractDependencies ?? []) {
    if (contract.compile === undefined) {
      console.error("Contract does not have a compile method:", contract.name);
      return undefined;
    }
    console.log("Compiling contract", contract.name);
    await contract.compile();
  }
  const verificationAnswer = await verifySmartContract(contract, address);
  if (verificationAnswer === undefined) {
    console.error("SmartContract is not verified");
    return undefined;
  }
  if (
    verificationAnswer.verificationKey.verificationKey !==
    account.verificationKey.verificationKey
  ) {
    console.error("Verification key does not match account verification key");
    return undefined;
  }
  if (
    verificationAnswer.verificationKey.hash !== account.verificationKey.hash
  ) {
    console.error(
      "Verification key hash does not match account verification key hash"
    );
    return undefined;
  }
  console.log("SmartContract is verified");
  verificationAnswer.image = image;
  return verificationAnswer;
}

async function verifySmartContract(
  contract: any,
  address: string
): Promise<VerificationAnswer | undefined> {
  const name = contract?.name;
  if (name === undefined) {
    console.error("Contract name is undefined");
    return undefined;
  }
  console.log("Analyzing methods of the contract", name);
  const methods = await contract.analyzeMethods();

  console.log("Compiling the contract", name);
  const vk = (await contract.compile()).verificationKey;

  /*
"methods": {
    "addOne": {
      "actions": 0,
      "rows": 1091,
      "digest": "3ba2a8153b4d9cb3b1e4d8e17c696da3",
      "gates": [
        {
  */
  for (const method in methods) {
    delete methods[method].gates;
  }

  return {
    name,
    account: address,
    verificationKey: { verificationKey: vk.data, hash: vk.hash.toJSON() },
    methods,
  } as VerificationAnswer;
}
