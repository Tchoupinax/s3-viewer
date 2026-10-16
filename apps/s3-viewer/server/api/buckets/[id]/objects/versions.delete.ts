import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import type { S3ViewerResponse } from "~/server/types/response";
import { readEventJsonBody } from "~/server/utils/event-query";
import { getConnections } from "~/server/utils/s3";
import {
  assertWriteAccess,
  rethrowWriteAccessError,
} from "~/server/utils/s3-permissions";

export default defineEventHandler(
  async (event): Promise<S3ViewerResponse<{ deleted: boolean }>> => {
    const bucketIdentityNumber = getRouterParam(event, "id") as BucketIdentityNumber;
    const body = await readEventJsonBody<{ key?: string; versionId?: string }>(event);
    const key = String(body.key ?? "").trim();
    const versionId = String(body.versionId ?? "").trim();

    if (!key || key.includes("..") || !versionId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid version",
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

    assertWriteAccess(connection);

    try {
      await connection.connection.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
          VersionId: versionId,
        }),
      );

      return {
        status: "OK",
        data: { deleted: true },
      };
    } catch (error) {
      rethrowWriteAccessError(error);
    }
  },
);
