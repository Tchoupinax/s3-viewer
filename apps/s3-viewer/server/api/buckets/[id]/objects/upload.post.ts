import { PutObjectCommand } from "@aws-sdk/client-s3";
import { readMultipartFormData } from "h3";

import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import type { S3ViewerResponse } from "~/server/types/response";
import { getConnections } from "~/server/utils/s3";
import {
  assertWriteAccess,
  rethrowWriteAccessError,
} from "~/server/utils/s3-permissions";

function buildObjectKey(prefix: string, relativePath: string): string {
  const segments = `${prefix}/${relativePath}`
    .split("/")
    .map(segment => segment.trim())
    .filter(segment => segment && segment !== "." && segment !== "<root>");

  if (!segments.length || segments.some(segment => segment === "..")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid object key",
    });
  }

  return segments.join("/");
}

export default defineEventHandler(
  async (
    event,
  ): Promise<S3ViewerResponse<{ key: string }>> => {
    const bucketIdentityNumber = getRouterParam(
      event,
      "id",
    ) as BucketIdentityNumber;
    const { bucketName, accountId } =
      extractGenerateBucketIdentity(bucketIdentityNumber);
    const connection = getConnections().find(c => c.id === accountId);

    if (!connection || !bucketName) {
      throw createError({
        statusCode: 404,
        statusMessage: "Bucket not found",
      });
    }

    assertWriteAccess(connection);

    const parts = await readMultipartFormData(event);
    const prefix = parts?.find(part => part.name === "prefix")?.data.toString("utf8") ?? "";
    const relativePath = parts?.find(part => part.name === "relativePath")?.data.toString("utf8") ?? "";
    const file = parts?.find(part => part.name === "file" && part.filename);

    if (!file?.data?.length) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing file",
      });
    }

    const key = buildObjectKey(prefix, relativePath || file.filename || "upload");

    try {
      await connection.connection.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.data,
          ContentType: file.type || "application/octet-stream",
        }),
      );

      return {
        status: "OK",
        data: { key },
      };
    } catch (error) {
      rethrowWriteAccessError(error);
    }
  },
);
