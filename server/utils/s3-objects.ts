import {
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

import prettyBytes from "pretty-bytes";

const DELETE_BATCH = 1000;
const PROGRESS_DELETE_BATCH = 20;

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

export type BucketEmptyPreview = {
  bucketName: string;
  objectCount: number;
  totalSizeBytes: number;
  totalSizeHuman: string;
  sampleKeys: string[];
  listTruncatedForDisplay: boolean;
};

function normalizeFolderPrefix(key: string): string {
  return key.endsWith("/") ? key : `${key}/`;
}

type S3ObjectIdentifier = {
  Key: string;
  VersionId?: string;
};

export type DeleteProgressCallback = (
  deleted: number,
  total: number,
) => void;

async function deleteObjectIdentifiers(
  connection: S3Client,
  bucketName: string,
  objects: S3ObjectIdentifier[],
  onProgress?: DeleteProgressCallback,
): Promise<number> {
  if (objects.length === 0) {return 0;}

  let deletedCount = 0;
  const total = objects.length;
  const batchSize = onProgress ? PROGRESS_DELETE_BATCH : DELETE_BATCH;

  for (let i = 0; i < objects.length; i += batchSize) {
    const batch = objects.slice(i, i + batchSize);
    const response = await connection.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: batch.map(object => ({
            Key: object.Key,
            VersionId: object.VersionId,
          })),
          Quiet: true,
        },
      }),
    );

    if (response.Errors?.length) {
      const firstError = response.Errors[0]!;
      throw createError({
        statusCode: 502,
        statusMessage: `Failed to delete ${firstError.Key ?? "object"}: ${firstError.Code ?? "Error"}${firstError.Message ? ` — ${firstError.Message}` : ""}`,
      });
    }

    deletedCount += response.Deleted?.length ?? batch.length;
    onProgress?.(deletedCount, total);
  }

  return deletedCount;
}

async function listVersionedObjectPage(
  connection: S3Client,
  bucketName: string,
  prefix?: string,
): Promise<S3ObjectIdentifier[]> {
  const response = await connection.send(
    new ListObjectVersionsCommand({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: 1000,
    }),
  );

  const objects: S3ObjectIdentifier[] = [];

  for (const version of response.Versions ?? []) {
    if (version.Key) {
      objects.push({ Key: version.Key, VersionId: version.VersionId });
    }
  }

  for (const marker of response.DeleteMarkers ?? []) {
    if (marker.Key) {
      objects.push({ Key: marker.Key, VersionId: marker.VersionId });
    }
  }

  return objects;
}

async function countAllVersionedObjects(
  connection: S3Client,
  bucketName: string,
): Promise<{
  objectCount: number;
  totalSizeBytes: number;
  sampleKeys: string[];
}> {
  let objectCount = 0;
  let totalSizeBytes = 0;
  const sampleKeys: string[] = [];
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  do {
    const response = await connection.send(
      new ListObjectVersionsCommand({
        Bucket: bucketName,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
        MaxKeys: 1000,
      }),
    );

    for (const version of response.Versions ?? []) {
      objectCount++;
      totalSizeBytes += version.Size ?? 0;
      if (version.Key && sampleKeys.length < 40 && !sampleKeys.includes(version.Key)) {
        sampleKeys.push(version.Key);
      }
    }

    for (const marker of response.DeleteMarkers ?? []) {
      objectCount++;
      if (marker.Key && sampleKeys.length < 40 && !sampleKeys.includes(marker.Key)) {
        sampleKeys.push(marker.Key);
      }
    }

    if (!response.IsTruncated) {break;}

    keyMarker = response.NextKeyMarker;
    versionIdMarker = response.NextVersionIdMarker;
  } while (keyMarker || versionIdMarker);

  return { objectCount, totalSizeBytes, sampleKeys };
}

async function abortIncompleteMultipartUploads(
  connection: S3Client,
  bucketName: string,
): Promise<number> {
  let abortedCount = 0;
  let keyMarker: string | undefined;
  let uploadIdMarker: string | undefined;

  do {
    const response = await connection.send(
      new ListMultipartUploadsCommand({
        Bucket: bucketName,
        KeyMarker: keyMarker,
        UploadIdMarker: uploadIdMarker,
        MaxUploads: 1000,
      }),
    );

    for (const upload of response.Uploads ?? []) {
      if (!upload.Key || !upload.UploadId) {continue;}

      await connection.send(
        new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: upload.Key,
          UploadId: upload.UploadId,
        }),
      );
      abortedCount++;
    }

    if (!response.IsTruncated) {break;}

    keyMarker = response.NextKeyMarker;
    uploadIdMarker = response.NextUploadIdMarker;
  } while (keyMarker || uploadIdMarker);

  return abortedCount;
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
  onProgress?: DeleteProgressCallback,
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

  const deletedCount = await deleteObjectIdentifiers(
    connection,
    bucketName,
    keys.map(key => ({ Key: key })),
    onProgress,
  );

  return { deletedCount };
}

export async function previewBucketEmpty(
  connection: S3Client,
  bucketName: string,
): Promise<BucketEmptyPreview> {
  const versioned = await countAllVersionedObjects(connection, bucketName);

  if (versioned.objectCount > 0) {
    return {
      bucketName,
      objectCount: versioned.objectCount,
      totalSizeBytes: versioned.totalSizeBytes,
      totalSizeHuman: prettyBytes(versioned.totalSizeBytes),
      sampleKeys: versioned.sampleKeys,
      listTruncatedForDisplay: versioned.objectCount > 40,
    };
  }

  const keys: string[] = [];
  let totalSizeBytes = 0;
  let continuationToken: string | undefined;

  do {
    const resp = await connection.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
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

  return {
    bucketName,
    objectCount: keys.length,
    totalSizeBytes,
    totalSizeHuman: prettyBytes(totalSizeBytes),
    sampleKeys: keys.slice(0, 40),
    listTruncatedForDisplay: keys.length > 40,
  };
}

export async function executeBucketEmpty(
  connection: S3Client,
  bucketName: string,
  onProgress?: DeleteProgressCallback,
  estimatedTotal = 0,
): Promise<{ deletedCount: number }> {
  let deletedCount = 0;

  const deleteObjects = async (objects: S3ObjectIdentifier[]) => {
    if (objects.length === 0) {return;}

    const batchStart = deletedCount;
    deletedCount += await deleteObjectIdentifiers(
      connection,
      bucketName,
      objects,
      (deletedInBatch) => {
        onProgress?.(
          batchStart + deletedInBatch,
          estimatedTotal || batchStart + deletedInBatch,
        );
      },
    );
    onProgress?.(deletedCount, estimatedTotal || deletedCount);
  };

  while (true) {
    const objects = await listVersionedObjectPage(connection, bucketName);
    if (objects.length === 0) {break;}
    await deleteObjects(objects);
  }

  while (true) {
    const resp = await connection.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
      }),
    );

    const keys = (resp.Contents ?? [])
      .map(obj => obj.Key)
      .filter((k): k is string => Boolean(k));

    if (keys.length === 0) {break;}

    await deleteObjects(keys.map(key => ({ Key: key })));
  }

  deletedCount += await abortIncompleteMultipartUploads(connection, bucketName);
  onProgress?.(deletedCount, estimatedTotal || deletedCount);

  return { deletedCount };
}
