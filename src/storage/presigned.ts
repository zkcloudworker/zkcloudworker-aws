import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const { BUCKET } = process.env;

export async function getPresignedUrl(params: {
  developer: string;
  repo: string;
}): Promise<string> {
  const { developer, repo } = params;
  const options = { forcePathStyle: true };
  const client = new S3Client(options);
  const s3params = {
    Bucket: BUCKET,
    Key: developer + "/" + repo + ".zip",
    ContentType: "application/zip",
  };
  const command = new PutObjectCommand(s3params);
  const url = await getSignedUrl(client, command, { expiresIn: 60 * 10 }); // 10 minutes
  return url;
}
