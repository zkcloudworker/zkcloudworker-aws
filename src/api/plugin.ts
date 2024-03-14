import { BackendPlugin } from "zkcloudworker";
import { DomainNameServicePlugin } from "../external/DomainNameService/plugin";

export async function getBackupPlugin(params: {
  developer: string;
  name: string;
  task: string;
  args: string[];
}): Promise<BackendPlugin> {
  const { developer, name, task, args } = params;
  if (developer === "@dfst") {
    switch (name) {
      default:
        throw new Error("unknown plugin name");
    }
  } else if (developer === "@staketab") {
    return new DomainNameServicePlugin({ name, task, args });
  } else throw new Error("unknown developer");
}
