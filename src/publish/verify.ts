import { VerificationAnswer } from "../api/verify.js";
import { publishVerificationNats } from "./nats.js";
import { publishVerificationAlgolia } from "./algolia.js";

export async function publishVerification(params: {
  chain: string;
  account: string;
  metadata: VerificationAnswer;
  developer: string;
  repo: string;
}): Promise<void> {
  const { chain, metadata, developer, repo, account } = params;
  await publishVerificationNats(params);
  await publishVerificationAlgolia(params);
}
