import type { Handler, Context, Callback } from "aws-lambda";
import { chargeInternal } from "./src/table/balance";
import { publishChargeAlgolia } from "./src/publish/algolia";

const MS_PER_MINA = 250_000;

export const run: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  console.log("charge", event);
  const {
    id,
    billedDuration,
    jobId,
  }: { id: string; billedDuration: number; jobId: string } = event;
  console.log("charge", { id, billedDuration, jobId });
  if (id === undefined || billedDuration === undefined || jobId === undefined) {
    console.error("Missing required parameters for charge function");
    return 200;
  }
  try {
    const amount = billedDuration / MS_PER_MINA;
    await chargeInternal({ id, amount });
    await publishChargeAlgolia({ id, billedDuration, jobId, amount });
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};
