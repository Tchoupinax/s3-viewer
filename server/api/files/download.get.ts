import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  BucketIdentityNumber,
  extractGenerateBucketIdentity,
} from "~/functions/bucket-identity-number";
import { store } from "~/server/api/repositories/in-memory-store";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const fullPath = decodeURIComponent(
    Buffer.from(query.file as string, "base64").toString("utf8"),
  );
  const { bucketName, accountId } = extractGenerateBucketIdentity(
    query.bucketIdentityNumber as BucketIdentityNumber,
  );

  if (!bucketName) {
    throw new Error("No bucket found");
  }

  const connection = connections.find(
    (connection) => connection.id === accountId,
  );

  const response = await connection?.connection.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: fullPath,
    }),
  );

  const byteArray = await response?.Body?.transformToByteArray();

  if (!byteArray) {
    throw new Error("Empty S3 object");
  }

  const base64Content = Buffer.from(byteArray).toString("base64");

  return {
    fileName: fullPath.split("/").pop(),
    type: fullPath.split(".").at(-1),
    content: base64Content,
  };
});
