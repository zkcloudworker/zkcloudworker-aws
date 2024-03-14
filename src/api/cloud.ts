import { listFiles, loadCache } from "../mina/cache";
import { unzip } from "../storage/zip";
import fs from "fs/promises";
import { CloudWorker } from "./cloudobject";
import { Cache } from "o1js";
import { runCLI } from "jest";
import { minaInit } from "../mina/init";

const { PROVER_KEYS_BUCKET } = process.env;
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
      cacheBucket: PROVER_KEYS_BUCKET!,
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
    cacheBucket: PROVER_KEYS_BUCKET!,
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
  //const o1js = await import("o1js");
  //console.log("imported o1js");

  /*
  const { TreeCalculation, TreeVerifier } = await contracts[functionName](
    height,
    o1js
  );
  console.log("imported TreeCalculation, TreeVerifier");
  const cache: Cache = Cache.FileSystem(cacheDir);

  await TreeCalculation.compile({ cache });
  await TreeVerifier.compile({ cache });
  console.log("compiled TreeCalculation, TreeVerifier");

  await listFiles(contractsDir, true);
  await listFiles(cacheDir, true);
  */
}

/*
  console.time("all");
  Memory.info("start");
  const useLocalBlockchain: boolean = true;
  const transactionFee = 150_000_000;

  const keys = MinaNFT.minaInit("local");
  const deployer = keys ? keys[0].privateKey : PrivateKey.fromBase58(DEPLOYER!);
  const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK!);
  const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
  const ownerPrivateKey = PrivateKey.random();
  const ownerPublicKey = ownerPrivateKey.toPublicKey();
  const owner = Poseidon.hash(ownerPublicKey.toFields());
  const pinataJWT = PINATA_JWT!;

  console.log(
    `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
  );

  Memory.info("before cache");
  //const cache = getCache(PROVER_KEYS_BUCKET!, true);


  const cacheDir = "/tmp/counter-cache";
  console.time("loaded cache");
  await loadCache(PROVER_KEYS_BUCKET!, cacheDir, files);
  console.timeEnd("loaded cache");
  await listFiles(cacheDir);
  Memory.info("cache loaded");

  const nftCacheDir = "/tmp/nft-cache";
  //console.log("NFT files", nftfiles);
  console.time("loaded nft cache");
  //await loadCache(PROVER_KEYS_BUCKET!, nftCacheDir, nftfiles);
  console.timeEnd("loaded nft cache");
  await listFiles(nftCacheDir);
  Memory.info("nft cache loaded");

  Memory.info("before compiling");
  console.log("Compiling...");
  //const cache: Cache = Cache.FileSystem(cacheDir, true);
  //const cache: Cache = Cache.FileSystem(nftCacheDir, true);
  //console.time("MinaNFTMetadataUpdate compiled");
  //await MinaNFTMetadataUpdate.compile({ cache });
  //console.timeEnd("MinaNFTMetadataUpdate compiled");
  MinaNFT.setCacheFolder(nftCacheDir);

  console.time("compiled");
  await MinaNFT.compile();
  //const { verificationKey } = await Counter.compile({ cache });
  console.timeEnd("compiled");
  Memory.info("after compiling");
  */
/*
  await listFiles(cacheDir);
  console.log(`Verification key: ${verificationKey.hash.toJSON()}`);
  if (verificationKey.hash.toJSON() !== counterHash) {
    console.error("Verification key hash is not", counterHash);
    return;
  }
  */
/*
  const sender = deployer.toPublicKey();
  const counterPrivateKey = PrivateKey.random();
  const counterPublicKey = counterPrivateKey.toPublicKey();
  await fetchAccount({ publicKey: sender });
  await fetchAccount({ publicKey: counterPublicKey });

  const zkCounter = new Counter(counterPublicKey);
  const transaction = await Mina.transaction(
    { sender, fee: transactionFee },
    () => {
      AccountUpdate.fundNewAccount(sender);
      zkCounter.deploy({});
      zkCounter.counter.set(UInt64.from(1));
    }
  );
  Memory.info("after transaction");
  console.time("proved");
  await transaction.prove();
  console.timeEnd("proved");
  Memory.info("after prove");
  transaction.sign([deployer, counterPrivateKey]);
  const tx = await transaction.send();
  Memory.info("after send");
  console.log(
    `deploying the Counter contract to an address ${counterPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`,
    transaction.toPretty()
  );
  if (!useLocalBlockchain) {
    console.log(`Transaction hash: ${tx.hash()}`);
    await tx.wait({ maxAttempts: 120, interval: 60000 });
  }
  const transaction1 = await Mina.transaction(
    { sender, fee: transactionFee },
    () => {
      zkCounter.increaseCounter();
    }
  );
  Memory.info("after transaction increaseCounter");
  console.time("proved");
  await transaction1.prove();
  console.timeEnd("proved");
  Memory.info("after prove increaseCounter");
  transaction1.sign([deployer, counterPrivateKey]);
  const tx1 = await transaction1.send();
  Memory.info("after send");
  if (!useLocalBlockchain) {
    console.log(`Transaction hash: ${tx.hash()}`);
    await tx.wait({ maxAttempts: 120, interval: 60000 });
  } else console.log(`Transaction: ${tx1.isSuccess}`);
  */

/*
  const nft = new MinaNFT({ name: `@test` });
  nft.updateText({
    key: `description`,
    text: "This is my long description of the NFT. Can be of any length, supports markdown.",
  });
  nft.update({ key: `twitter`, value: `@builder` });
  nft.update({ key: `secret`, value: `mysecretvalue`, isPrivate: true });
  const imageData = await getFileData(filename);
  nft.updateFileData(`image`, "image", imageData, false);
  /*
  await nft.updateImage({
    filename: "./images/navigator.jpg",
    pinataJWT,
  });

  const map = new MapData();
  map.update({ key: `level2-1`, value: `value21` });
  map.update({ key: `level2-2`, value: `value22` });
  map.updateText({
    key: `level2-3`,
    text: `This is text on level 2. Can be very long`,
  });

  await map.updateFile({
    key: "woman",
    filename: "./images/woman.png",
    pinataJWT,
  });

  const mapLevel3 = new MapData();
  mapLevel3.update({ key: `level3-1`, value: `value31` });
  mapLevel3.update({ key: `level3-2`, value: `value32`, isPrivate: true });
  mapLevel3.update({ key: `level3-3`, value: `value33` });
  map.updateMap({ key: `level2-4`, map: mapLevel3 });
  nft.updateMap({ key: `level 2 and 3 data`, map });

  
  console.log(`json:`, JSON.stringify(nft.toJSON(), null, 2));
  Memory.info("json");
*/
/*
  const nameService = new MinaNFTNameService({ oraclePrivateKey });
  let tx = await nameService.deploy(deployer);
  if (tx === undefined) {
    throw new Error("Deploy failed");
  }
  Memory.info("deploy");
  await MinaNFT.transactionInfo(tx, "deploy name service");


  const nameService = new MinaNFTNameService({
    oraclePrivateKey,
    address: nameServiceAddress,
  });

  console.time("mint");
  const tx = await nft.mint({
    deployer,
    owner,
    pinataJWT,
    nameService,
  });
  console.timeEnd("mint");
  Memory.info("mint");
  if (tx === undefined) {
    throw new Error("Mint failed");
  }
  await MinaNFT.transactionInfo(tx, "mint");

  Memory.info("end");
  console.timeEnd("all");
}
  */
