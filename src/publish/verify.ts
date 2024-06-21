import { VerificationAnswer } from "../api/verify";
import { publishVerificationNats } from "./nats";
import { publishVerificationAlgolia } from "./algolia";

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
