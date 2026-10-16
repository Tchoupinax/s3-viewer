import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import type { S3ViewerResponse } from "~/server/types/response";
import { getEventQuery } from "~/server/utils/event-query";
import { getConnections } from "~/server/utils/s3";

const DEFAULT_EXPIRES_SECONDS = 15 * 60;
const MAX_EXPIRES_SECONDS = 24 * 60 * 60;

export default defineEventHandler(
  async (
    event,
  ): Promise<S3ViewerResponse<{ url: string; expiresIn: number }>> => {
    const bucketIdentityNumber = getRouterParam(event, "id") as BucketIdentityNumber;
    const query = getEventQuery(event);
    const key = String(query.key ?? "").trim();
    const requested = Number(query.expiresIn ?? DEFAULT_EXPIRES_SECONDS);
    const expiresIn = Number.isFinite(requested)
      ? Math.min(Math.max(Math.floor(requested), 60), MAX_EXPIRES_SECONDS)
      : DEFAULT_EXPIRES_SECONDS;

    if (!key || key.includes("..") || key.endsWith("/")) {
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

    const url = await getSignedUrl(
      connection.connection,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
      { expiresIn },
    );

    return {
      status: "OK",
      data: { url, expiresIn },
    };
  },
);
