import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import { getEventQuery } from "~/server/utils/event-query";
import {
  streamProgressResponse,
  writeAccessDeniedError,
  writeHandlerError,
} from "~/server/utils/progress-stream";
import { getConnections } from "~/server/utils/s3";
import { executeObjectDeletion } from "~/server/utils/s3-objects";
import {
  assertWriteAccess,
  isS3AccessDeniedError,
} from "~/server/utils/s3-permissions";

export default defineEventHandler(async event => {
  const bucketIdentityNumber = getRouterParam(
    event,
    "id",
  ) as BucketIdentityNumber;
  const query = getEventQuery(event);
  const key = String(query.key ?? "").trim();
  const isFolder =
    query.isFolder === "true" ||
    query.isFolder === "1" ||
    query.isFolder === true;
  const estimatedTotal = Number.parseInt(String(query.total ?? "0"), 10) || 0;

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

  return streamProgressResponse(
    event,
    isFolder ? estimatedTotal : 1,
    async writer => {
      try {
        const result = await executeObjectDeletion(
          connection.connection,
          bucketName,
          key,
          isFolder,
          (deleted, total) => {
            writer.progress(deleted, total);
          },
        );

        writer.complete(result.deletedCount);
      } catch (error) {
        if (isS3AccessDeniedError(error)) {
          writeAccessDeniedError(writer);
          return;
        }

        writeHandlerError(writer, error);
      }
    },
  );
});
