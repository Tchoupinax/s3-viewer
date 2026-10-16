import {
  AbortMultipartUploadCommand,
  ListMultipartUploadsCommand,
} from "@aws-sdk/client-s3";

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
  async (event): Promise<S3ViewerResponse<{ abortedCount: number }>> => {
    const bucketIdentityNumber = getRouterParam(event, "id") as BucketIdentityNumber;
    const body = await readEventJsonBody<{
      all?: boolean;
      key?: string;
      uploadId?: string;
    }>(event);
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
      const targets: Array<{ key: string; uploadId: string }> = [];

      if (body.all) {
        let keyMarker: string | undefined;
        let uploadIdMarker: string | undefined;
        do {
          const response = await connection.connection.send(
            new ListMultipartUploadsCommand({
              Bucket: bucketName,
              KeyMarker: keyMarker,
              UploadIdMarker: uploadIdMarker,
              MaxUploads: 1000,
            }),
          );
          for (const upload of response.Uploads ?? []) {
            if (upload.Key && upload.UploadId) {
              targets.push({ key: upload.Key, uploadId: upload.UploadId });
            }
          }
          if (!response.IsTruncated) {break;}
          keyMarker = response.NextKeyMarker;
          uploadIdMarker = response.NextUploadIdMarker;
        } while (keyMarker || uploadIdMarker);
      } else if (body.key && body.uploadId) {
        targets.push({ key: body.key, uploadId: body.uploadId });
      } else {
        throw createError({
          statusCode: 400,
          statusMessage: "Missing upload",
        });
      }

      for (const target of targets) {
        await connection.connection.send(
          new AbortMultipartUploadCommand({
            Bucket: bucketName,
            Key: target.key,
            UploadId: target.uploadId,
          }),
        );
      }

      return {
        status: "OK",
        data: { abortedCount: targets.length },
      };
    } catch (error) {
      rethrowWriteAccessError(error);
    }
  },
);
