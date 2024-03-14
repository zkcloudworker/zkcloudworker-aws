import Table from "./table";
import TasksData from "../model/tasksData";

export default class Tasks extends Table<TasksData> {

  public async remove(id: string): Promise<void> {
    await super.remove({ id: id })
  }
}

/*
import AWS, { AWSError } from "aws-sdk";
import { DocumentClient, GetItemOutput } from "aws-sdk/clients/dynamodb";
import TasksData from "../model/tasksData";

export default class Tasks {
  private _client: DocumentClient;
  private tableName: string;

  constructor(tableName: string) {
    let options = {};
    this._client = new AWS.DynamoDB.DocumentClient(options);
    this.tableName = tableName;
  }

  get client(): DocumentClient {
    return this.client;
  }

  public create(task: TasksData): void {
    const params = {
      TableName: this.tableName,
      Item: task,
    };
    console.log("create", params);
    this._client.put(params, (error) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  public async scan(): Promise<TasksData[]> {
    const params = {
      TableName: this.tableName,
    };

    return this._client
      .scan(params)
      .promise()
      .then((res) => {
        //console.log("scan", params, res);
        return res.Items as TasksData[];
      });
  }

  public async get(id: string): Promise<TasksData | undefined> {
    const params = {
      TableName: this.tableName,
      Key: {
        id: id,
      },
    };

    return this._client
      .get(params, (error: AWSError, data: GetItemOutput) => {
        if (error) {
          console.error(error);
          return undefined;
        }
        return data;
      })
      .promise()
      .then((res) => {
        if (res && res.Item) {
          return res.Item as TasksData;
          console.log("get", params, res.Item);
        } else {
          return undefined;
        }
      })
      .catch(() => {
        console.log("get DB query failed: no tasks data");
        return undefined;
      });
  }

  public async update(task: TasksData): Promise<void> {
    const data = task.taskdata ? task.taskdata : "";
    const params = {
      TableName: this.tableName,
      Key: {
        id: task.id,
      },
      UpdateExpression: `set task = :ts, startTime = :tm, taskdata = :td`,
      ExpressionAttributeValues: {
        ":ts": task.task,
        ":tm": task.startTime,
        ":td": data,
      },
      ReturnValues: "UPDATED_NEW",
    };
    console.log("update", params);
    this._client.update(params, (error, data) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  public async remove(id: string): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        id: id,
      },
    };
    console.log("remove", params);
    this._client.delete(params, (error, data) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }
}
*/