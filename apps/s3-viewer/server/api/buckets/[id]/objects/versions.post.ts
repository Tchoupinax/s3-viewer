import { CopyObjectCommand } from "@aws-sdk/client-s3";

import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import type { S3ViewerResponse } from "~/server/types/response";
import { readEventJsonBody } from "~/server/utils/event-query";
import { getConnections } from "~/server/utils/s3";
import {
  assertWriteAccess,
  rethrowWriteAccessError,
} from "~/server/utils/s3-permissions";

function assertKey(key: string) {
  if (!key || key.includes("..")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid key",
    });
  }
}

export default defineEventHandler(
  async (event): Promise<S3ViewerResponse<{ restored: boolean }>> => {
    const bucketIdentityNumber = getRouterParam(event, "id") as BucketIdentityNumber;
    const body = await readEventJsonBody<{ key?: string; versionId?: string }>(event);
    const key = String(body.key ?? "").trim();
    const versionId = String(body.versionId ?? "").trim();
    assertKey(key);

    if (!versionId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing version",
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
        new CopyObjectCommand({
          Bucket: bucketName,
          Key: key,
          CopySource: `${encodeURI(`${bucketName}/${key}`)}?versionId=${encodeURIComponent(versionId)}`,
        }),
      );

      return {
        status: "OK",
        data: { restored: true },
      };
    } catch (error) {
      rethrowWriteAccessError(error);
    }
  },
);
