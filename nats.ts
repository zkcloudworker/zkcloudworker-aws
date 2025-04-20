import { Handler } from "aws-lambda";
import { publishCloudTransactionsNats } from "./src/publish/nats.js";

export const publish: Handler = async (event: any) => {
  try {
    await publishCloudTransactionsNats(event);
    return 200;
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return 200;
  }
};
