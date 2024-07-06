import {
  KMS,
  EncryptCommandInput,
  EncryptCommand,
  DecryptCommandInput,
  DecryptCommand,
} from "@aws-sdk/client-kms";
import crypto from "crypto";

export async function encrypt(params: {
  data: string;
  context: string;
  keyId?: string;
  developer: string;
  repo: string;
  id: string;
}): Promise<string | undefined> {
  const { data, context, keyId, developer, repo, id } = params;
  try {
    const algorithm = "aes-256-cbc"; // Use AES 256-bit encryption
    const key = crypto.randomBytes(32); // Generate a random 32-byte key
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const client = new KMS({});
    const KeyId =
      keyId === undefined || keyId === ""
        ? process.env.AWS_KMS_ENCRYPTION_KEY_ID!
        : keyId;
    const params = {
      KeyId,
      Plaintext: key,
      EncryptionContext: { context, developer, repo, id },
    };
    const command = new EncryptCommand(params as EncryptCommandInput);
    const result = await client.send(command);
    //console.log("Success: KMS: encrypt", data);
    if (result === undefined || result.CiphertextBlob === undefined) {
      console.error("Error: EncryptCommand", result);
      return undefined;
    }
    return JSON.stringify({
      iv: iv.toString("hex"),
      key: Buffer.from(result.CiphertextBlob).toString("base64"),
      data: encrypted.toString("hex"),
    });
  } catch (error: any) {
    console.error(`Error: encrypt ${error}`);
    return undefined;
  }
}

export async function decrypt(params: {
  data: string;
  context: string;
  keyId?: string;
  developer: string;
  repo: string;
  id: string;
}): Promise<string | undefined> {
  const { data, context, keyId, developer, repo, id } = params;
  try {
    const encryptedData = JSON.parse(data);
    if (
      encryptedData === undefined ||
      encryptedData.key === undefined ||
      encryptedData.iv === undefined ||
      encryptedData.data === undefined
    ) {
      console.error("Error: decrypt: encryptedData has wrong format");
      return undefined;
    }
    const client = new KMS({});
    const KeyId =
      keyId === undefined || keyId === ""
        ? process.env.AWS_KMS_ENCRYPTION_KEY_ID!
        : keyId;
    const params = {
      KeyId,
      CiphertextBlob: Buffer.from(encryptedData.key, "base64"),
      EncryptionContext: { context, developer, repo, id },
    };
    const command = new DecryptCommand(params as DecryptCommandInput);
    const decryptedKey = await client.send(command);
    //console.log("Success: KMS: decrypt", data);
    if (decryptedKey === undefined || decryptedKey.Plaintext === undefined) {
      console.error("Error: DecryptCommand", decryptedKey);
      return undefined;
    }
    const key = Buffer.from(decryptedKey.Plaintext);

    if (key === undefined) throw Error("decryptJSON: key is undefined");
    let iv = Buffer.from(encryptedData.iv, "hex");
    let encryptedText = Buffer.from(encryptedData.data, "hex");
    let decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error: any) {
    console.error(`Error: decrypt ${error}`);
    return undefined;
  }
}
