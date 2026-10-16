import {
  GetBucketVersioningCommand,
  ListObjectVersionsCommand,
} from "@aws-sdk/client-s3";

import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import type { ObjectVersion, ObjectVersions } from "~/server/types/object-version";
import type { S3ViewerResponse } from "~/server/types/response";
import { getEventQuery } from "~/server/utils/event-query";
import { getConnections } from "~/server/utils/s3";

export default defineEventHandler(
  async (event): Promise<S3ViewerResponse<ObjectVersions>> => {
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

    const versioning = await connection.connection.send(
      new GetBucketVersioningCommand({ Bucket: bucketName }),
    );

    const versions: ObjectVersion[] = [];
    let keyMarker: string | undefined;
    let versionIdMarker: string | undefined;

    do {
      const response = await connection.connection.send(
        new ListObjectVersionsCommand({
          Bucket: bucketName,
          Prefix: key,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
          MaxKeys: 1000,
        }),
      );

      for (const version of response.Versions ?? []) {
        if (version.Key !== key || !version.VersionId) {continue;}
        versions.push({
          versionId: version.VersionId,
          isLatest: Boolean(version.IsLatest),
          isDeleteMarker: false,
          lastModified: version.LastModified?.toISOString() ?? null,
          size: version.Size ?? 0,
          etag: version.ETag?.replaceAll("\"", "") ?? null,
        });
      }

      for (const marker of response.DeleteMarkers ?? []) {
        if (marker.Key !== key || !marker.VersionId) {continue;}
        versions.push({
          versionId: marker.VersionId,
          isLatest: Boolean(marker.IsLatest),
          isDeleteMarker: true,
          lastModified: marker.LastModified?.toISOString() ?? null,
          size: 0,
          etag: null,
        });
      }

      if (!response.IsTruncated) {break;}
      keyMarker = response.NextKeyMarker;
      versionIdMarker = response.NextVersionIdMarker;
    } while (keyMarker || versionIdMarker);

    versions.sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""));

    return {
      status: "OK",
      data: {
        key,
        status: versioning.Status ?? null,
        versions,
      },
    };
  },
);
