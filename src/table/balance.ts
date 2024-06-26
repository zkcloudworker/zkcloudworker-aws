import { Table } from "./table";
import { BalanceData } from "../model/balanceData";
import { callLambda } from "../lambda/lambda";

const BALANCE_TABLE = process.env.BALANCE_TABLE;

export async function charge(params: {
  id: string;
  billedDuration: number;
  jobId: string;
}): Promise<void> {
  await callLambda("charge", JSON.stringify(params));
}

export async function chargeInternal(params: {
  id: string;
  amount: number;
}): Promise<void> {
  const { id, amount } = params;
  if (!BALANCE_TABLE) throw new Error("BALANCE_TABLE is not defined");
  const balance = new Workers(BALANCE_TABLE);
  await balance.charge({ id, amount });
}

export async function topup(params: {
  id: string;
  amount: number;
}): Promise<void> {
  const { id, amount } = params;
  if (!BALANCE_TABLE) throw new Error("BALANCE_TABLE is not defined");
  const balance = new Workers(BALANCE_TABLE);
  await balance.topup({ id, amount });
}

export async function getBalance(id: string): Promise<number> {
  if (!BALANCE_TABLE) throw new Error("BALANCE_TABLE is not defined");
  const balance = new Workers(BALANCE_TABLE);
  const result = await balance.get({ id });
  return result?.balance ?? 0;
}

export async function createAccount(params: {
  id: string;
  initialBalance: number;
}) {
  const { id, initialBalance } = params;
  if (!BALANCE_TABLE) throw new Error("BALANCE_TABLE is not defined");
  const balance = new Workers(BALANCE_TABLE);
  const item = await balance.get({ id });
  if (item) {
    console.log("Account already exists", id);
  } else {
    await balance.create({
      id,
      balance: initialBalance,
      timeUpdated: Date.now(),
      countUpdated: 1,
    } as BalanceData);
  }
}

class Workers extends Table<BalanceData> {
  async charge(params: { id: string; amount: number }): Promise<void> {
    const { id, amount } = params;
    await this.updateData(
      {
        id,
      },
      {
        "#T": "timeUpdated",
        "#C": "countUpdated",
        "#B": "balance",
      },
      {
        ":t": Date.now(),
        ":b": -amount,
        ":c": 1,
      },
      "SET #T = :t ADD #C :c, #B :b"
    );
  }

  async topup(params: { id: string; amount: number }): Promise<void> {
    const { id, amount } = params;
    const item = await this.get({ id });
    if (item)
      await this.updateData(
        {
          id,
        },
        {
          "#T": "timeUpdated",
          "#C": "countUpdated",
          "#B": "balance",
        },
        {
          ":t": Date.now(),
          ":b": amount,
          ":c": 1,
        },
        "SET #T = :t ADD #C :c, #B :b"
      );
    else
      await this.create({
        balance: amount,
        timeUpdated: Date.now(),
        countUpdated: 1,
      } as BalanceData);
  }
}
