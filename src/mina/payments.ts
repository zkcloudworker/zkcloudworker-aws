import { getSystemDataByKey, saveSystemDataByKey } from "../table/kv.js";
import { topup } from "../table/balance.js";
import { publishPayment } from "../publish/algolia.js";

const BLOCKBERRY_API_KEY = process.env.BLOCKBERRY_API_KEY;
const zkcwWalletAddress = process.env.ZKCW_WALLET_ADDRESS;

async function getIncomingPayments(params: { account: string }): Promise<any> {
  const { account } = params;
  if (BLOCKBERRY_API_KEY === undefined) {
    console.error("BLOCKBERRY_API_KEY is not defined");
    return undefined;
  }
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-api-key": BLOCKBERRY_API_KEY,
    },
  };

  try {
    const response = await fetch(
      "https://api.blockberry.one/mina-mainnet/v1/accounts/" +
        account +
        "/txs?page=0&size=10&orderBy=DESC&sortBy=AGE&direction=IN",
      options
    );
    const result = await response.json();
    //console.log("result:", result);
    return result;
  } catch (err) {
    console.error(err);
    return undefined;
  }
}

export async function processIncomingPayments() {
  if (zkcwWalletAddress === undefined) {
    console.error("ZKCW_WALLET_ADDRESS is not defined");
    return;
  }
  const transaction = await getIncomingPayments({
    account: zkcwWalletAddress,
  });
  const list = transaction?.data ?? [];
  const lastBlockHeight = parseInt(
    (await getSystemDataByKey("lastBlockHeight")) ?? "0"
  );
  /*
{
  type: 'payment',
  direction: 'IN',
  accountAddress: 'B62qouNvgzGaA3fe6G9mKtktCfsEinqj27eqTSvDu4jSKReDEx7A8Vx',
  accountName: 'Binance Wallet 1',
  accountImg: 'https://strapi-dev.scand.app/uploads/binance_Logo_257bfb2b20.png',
  txHash: 'CkpZtdZgXQw2CY3jLpn3EfPZpJJHeoAscwpYsWdwjjWnT92jQgZp1',
  status: 'Applied',
  age: 1713939840000,
  amount: 3981188.717,
  fee: 0.0305,
  blockHeight: 348379,
  stateHash: '3NLMgoPw96bZ7VztnMe6uShmkhaAoswee1jYJgD9vRm8UUb7QXqC',
  memo: '',
  isAmountChangeable: false,
  isZkappAccount: null
},

  */
  let saved = false as boolean;
  for (const item of list) {
    if (
      item.type === "payment" &&
      item.blockHeight > lastBlockHeight &&
      item.direction === "IN" &&
      item.status === "Applied"
    ) {
      const from = item.accountAddress;
      const amount = item.amount;
      console.error("topup:", { from, amount });
      if (!saved) {
        await saveSystemDataByKey(
          "lastBlockHeight",
          item.blockHeight.toString()
        );
        saved = true;
      }
      await topup({ id: from, amount });
      await publishPayment({
        txHash: item.txHash,
        account: from,
        amount,
      });
    }
  }
}
