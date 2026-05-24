import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";

import prettyBytes from "pretty-bytes";

const DELETE_BATCH = 1000;

export type ObjectDeletePreview = {
  kind: "file" | "folder";
  key: string;
  bucketName: string;
  objectCount: number;
  totalSizeBytes: number;
  totalSizeHuman: string;
  lastModified: string | null;
  sampleKeys: string[];
  listTruncatedForDisplay: boolean;
};

function normalizeFolderPrefix(key: string): string {
  return key.endsWith("/") ? key : `${key}/`;
}

export async function previewObjectDeletion(
  connection: S3Client,
  bucketName: string,
  key: string,
  isFolder: boolean,
): Promise<ObjectDeletePreview> {
  if (!key || key.includes("..")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid key",
    });
  }

  if (!isFolder) {
    const head = await connection
      .send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      )
      .catch(() => null);

    if (!head) {
      throw createError({
        statusCode: 404,
        statusMessage: "Object not found",
      });
    }

    const size = Number(head.ContentLength ?? 0);
    return {
      kind: "file",
      key,
      bucketName,
      objectCount: 1,
      totalSizeBytes: size,
      totalSizeHuman: prettyBytes(size),
      lastModified: head.LastModified?.toISOString() ?? null,
      sampleKeys: [key],
      listTruncatedForDisplay: false,
    };
  }

  const prefix = normalizeFolderPrefix(key);
  const keys: string[] = [];
  let totalSizeBytes = 0;
  let continuationToken: string | undefined;

  do {
    const resp = await connection.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    for (const obj of resp.Contents ?? []) {
      if (obj.Key) {
        keys.push(obj.Key);
        totalSizeBytes += obj.Size ?? 0;
      }
    }

    continuationToken = resp.IsTruncated
      ? (resp.NextContinuationToken ?? undefined)
      : undefined;
  } while (continuationToken);

  const headFolderKey = await connection
    .send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    )
    .catch(() => null);

  if (headFolderKey && !keys.includes(key)) {
    keys.push(key);
    totalSizeBytes += Number(headFolderKey.ContentLength ?? 0);
  }

  const sampleKeys = keys.slice(0, 40);
  const listTruncatedForDisplay = keys.length > 40;

  if (keys.length === 0 && !headFolderKey) {
    return {
      kind: "folder",
      key,
      bucketName,
      objectCount: 0,
      totalSizeBytes: 0,
      totalSizeHuman: prettyBytes(0),
      lastModified: null,
      sampleKeys: [],
      listTruncatedForDisplay: false,
    };
  }

  return {
    kind: "folder",
    key,
    bucketName,
    objectCount: keys.length,
    totalSizeBytes,
    totalSizeHuman: prettyBytes(totalSizeBytes),
    lastModified: null,
    sampleKeys,
    listTruncatedForDisplay,
  };
}

export async function executeObjectDeletion(
  connection: S3Client,
  bucketName: string,
  key: string,
  isFolder: boolean,
): Promise<{ deletedCount: number }> {
  if (!key || key.includes("..")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid key",
    });
  }

  if (!isFolder) {
    await connection.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
    return { deletedCount: 1 };
  }

  const prefix = normalizeFolderPrefix(key);
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const resp = await connection.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    for (const obj of resp.Contents ?? []) {
      if (obj.Key) {keys.push(obj.Key);}
    }

    continuationToken = resp.IsTruncated
      ? (resp.NextContinuationToken ?? undefined)
      : undefined;
  } while (continuationToken);

  const headFolderKey = await connection
    .send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    )
    .catch(() => null);

  if (headFolderKey && !keys.includes(key)) {
    keys.push(key);
  }

  if (keys.length === 0) {
    return { deletedCount: 0 };
  }

  for (let i = 0; i < keys.length; i += DELETE_BATCH) {
    const batch = keys.slice(i, i + DELETE_BATCH);
    await connection.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: batch.map(k => ({ Key: k })),
          Quiet: true,
        },
      }),
    );
  }

  return { deletedCount: keys.length };
}
