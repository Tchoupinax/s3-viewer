import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import type { S3ViewerResponse } from "~/server/types/response";

import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import { connections } from "~/server/utils/s3";
import { previewObjectDeletion } from "~/server/utils/s3-objects";

export default defineEventHandler(
  async (
    event,
  ): Promise<S3ViewerResponse<Awaited<ReturnType<typeof previewObjectDeletion>>>> => {
    const bucketIdentityNumber = getRouterParam(
      event,
      "id",
    ) as BucketIdentityNumber;
    const query = getQuery(event);
    const key = String(query.key ?? "").trim();
    const isFolder
      = query.isFolder === "true"
        || query.isFolder === "1"
        || query.isFolder === true;

    const { bucketName, accountId }
      = extractGenerateBucketIdentity(bucketIdentityNumber);

    const connection = connections.find(c => c.id === accountId);

    if (!connection || !bucketName) {
      throw createError({
        statusCode: 404,
        statusMessage: "Bucket not found",
      });
    }

    const preview = await previewObjectDeletion(
      connection.connection,
      bucketName,
      key,
      isFolder,
    );

    return {
      status: "OK",
      data: preview,
    };
  },
);
