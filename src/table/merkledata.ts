/*
import Users from "./Users";
import MerkleData from "../model/merkleData";
import FormQuestion from "../model/formQuestion";
import Questions from "../questions";

export default async function merkleData(id: string): Promise<MerkleData[]> {
  console.log("merkleData", id);
  const users = new Users(process.env.DYNAMODB_TABLE!);
  const item = await users.getFullItem(id);
  let data: MerkleData[] = [];
  data.push(<MerkleData>{ name: "telegramId", value: id });
  const questions = new Questions();
  const questionsArray: FormQuestion[] = questions.questions;
  let k: number;
  for (k = 0; k < questionsArray.length; k++) {
    if (item && item[questionsArray[k].name])
      data.push(<MerkleData>{
        name: questionsArray[k].name,
        value: item[questionsArray[k].name],
      });
  }
  console.log("Merkle data:", data);
  return data;
}
*/