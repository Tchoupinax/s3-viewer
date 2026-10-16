import { ListMultipartUploadsCommand } from "@aws-sdk/client-s3";

import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import { extractGenerateBucketIdentity } from "~/functions/bucket-identity-number";
import type { S3ViewerResponse } from "~/server/types/response";
import { getConnections } from "~/server/utils/s3";

export type IncompleteUpload = {
  initiated: string | null;
  key: string;
  uploadId: string;
};

export default defineEventHandler(
  async (event): Promise<S3ViewerResponse<{ uploads: IncompleteUpload[] }>> => {
    const bucketIdentityNumber = getRouterParam(event, "id") as BucketIdentityNumber;
    const { bucketName, accountId } = extractGenerateBucketIdentity(bucketIdentityNumber);
    const connection = getConnections().find(item => item.id === accountId);

    if (!connection || !bucketName) {
      throw createError({
        statusCode: 404,
        statusMessage: "Bucket not found",
      });
    }

    const uploads: IncompleteUpload[] = [];
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
        if (!upload.Key || !upload.UploadId) {continue;}
        uploads.push({
          key: upload.Key,
          uploadId: upload.UploadId,
          initiated: upload.Initiated?.toISOString() ?? null,
        });
      }

      if (!response.IsTruncated) {break;}
      keyMarker = response.NextKeyMarker;
      uploadIdMarker = response.NextUploadIdMarker;
    } while (keyMarker || uploadIdMarker);

    return {
      status: "OK",
      data: { uploads },
    };
  },
);
