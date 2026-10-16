import {
  GetObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";

import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import { readEventJsonBody } from "~/server/utils/event-query";
import { getConnections } from "~/server/utils/s3";
import { buildStoredZip } from "~/server/utils/zip-store";

type ArchiveEntry = {
  isFolder?: boolean;
  key?: string;
};

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
      if (object.Key && !object.Key.endsWith("/")) {keys.push(object.Key);}
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

export default defineEventHandler(async event => {
  const bucketIdentityNumber = getRouterParam(event, "id") as BucketIdentityNumber;
  const body = await readEventJsonBody<{ entries?: ArchiveEntry[] }>(event);
  const { bucketName, accountId } = extractGenerateBucketIdentity(bucketIdentityNumber);
  const connection = getConnections().find(item => item.id === accountId);

  if (!connection || !bucketName) {
    throw createError({
      statusCode: 404,
      statusMessage: "Bucket not found",
    });
  }

  const requested = body.entries ?? [];
  if (!requested.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose at least one object",
    });
  }

  const keys = new Set<string>();
  for (const entry of requested) {
    const key = String(entry.key ?? "").trim();
    if (!key || key.includes("..")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid key",
      });
    }

    if (entry.isFolder) {
      const prefix = key.endsWith("/") ? key : `${key}/`;
      for (const child of await listKeys(connection.connection, bucketName, prefix)) {
        keys.add(child);
      }
    } else {
      keys.add(key);
    }
  }

  const files: Array<{ name: string; data: Buffer }> = [];
  for (const key of keys) {
    const response = await connection.connection.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
    const bytes = await response.Body?.transformToByteArray();
    files.push({
      name: key,
      data: Buffer.from(bytes ?? new Uint8Array()),
    });
  }

  const zip = buildStoredZip(files);
  setHeader(event, "Content-Type", "application/zip");
  setHeader(event, "Content-Disposition", "attachment; filename=\"objects.zip\"");
  return zip;
});
