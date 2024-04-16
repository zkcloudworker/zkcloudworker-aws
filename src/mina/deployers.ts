import { PrivateKey, PublicKey } from "o1js";
import {
  accountBalanceMina,
  makeString,
  sleep,
  blockchain,
} from "zkcloudworker";
import { GASTANKS } from "./gastanks";
import { Deployers } from "../table/deployers";
import { check } from "../../tasks";
const GASTANK_MINLIMIT = 4;
const DELAY = 60 * 60 * 1000; // 1 hour

var deployer1: number | undefined;
var deployer2: number | undefined;
var deployer3: number | undefined;

//TODO stop relying on AWS saving state in short term and replace with DynamoDB table logic
export async function getDeployer(
  minimumBalance: number = GASTANK_MINLIMIT,
  chain: blockchain = "devnet"
): Promise<PrivateKey> {
  if (chain !== "devnet") throw new Error("Only devnet is supported for now");
  let count = 0;
  let i: number = Math.floor(Math.random() * (GASTANKS.length - 1));
  let replenish: boolean = await checkGasTank(GASTANKS[i], minimumBalance);
  while (i === deployer1 || i === deployer2 || i === deployer3 || replenish) {
    console.log(`Deployer ${i} was recently used or empty, finding another`);
    i = Math.floor(Math.random() * (GASTANKS.length - 1));
    replenish = await checkGasTank(GASTANKS[i], minimumBalance);
    count++;
    if (count > GASTANKS.length * 2) throw new Error("Faucet is empty");
  }
  // shifting last deployers
  deployer3 = deployer2;
  deployer2 = deployer1;
  deployer1 = i;

  const gastank = GASTANKS[i];
  console.log(
    `Using gas tank no ${i} with private key ${gastank}, last deployers:`,
    deployer1,
    deployer2,
    deployer3
  );
  const deployerPrivateKey = PrivateKey.fromBase58(gastank);
  return deployerPrivateKey;
}

async function checkGasTank(
  gastank: string,
  minimumBalance: number
): Promise<boolean> {
  const gasTankPrivateKeyMina = PrivateKey.fromBase58(gastank);
  const gasTankPublicKeyMina = gasTankPrivateKeyMina.toPublicKey();
  const publicKey = gasTankPublicKeyMina.toBase58();

  const balanceGasTank = await accountBalanceMina(gasTankPublicKeyMina);
  const replenishGasTank: boolean =
    minimumBalance === 0 ? false : balanceGasTank < minimumBalance;
  console.log(
    "Balance of gas tank",
    PublicKey.toBase58(gasTankPublicKeyMina),
    "is",
    balanceGasTank.toLocaleString("en"),
    ", needs replenishing:",
    replenishGasTank
  );

  if (replenishGasTank) return true;
  const deployersTable = new Deployers(process.env.DEPLOYERS_TABLE!);
  const deployer = await deployersTable.get({ publicKey });
  const code = makeString(20);
  if (
    deployer === undefined ||
    (deployer.timeUsed !== undefined && deployer.timeUsed + DELAY < Date.now())
  ) {
    await deployersTable.create({
      publicKey,
      timeUsed: Date.now(),
      code,
    });
    await sleep(1000);
    const check = await deployersTable.get({ publicKey });
    if (check && check.code === code) {
      console.log("Deployer is available");
      return false;
    } else {
      console.log("Deployer is not available", deployer, check);
      return true;
    }
  } else console.log("Deployer is not available", deployer);

  return true;
}
