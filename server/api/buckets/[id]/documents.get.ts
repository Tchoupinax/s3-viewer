import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { connections } from "~/server/utils/s3";
import prettyBytes from "pretty-bytes";
import { S3ViewerDocument } from "~/server/types/document";
import { buildFileTree, FileNode } from "~/server/types/file-node";
import {
  BucketIdentityNumber,
  extractGenerateBucketIdentity,
} from "~/functions/bucket-identity-number";

export default defineEventHandler(
  async (
    event,
  ): Promise<
    S3ViewerResponse<{
      files: Array<FileNode>;
      filesCount: number;
      nextCursor: string | null;
    }>
  > => {
    const bucketIdentityNumber = getRouterParam(
      event,
      "id",
    ) as BucketIdentityNumber;
    const query = getQuery(event);

    const limit = 3000;
    const cursor = query.cursor as string | undefined;

    const { bucketName, accountId } =
      extractGenerateBucketIdentity(bucketIdentityNumber);

    const connection = connections.find(
      (connection) => connection.id === accountId,
    );

    if (!connection || !bucketName) {
      throw createError({
        statusCode: 404,
        statusMessage: "Bucket not found",
      });
    }

    const response = await connection?.connection.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: limit,
        ContinuationToken: cursor,
      }),
    );

    const documents: Array<S3ViewerDocument> = (response?.Contents || []).map(
      (obj) =>
        ({
          name: obj.Key ?? "",
          size: obj.Size ?? 0,
          sizeHuman: prettyBytes(obj.Size ?? 0),
          lastModified: obj.LastModified ?? null,
        }) satisfies S3ViewerDocument,
    );

    return {
      status: "OK",
      data: {
        files: buildFileTree(documents),
        filesCount: documents.length,
        nextCursor: response?.IsTruncated
          ? (response.NextContinuationToken ?? null)
          : null,
      },
    };
  },
);
