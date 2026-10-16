import { HeadObjectCommand } from "@aws-sdk/client-s3";

import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import type { ObjectMetadata } from "~/server/types/object-metadata";
import type { S3ViewerResponse } from "~/server/types/response";
import { getEventQuery } from "~/server/utils/event-query";
import { getConnections } from "~/server/utils/s3";

export default defineEventHandler(
  async (event): Promise<S3ViewerResponse<ObjectMetadata>> => {
    const bucketIdentityNumber = getRouterParam(event, "id") as BucketIdentityNumber;
    const key = String(getEventQuery(event).key ?? "").trim();

    if (!key || key.includes("..")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid key",
      });
    }

    const { bucketName, accountId } = extractGenerateBucketIdentity(bucketIdentityNumber);
    const connection = getConnections().find(item => item.id === accountId);

    if (!connection || !bucketName) {
      throw createError({
        statusCode: 404,
        statusMessage: "Bucket not found",
      });
    }

    const head = await connection.connection.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );

    return {
      status: "OK",
      data: {
        key,
        contentType: head.ContentType ?? null,
        contentLength: head.ContentLength ?? 0,
        etag: head.ETag?.replaceAll("\"", "") ?? null,
        storageClass: head.StorageClass ?? null,
        lastModified: head.LastModified?.toISOString() ?? null,
        cacheControl: head.CacheControl ?? null,
        contentEncoding: head.ContentEncoding ?? null,
        metadata: head.Metadata ?? {},
      },
    };
  },
);
