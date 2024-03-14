import {
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
  GetItemCommand,
  DeleteItemCommand,
  UpdateItemCommand,
  UpdateItemCommandInput,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export default class Table<T> {
  private _client: DynamoDBClient;
  private tableName: string;

  constructor(tableName: string) {
    const options = {};
    this._client = new DynamoDBClient(options);
    this.tableName = tableName;
    //console.log("Table", tableName, "region", process.env.AWS_REGION);
  }

  get client(): DynamoDBClient {
    return this._client;
  }

  public async create(item: T): Promise<void> {
    try {
      const params = {
        TableName: this.tableName,
        Item: marshall(item, {
          removeUndefinedValues: true,
        }),
      };
      //console.log("Table: create", params);
      const command = new PutItemCommand(params);
      const data = await this._client.send(command);
      //console.log("Success: Table: create", data);
    } catch (error: any) {
      throw Error(`Error: Table: create ${error}`);
    }
  }

  public async scan(): Promise<T[]> {
    try {
      const params = {
        TableName: this.tableName,
        ConsistentRead: true,
      };
      //console.log("Table: scan", params);
      const command = new ScanCommand(params);
      const data = await this._client.send(command);
      let result: T[] = [];
      if (data.Items === undefined) return result;
      for (let i = 0; i < data.Items.length; i++) {
        result.push(unmarshall(data.Items[i]) as T);
      }
      //console.log("Success: Table: scan", result);
      return result;
    } catch (error: any) {
      console.error("Error: Table: scan", error);
      return [];
    }
  }

  public async get(key: any): Promise<T | undefined> {
    try {
      const params = {
        TableName: this.tableName,
        Key: marshall(key),
        ConsistentRead: true,
      };
      //console.log("Table: get", params);
      const command = new GetItemCommand(params);
      const data = await this._client.send(command);
      if (data.Item === undefined) return undefined;
      //console.log("Read result: Table: get", data.Item);
      return unmarshall(data.Item) as T;
    } catch (error: any) {
      console.log("Cannot get item:", key, "Table: get error", error);
      return undefined;
    }
  }

  public async update(item: T): Promise<void> {
    await this.create(item);
  }

  public async remove(key: any): Promise<void> {
    try {
      const params = {
        TableName: this.tableName,
        Key: marshall(key),
      };
      //console.log("Table: remove", params);
      const command = new DeleteItemCommand(params);
      const data = await this._client.send(command);
    } catch (error: any) {
      console.error("Error: Table: remove", error);
    }
  }

  public async updateData(
    key: any,
    names: any,
    values: any,
    updateExpression: string,
    conditionExpression?: string
  ): Promise<T | undefined> {
    try {
      const params: UpdateItemCommandInput = {
        TableName: this.tableName,
        Key: marshall(key),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values),
        UpdateExpression: updateExpression,
        ReturnValues: "ALL_NEW",
      } as UpdateItemCommandInput;
      if (conditionExpression !== undefined) {
        params.ConditionExpression = conditionExpression;
      }
      //console.log("Table: updateData", params);
      const command = new UpdateItemCommand(params);
      const data = await this._client.send(command);
      if (data.Attributes === undefined) return undefined;
      return unmarshall(data.Attributes) as T;
    } catch (error: any) {
      console.error("Error: Table: updateData", error);
      return undefined;
    }
  }

  public async queryData(
    keyConditionExpression: string,
    expressionAttributeValues: any,
    projectionExpression: string = ""
  ): Promise<T[]> {
    try {
      const params: QueryCommandInput = {
        TableName: this.tableName,
        ConsistentRead: true,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
      };
      if (projectionExpression !== "")
        params.ProjectionExpression = projectionExpression;
      //console.log("Table: queryData", params);
      const command = new QueryCommand(params);
      let data = await this._client.send(command);
      let result: T[] = [];
      if (data.Items === undefined) return result;
      for (let i = 0; i < data.Items.length; i++) {
        result.push(unmarshall(data.Items[i]) as T);
      }
      let count = 0;
      while (
        data.LastEvaluatedKey !== undefined &&
        data.LastEvaluatedKey.id !== undefined &&
        count < 100
      ) {
        const command1 = new QueryCommand({
          ...params,
          ExclusiveStartKey: data.LastEvaluatedKey,
        });
        data = await this._client.send(command1);
        if (data.Items === undefined) return result;
        for (let i = 0; i < data.Items.length; i++) {
          result.push(unmarshall(data.Items[i]) as T);
        }
        count++;
      }
      //console.log("Success: Table: queryData", result);
      return result;
    } catch (error: any) {
      console.error("Error: Table: queryData", error);
      return [];
    }
  }
}
