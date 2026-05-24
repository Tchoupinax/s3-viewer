import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import prettyBytes from "pretty-bytes";

import type { S3ViewerResponse } from "../../../types/response";
import type { BucketIdentityNumber } from "~/functions/bucket-identity-number";
import {
  extractGenerateBucketIdentity,
} from "~/functions/bucket-identity-number";
import type { S3ViewerDocument } from "~/server/types/document";
import type { FileNode } from "~/server/types/file-node";
import { buildFileTree } from "~/server/types/file-node";
import { connections } from "~/server/utils/s3";

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

    const pageSize = 1000;
    const cursor = query.cursor as string | undefined;

    const { bucketName, accountId } =
      extractGenerateBucketIdentity(bucketIdentityNumber);

    const connection = connections.find(
      connection => connection.id === accountId,
    );

    if (!connection || !bucketName) {
      throw createError({
        statusCode: 404,
        statusMessage: "Bucket not found",
      });
    }

    const objects: Array<{
      Key?: string;
      LastModified?: Date;
      Size?: number;
    }> = [];
    let continuationToken = cursor;
    let nextCursor: string | null = null;

    do {
      const response = await connection.connection.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          MaxKeys: pageSize,
          ContinuationToken: continuationToken,
        }),
      );

      if (response.Contents?.length) {
        objects.push(...response.Contents);
      }

      continuationToken = response.IsTruncated
        ? (response.NextContinuationToken ?? undefined)
        : undefined;
      nextCursor = response.IsTruncated
        ? (response.NextContinuationToken ?? null)
        : null;
    } while (continuationToken);

    const documents: Array<S3ViewerDocument> = objects.map(
      obj =>
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
        nextCursor,
      },
    };
  },
);
