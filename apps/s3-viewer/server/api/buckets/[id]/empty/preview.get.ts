import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import type { S3ViewerResponse } from "~/server/types/response";
import { getConnections } from "~/server/utils/s3";
import { previewBucketEmpty } from "~/server/utils/s3-objects";

export default defineEventHandler(
  async (
    event,
  ): Promise<S3ViewerResponse<Awaited<ReturnType<typeof previewBucketEmpty>>>> => {
    const bucketIdentityNumber = getRouterParam(
      event,
      "id",
    ) as BucketIdentityNumber;

    const { bucketName, accountId } =
      extractGenerateBucketIdentity(bucketIdentityNumber);

    const connection = getConnections().find(c => c.id === accountId);

    if (!connection || !bucketName) {
      throw createError({
        statusCode: 404,
        statusMessage: "Bucket not found",
      });
    }

    const preview = await previewBucketEmpty(
      connection.connection,
      bucketName,
    );

    return {
      status: "OK",
      data: preview,
    };
  },
);
