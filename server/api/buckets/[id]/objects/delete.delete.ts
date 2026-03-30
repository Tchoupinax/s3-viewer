import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import type { S3ViewerResponse } from "~/server/types/response";

import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import { connections } from "~/server/utils/s3";
import { executeObjectDeletion } from "~/server/utils/s3-objects";

export default defineEventHandler(
  async (
    event,
  ): Promise<S3ViewerResponse<{ deletedCount: number }>> => {
    const bucketIdentityNumber = getRouterParam(
      event,
      "id",
    ) as BucketIdentityNumber;
    const body = await readBody<{
      key?: string;
      isFolder?: boolean;
    }>(event);

    const key = String(body?.key ?? "").trim();
    const isFolder = Boolean(body?.isFolder);

    const { bucketName, accountId }
      = extractGenerateBucketIdentity(bucketIdentityNumber);

    const connection = connections.find(c => c.id === accountId);

    if (!connection || !bucketName) {
      throw createError({
        statusCode: 404,
        statusMessage: "Bucket not found",
      });
    }

    const result = await executeObjectDeletion(
      connection.connection,
      bucketName,
      key,
      isFolder,
    );

    return {
      status: "OK",
      data: result,
    };
  },
);
