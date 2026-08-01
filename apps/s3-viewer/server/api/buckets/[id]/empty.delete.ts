import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import type { S3ViewerResponse } from "~/server/types/response";
import { getConnections } from "~/server/utils/s3";
import { executeBucketEmpty } from "~/server/utils/s3-objects";
import {
  assertWriteAccess,
  rethrowWriteAccessError,
} from "~/server/utils/s3-permissions";

export default defineEventHandler(
  async (
    event,
  ): Promise<S3ViewerResponse<{ deletedCount: number }>> => {
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

    assertWriteAccess(connection);

    try {
      const result = await executeBucketEmpty(
        connection.connection,
        bucketName,
      );

      return {
        status: "OK",
        data: result,
      };
    } catch (error) {
      rethrowWriteAccessError(error);
    }
  },
);
