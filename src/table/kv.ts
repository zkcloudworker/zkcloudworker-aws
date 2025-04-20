import { Table } from "./table.js";
import { KeyValueData } from "../model/kvData.js";
const KV_TABLE = process.env.KV_TABLE!;

export class KeyValue extends Table<KeyValueData> {}

export async function getSystemDataByKey(
  key: string
): Promise<string | undefined> {
  const kvTable = new KeyValue(KV_TABLE);
  const result = await kvTable.get({
    repoId: "system",
    keyId: key,
  });
  return result?.valueJSON;
}

export async function saveSystemDataByKey(
  key: string,
  data: string
): Promise<void> {
  const kvTable = new KeyValue(KV_TABLE);
  try {
    await kvTable.create({
      repoId: "system",
      keyId: key,
      valueJSON: data,
    });
  } catch (error) {
    console.error("saveDataByKey error: ", error);
    return undefined;
  }
}
