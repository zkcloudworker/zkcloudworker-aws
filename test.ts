import type { Handler, Context, Callback } from "aws-lambda";
import { cloud as cloudFunc, runZip } from "./src//api/cloud";
import {
  Field,
  PublicKey,
  Poseidon,
  PrivateKey,
  Encoding,
  MerkleMap,
  Struct,
} from "o1js";
import { makeString } from "zkcloudworker";

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
    console.log("test started");
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

    const ELEMENTS_NUMBER = 1000;
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

export { cloud };
