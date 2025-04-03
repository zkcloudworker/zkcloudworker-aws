import * as crypto from "crypto";

interface EncryptionInput {
  text: string;
  publicKey: string;
}

interface DecryptionInput {
  encryptedData: string;
  privateKey: string;
}

interface EncryptedData {
  encryptedContent: string; // Base64 encoded AES-encrypted content
  authTag: string; // Base64 encoded authentication tag
  encryptedKey: string; // Base64 encoded RSA-encrypted AES key
  iv: string; // Base64 encoded initialization vector
}

/**
 * Generates a new RSA key pair
 * @returns An object containing the private and public keys in PEM format
 */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey: pemPrivateKey, publicKey: pemPublicKey } =
    crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

  // Extract just the base64 content from the PEM format
  const privateKey = pemPrivateKey
    .replace("-----BEGIN PRIVATE KEY-----\n", "")
    .replace("\n-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  const publicKey = pemPublicKey
    .replace("-----BEGIN PUBLIC KEY-----\n", "")
    .replace("\n-----END PUBLIC KEY-----", "")
    .replace(/\n/g, "");

  return { privateKey, publicKey };
}

/**
 * Encrypts text using a hybrid RSA-AES scheme
 * Uses AES-256-GCM for content encryption and RSA for key encryption
 */
export function encryptWithPublicKey({
  text,
  publicKey,
}: EncryptionInput): string {
  // Generate a random AES-256 key and IV
  const aesKey = crypto.randomBytes(32); // 256 bits
  const iv = crypto.randomBytes(16); // 128 bits

  // Create PEM formatted public key
  const pemPublicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

  // Encrypt the AES key with RSA
  const encryptedKey = crypto.publicEncrypt(
    {
      key: pemPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    aesKey
  );

  // Encrypt the actual content with AES-256-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  let encryptedContent = cipher.update(text, "utf8", "base64");
  encryptedContent += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  // Combine all the encrypted data
  const encryptedData: EncryptedData = {
    encryptedContent: encryptedContent,
    authTag: authTag.toString("base64"),
    encryptedKey: encryptedKey.toString("base64"),
    iv: iv.toString("base64"),
  };

  // Return JSON string of encrypted data
  return JSON.stringify(encryptedData);
}

/**
 * Decrypts text that was encrypted using encryptWithPublicKey
 * Requires the corresponding private key to the public key used for encryption
 */
export function decryptWithPrivateKey({
  encryptedData,
  privateKey,
}: DecryptionInput): string {
  try {
    // Parse the encrypted data
    const parsedData: EncryptedData = JSON.parse(encryptedData);

    // Create PEM formatted private key
    const pemPrivateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;

    // Decrypt the AES key using RSA
    const aesKey = crypto.privateDecrypt(
      {
        key: pemPrivateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(parsedData.encryptedKey, "base64")
    );

    // Decrypt the content using AES-256-GCM
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      aesKey,
      Buffer.from(parsedData.iv, "base64")
    );

    decipher.setAuthTag(Buffer.from(parsedData.authTag, "base64"));

    let decrypted = decipher.update(
      parsedData.encryptedContent,
      "base64",
      "utf8"
    );
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Validates that a string is a valid PEM formatted key
 */
export function isValidPEMKey(
  key: string,
  type: "public" | "private"
): boolean {
  try {
    const header = type === "public" ? "PUBLIC" : "PRIVATE";
    const pemKey = `-----BEGIN ${header} KEY-----\n${key}\n-----END ${header} KEY-----`;

    // Attempt to create a key object - this will throw if invalid
    crypto.createPublicKey(pemKey);
    return true;
  } catch {
    return false;
  }
}
