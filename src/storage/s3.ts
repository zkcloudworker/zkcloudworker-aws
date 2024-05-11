import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import axios from "axios";
import { createHash } from "crypto";

export class S3File {
  private readonly _client: S3Client;
  private readonly bucket: string;
  private readonly key: string;

  constructor(bucket: string, key: string) {
    const options = { forcePathStyle: true };
    this._client = new S3Client(options);
    this.bucket = bucket;
    this.key = key;
    /*
    console.log(
      "S3File created:",
      bucket,
      ":",
      key,
      "region:",
      process.env.AWS_REGION
    );
    */
  }

  get client(): S3Client {
    return this._client;
  }

  public async put(
    data: Buffer | string,
    mimeType: string | undefined
  ): Promise<void> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key,
        Body: data,
        ContentType: mimeType ?? "application/octet-stream",
      };
      //console.log("S3File: put", params);
      const command = new PutObjectCommand(params);
      const response = await this._client.send(command);
      console.log("Success: S3File: put");
    } catch (error: any) {
      console.error("Error: S3File: put", error);
    }
  }

  public async get(): Promise<any | undefined> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key,
      };
      //console.log("S3File: get", params);
      const command = new GetObjectCommand(params);
      const data = await this._client.send(command);
      //console.log("Success: S3File: get");
      return data;
    } catch (error: any) {
      console.error("Error: S3File: get", error);
      return undefined;
    }
  }

  // get stream function
  public async getStream(): Promise<any | undefined> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key,
      };
      console.log("S3File: getStream", params);
      const command = new GetObjectCommand(params);
      const data = await this._client.send(command);
      console.log("Success: S3File: getStream");
      return data.Body;
    } catch (error: any) {
      console.error("Error: S3File: getStream", error);
      return undefined;
    }
  }

  public async sha3_512(): Promise<string> {
    const stream = await this.getStream();
    const hash = createHash("SHA3-512");
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    return hash.digest("base64");
  }

  public async metadata(): Promise<
    | {
        size: number;
        mimeType: string;
      }
    | undefined
  > {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key,
      };
      console.log("S3File: metadata", params);
      const command = new HeadObjectCommand(params);
      const data = await this._client.send(command);
      console.log("Success: S3File: metadata", data);
      if (data && data.ContentType && data.ContentLength) {
        const mimeType: string = data.ContentType;
        const size: number = data.ContentLength;
        return { size, mimeType };
      } else return undefined;
    } catch (error: any) {
      console.log("Error: S3File: metadata", error);
      return undefined;
    }
  }

  public async head(): Promise<boolean> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key,
      };
      console.log("S3File: head", params);
      const command = new HeadObjectCommand(params);
      const data = await this._client.send(command);
      console.log("Success: S3File: head", data);
      return true;
    } catch (error: any) {
      console.log("Error: S3File: head", error);
      return false;
    }
  }

  // wait until file is ready with timeout if file is not ready after 10 seconds
  public async wait(timeoutSec: number = 10): Promise<void> {
    try {
      let finished = false;
      const start = Date.now();
      while (!finished) {
        console.log("Waiting for file", this.key);
        const head = await this.head();
        if (head) finished = true;
        else if (Date.now() - start > timeoutSec * 1000)
          throw new Error("Error: S3File: Timeout");
        else await sleep(500);
      }
    } catch (error: any) {
      console.error("Error: S3File: wait", error);
    }
  }

  public async remove(): Promise<void> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key,
      };
      //console.log("S3File: remove", params);
      const command = new DeleteObjectCommand(params);
      const data = await this._client.send(command);
      //console.log("Success: S3File: remove", data);
    } catch (error: any) {
      console.error("Error: S3File: remove", error);
    }
  }

  public async copy(bucket: string, key: string): Promise<void> {
    try {
      const params = {
        Bucket: bucket,
        CopySource: `${this.bucket}/${this.key}`,
        Key: key,
      };
      console.log("S3File: copy", params);
      const command = new CopyObjectCommand(params);
      const data = await this._client.send(command);
      console.log("Success: S3File: copy");
    } catch (error: any) {
      console.error("Error: S3File: copy", error);
    }
  }

  public async move(bucket: string, key: string): Promise<void> {
    try {
      await this.copy(bucket, key);
      await this.remove();
    } catch (error: any) {
      console.error("Error: S3File: move", error);
    }
  }

  public async upload(
    url: string,
    mimeType: string | undefined
  ): Promise<void> {
    try {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      const buffer = Buffer.from(response.data, "binary");
      await this.put(buffer, mimeType);
    } catch (error: any) {
      console.error("Error: S3File: upload", error);
    }
  }
}

export async function copyStringToS3(str: string): Promise<string> {
  try {
    console.log("copyJSONtoS3");
    const filename = Date.now().toString() + ".json";
    const file = new S3File(process.env.BUCKET!, filename);
    await file.put(str, "application/json");
    console.log("Saved", filename);
    await file.wait();
    console.log("file is ready:", filename);
    return filename;
  } catch (error: any) {
    console.error("Error: copyJSONtoS3", error);
    return "";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
