import type { Handler, Context, Callback } from "aws-lambda";
import { cloud as cloudFunc, runZip } from "./src//api/cloud";
import os from "os";
import fs from "fs/promises";
import { listFiles } from "./src/mina/cache";
import {
  Field,
  PublicKey,
  Poseidon,
  PrivateKey,
  Encoding,
  MerkleMap,
  Struct,
  SmartContract,
  state,
  State,
  method,
  Mina,
  AccountUpdate,
  setNumberOfWorkers,
  ZkProgram,
} from "o1js";
import { makeString } from "zkcloudworker";
import { checkInternet } from "./src/api/internet";

class Storage extends Struct({
  hashString: [Field, Field],
}) {
  constructor(value: { hashString: [Field, Field] }) {
    super(value);
  }
  toFields(): Field[] {
    return this.hashString;
  }
}

export class MapElement extends Struct({
  name: Field,
  address: PublicKey,
  addressHash: Field, // Poseidon hash of address.toFields()
  hash: Field, // Poseidon hash of [name, ...address.toFields()]
  storage: Storage,
}) {
  toFields(): Field[] {
    return [
      this.name,
      ...this.address.toFields(),
      this.addressHash,
      this.hash,
      ...this.storage.toFields(),
    ];
  }

  static fromFields(fields: Field[]): MapElement {
    return new MapElement({
      name: fields[0],
      address: PublicKey.fromFields(fields.slice(1, 3)),
      addressHash: fields[3],
      hash: fields[4],
      storage: new Storage({ hashString: [fields[5], fields[6]] }),
    });
  }
}

const cloud: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.time("test");
    console.log("event", event);
    const cpuCores = os.cpus();
    console.log(cpuCores);
    for (const core of cpuCores) {
      console.log(core.times);
    }
    const numberOfCPUCores = cpuCores.length;
    console.log("CPU cores:", numberOfCPUCores);
    console.log("test started");

    const cacheDir = "/mnt/efs/cache";
    await listFiles(cacheDir);
    await fs.rm(cacheDir, { recursive: true });
    await listFiles(cacheDir);
    /*
    try {
      const result = await runZip({
        fileName: "mac.zip",
        functionName: "compile",
        args: ["arg1a", "arg2b"],
      });
      console.log("cloud test result", result);
    } catch (error: any) {
      console.error("cloud catch", (error as any).toString());
    }
    */

    //await checkInternet();

    setNumberOfWorkers(6);
    await arm2();

    const ELEMENTS_NUMBER = 10;
    const elements: MapElement[] = [];

    console.time(`prepared data of ${ELEMENTS_NUMBER} items`);
    const storage: Storage = new Storage({ hashString: [Field(0), Field(0)] });
    for (let i = 0; i < ELEMENTS_NUMBER; i++) {
      const name = Encoding.stringToFields(makeString(30))[0];
      const address = PrivateKey.random().toPublicKey();
      const addressHash = Poseidon.hash(address.toFields());
      const hash = Poseidon.hash([name, ...address.toFields()]);
      const element = new MapElement({
        name,
        address,
        addressHash,
        storage,
        hash,
      });
      elements.push(element);
    }
    console.timeEnd(`prepared data of ${ELEMENTS_NUMBER} items`);

    const max = [ELEMENTS_NUMBER / 10, ELEMENTS_NUMBER / 1];
    for (const m of max) {
      console.time(`created a block of ${m} items`);
      const map: MerkleMap = new MerkleMap();
      for (let i = 0; i < m; i++) {
        map.set(elements[i].name, elements[i].hash);
      }
      const root = map.getRoot();
      console.timeEnd(`created a block of ${m} items`);
    }

    console.log("test finished");
    console.timeEnd("test");
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};

async function arm() {
  console.log("arm 1");
  class TokenAccount extends SmartContract {
    @state(Field) value = State<Field>();

    @method update(value: Field) {
      const oldValue = this.value.getAndRequireEquals();
      oldValue.assertEquals(value.sub(Field(1)));
      this.value.set(value);
    }
  }

  const Local = Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
  const deployer = Local.testAccounts[0].privateKey;
  const zkAppTokenPrivateKey = PrivateKey.random();
  const zkAppTokenPublicKey = zkAppTokenPrivateKey.toPublicKey();
  const zkToken = new TokenAccount(zkAppTokenPublicKey);
  const sender = deployer.toPublicKey();
  const transactionFee = 150_000_000;
  console.log("arm 2");

  await TokenAccount.compile();
  console.log("arm 3");
  const transaction = await Mina.transaction(
    { sender, fee: transactionFee, memo: "arm" },
    () => {
      AccountUpdate.fundNewAccount(sender);
      zkToken.deploy({});
    }
  );
  console.log("arm 4");
  transaction.sign([deployer, zkAppTokenPrivateKey]);
  console.log("arm 5");
  const tx = await transaction.send();
  console.log("arm 6");
  console.log("tx", tx);
}

async function arm2() {
  console.log("arm 1");
  class Element extends Struct({
    key: Field,
    value1: Field,
    value2: Field,
  }) {}

  const MyZkProgram = ZkProgram({
    name: "MyZkProgram",
    publicInput: Element,

    methods: {
      create: {
        privateInputs: [],

        method(element: Element) {
          element.value1.assertEquals(element.value2);
        },
      },
    },
  });

  await MyZkProgram.compile();
  console.log("arm 2");
  const proof = await MyZkProgram.create({
    key: Field(1),
    value1: Field(2),
    value2: Field(2),
  });
  console.log("arm 3");
  console.log("proof", proof);
}

export { cloud };
