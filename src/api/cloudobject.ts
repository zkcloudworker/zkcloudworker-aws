import { Cache, PrivateKey } from "o1js";
import { getDeployer } from "../mina/deployers";
import { minaInit } from "../mina/init";
import { Cloud } from "zkcloudworker";

/*
abstract class Cloud {
  cache: Cache;
  constructor(cache: Cache) {
    this.cache = cache;
  }
  abstract getDeployer(): Promise<PrivateKey>;
  abstract log(msg: string): void;
}
*/

export class CloudWorker extends Cloud {
  constructor(cache: Cache) {
    super(cache);
  }
  async getDeployer(): Promise<PrivateKey> {
    minaInit();
    const deployer = await getDeployer(0);
    return deployer;
  }
  async log(msg: string): Promise<void> {
    console.log("CloudWorker:", msg);
  }
}
