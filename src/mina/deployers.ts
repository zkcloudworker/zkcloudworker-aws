import {
  makeString,
  sleep,
  blockchain,
  getBalanceFromGraphQL,
  DeployerKeyPair,
  networks,
} from "../cloud";
import { GASTANKS } from "./gastanks";
import { Deployers } from "../table/deployers";

const GAS_TANK_MIN_LIMIT = 5 * 10 ** 9;
const DELAY = 60 * 60 * 1000; // 1 hour

var deployer1: number | undefined;
var deployer2: number | undefined;
var deployer3: number | undefined;

export async function getDeployer(
  minimumBalance: number = GAS_TANK_MIN_LIMIT,
  chain: blockchain
): Promise<DeployerKeyPair | undefined> {
  if (chain !== "devnet" && chain !== "zeko") {
    console.error("Only devnet and zeko are supported for now in getDeployer");
    return undefined;
  }
  const mina = networks.find((n) => n.chainId === chain)?.mina;
  if (mina === undefined) {
    console.error(`Network ${chain} not found`);
    return undefined;
  }
  let count = 0;
  let found = false;
  let i: number = Math.floor(Math.random() * (GASTANKS.length - 1));
  let gasTank: DeployerKeyPair = GASTANKS[i];
  while (
    i === deployer1 ||
    i === deployer2 ||
    i === deployer3 ||
    found === false
  ) {
    if (count > GASTANKS.length * 2) return undefined;
    count++;
    if (i === deployer1 || i === deployer2 || i === deployer3) {
      console.log(`Deployer ${i} was recently used or empty, finding another`);
      i = Math.floor(Math.random() * (GASTANKS.length - 1));
      gasTank = GASTANKS[i];
    } else {
      const { canUse, balance } = await checkGasTank({
        gasTank,
        minimumBalance,
        mina,
        chain,
      });
      if (canUse === true) {
        console.log(
          `getDeployer: providing deployer ${gasTank.publicKey} with balance ${
            balance / 1_000_000_000n
          }`
        );
        deployer3 = deployer2;
        deployer2 = deployer1;
        deployer1 = i;
        return gasTank;
      } else {
        console.log(
          `Deployer ${i} with publicKey ${gasTank.publicKey} was recently used or empty, finding another`
        );
        i = Math.floor(Math.random() * (GASTANKS.length - 1));
        gasTank = GASTANKS[i];
        count++;
        if (count > GASTANKS.length * 2) {
          console.error("Faucet is empty");
          return undefined;
        }
      }
    }
  }
  return undefined;
}

async function checkGasTank(params: {
  gasTank: DeployerKeyPair;
  minimumBalance: number;
  mina: string[];
  chain: blockchain;
}): Promise<{ canUse: boolean; balance: bigint }> {
  const { gasTank, minimumBalance, mina, chain } = params;

  let balanceGasTank = 0n;
  try {
    balanceGasTank = await getBalanceFromGraphQL({
      publicKey: gasTank.publicKey,
      mina,
    });
  } catch (error) {
    console.error("Error: checkGasTank getBalanceFromGraphQ", error);
  }
  const replenishGasTank: boolean = balanceGasTank <= minimumBalance;

  if (replenishGasTank) {
    console.error("gas tank needs replenishing", {
      publicKey: gasTank.publicKey,
      balance: balanceGasTank,
    });
    return { canUse: false, balance: balanceGasTank };
  }

  const deployersTable = new Deployers(process.env.DEPLOYERS_TABLE!);
  const deployer = await deployersTable.get({
    publicKey: gasTank.publicKey,
    chain,
  });
  const code = makeString(20);
  if (
    deployer === undefined ||
    (deployer.timeUsed !== undefined && deployer.timeUsed + DELAY < Date.now())
  ) {
    await deployersTable.create({
      publicKey: gasTank.publicKey,
      chain,
      timeUsed: Date.now(),
      code,
    });
    await sleep(1000);
    const check = await deployersTable.get({
      publicKey: gasTank.publicKey,
      chain,
    });
    if (check && check.code === code) {
      return { canUse: true, balance: balanceGasTank };
    } else {
      console.error("Deployer is not available", {
        deployer,
        check,
        publicKey: gasTank.publicKey,
      });
      return { canUse: false, balance: balanceGasTank };
    }
  } else
    console.log("Deployer is not available", {
      deployer,
      publicKey: gasTank.publicKey,
    });

  return { canUse: false, balance: balanceGasTank };
}
