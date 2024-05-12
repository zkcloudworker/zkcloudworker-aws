import { Cloud, zkCloudWorker, initBlockchain } from "zkcloudworker";
import { initializeBindings } from "o1js";
import { DomainNameServiceWorker } from "./worker";

export async function zkcloudworker(cloud: Cloud): Promise<zkCloudWorker> {
  //await initializeBindings();
  console.log("zkcloudworker chain:", cloud.chain);
  await initBlockchain(cloud.chain);
  return new DomainNameServiceWorker(cloud);
}
