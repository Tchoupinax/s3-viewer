import {
  CopyObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";

import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import type { S3ViewerResponse } from "~/server/types/response";
import { readEventJsonBody } from "~/server/utils/event-query";
import { getConnections } from "~/server/utils/s3";
import { executeObjectDeletion } from "~/server/utils/s3-objects";
import {
  assertWriteAccess,
  rethrowWriteAccessError,
} from "~/server/utils/s3-permissions";

function assertObjectKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid key",
    });
  }
}

async function listKeys(client: S3Client, bucketName: string, prefix: string) {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (object.Key) {keys.push(object.Key);}
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

export default defineEventHandler(
  async (
    event,
  ): Promise<S3ViewerResponse<{ copiedCount: number; moved: boolean }>> => {
    const bucketIdentityNumber = getRouterParam(event, "id") as BucketIdentityNumber;
    const body = await readEventJsonBody<{
      sourceKey?: string;
      isFolder?: boolean;
      destinationBucketId?: string;
      destinationKey?: string;
      move?: boolean;
    }>(event);

    const sourceKey = String(body.sourceKey ?? "").trim();
    const destinationKey = String(body.destinationKey ?? "").trim();
    const isFolder = Boolean(body.isFolder);
    const move = Boolean(body.move);
    assertObjectKey(sourceKey);
    assertObjectKey(destinationKey);

    const source = extractGenerateBucketIdentity(bucketIdentityNumber);
    const destination = extractGenerateBucketIdentity(
      String(body.destinationBucketId ?? "") as BucketIdentityNumber,
    );
    const connection = getConnections().find(item => item.id === source.accountId);

    if (!connection || !source.bucketName || !destination.bucketName) {
      throw createError({
        statusCode: 404,
        statusMessage: "Bucket not found",
      });
    }

    if (destination.accountId !== source.accountId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Copy stays on the same account",
      });
    }

    if (
      source.bucketName === destination.bucketName &&
      sourceKey === destinationKey
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "Choose a different destination",
      });
    }

    assertWriteAccess(connection);

    try {
      const copies: Array<{ from: string; to: string }> = [];

      if (isFolder) {
        const sourcePrefix = sourceKey.endsWith("/") ? sourceKey : `${sourceKey}/`;
        const destinationPrefix = destinationKey.endsWith("/")
          ? destinationKey
          : `${destinationKey}/`;
        const keys = await listKeys(connection.connection, source.bucketName, sourcePrefix);

        for (const key of keys) {
          copies.push({
            from: key,
            to: `${destinationPrefix}${key.slice(sourcePrefix.length)}`,
          });
        }
      } else {
        copies.push({ from: sourceKey, to: destinationKey });
      }

      for (const copy of copies) {
        await connection.connection.send(
          new CopyObjectCommand({
            Bucket: destination.bucketName,
            Key: copy.to,
            CopySource: encodeURI(`${source.bucketName}/${copy.from}`),
          }),
        );
      }

      if (move) {
        await executeObjectDeletion(
          connection.connection,
          source.bucketName,
          sourceKey,
          isFolder,
        );
      }

      return {
        status: "OK",
        data: {
          copiedCount: copies.length,
          moved: move,
        },
      };
    } catch (error) {
      rethrowWriteAccessError(error);
    }
  },
);
