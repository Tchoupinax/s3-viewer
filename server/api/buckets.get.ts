import { S3ViewerBucket } from "~/server/types/bucket";
import {
  Bucket,
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { match, P } from "ts-pattern";
import { connections } from "~/server/utils/s3";
import prettyBytes from "pretty-bytes";
import { groupByFn } from "~/server/utils/functions";
import { generateBucketIdentityNumber } from "../../functions/bucket-identity-number";

export default defineEventHandler(
  async (): Promise<
    S3ViewerResponse<{
      buckets: Array<S3ViewerBucket>;
      stats: {};
    }>
  > => {
    const commmands = await Promise.all(
      connections.map(async ({ connection, organizationOrAccountName, id }) => {
        let errorMessage: string | null = null;

        const buckets = await connection
          .send(new ListBucketsCommand({}))
          .then((c) => c.Buckets ?? [])
          .catch((error) => {
            errorMessage = error.message ?? null;
            return [];
          });

        return {
          buckets: buckets,
          region: await connection.config
            .region()
            .then((region) => region ?? null)
            .catch(() => null),
          cloudProviderName: await extractCloudProviderName(connection).catch(
            () => null,
          ),
          organizationOrAccountName,
          accountId: id,
          connection,
          errorMessage: errorMessage,
        };
      }),
    );

    const buckets = (
      await Promise.all(commmands.map(mapToS3ViewerBuckets))
    ).flat();

    const stats = totalSizeByKey(
      groupByFn(buckets, (b) => b.cloudProvider.name ?? ""),
    );

    return {
      status: "OK",
      data: {
        buckets,
        stats: Object.keys(stats).map((key) => ({
          cloudProvider: {
            name: key || null,
            logoUrl: getCloudProviderLogoUrl(key),
          },
          size: stats[key],
          sizeHuman: stats[key] ? prettyBytes(stats[key]) : "0",
        })),
      },
    };
  },
);

function totalSizeByKey(
  bucketsByKey: Record<string, S3ViewerBucket[]>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(bucketsByKey).map(([key, buckets]) => [
      key,
      buckets.reduce((sum, b) => sum + b.size, 0),
    ]),
  );
}

export async function mapToS3ViewerBuckets({
  buckets,
  region,
  cloudProviderName,
  organizationOrAccountName,
  accountId,
  connection,
  errorMessage,
}: {
  buckets: Array<Bucket>;
  region: string | null;
  cloudProviderName: string | null;
  organizationOrAccountName: string;
  accountId: string;
  connection: S3Client;
  errorMessage: string | null;
}): Promise<Array<S3ViewerBucket>> {
  async function mapToS3ViewerBucket(bucket: Bucket): Promise<S3ViewerBucket> {
    const bucketSize =
      errorMessage === null
        ? await getBucketSize(connection, bucket.Name ?? "")
        : 0;

    return {
      id: generateBucketIdentityNumber({
        accountId,
        bucketName: bucket.Name ?? "_",
        region: region ?? "_",
      }),
      name: bucket.Name ?? "_",
      cloudProvider: {
        name: cloudProviderName || null,
        logoUrl: getCloudProviderLogoUrl(cloudProviderName),
      },
      region: region,
      createdAt: bucket.CreationDate ?? null,
      organizationOrAccountName,
      accountId,
      size: bucketSize,
      sizeHuman: prettyBytes(bucketSize),
      errorMessage,
    };
  }

  if (buckets.length === 0 && errorMessage !== null) {
    return [
      {
        id: generateBucketIdentityNumber({
          accountId,
          bucketName: null,
          region: region ?? "_",
        }),
        errorMessage,
        organizationOrAccountName,
        cloudProvider: {
          name: cloudProviderName || null,
          logoUrl: getCloudProviderLogoUrl(cloudProviderName),
        },
        accountId,
        region,
        name: "This",
        size: 0,
        sizeHuman: "0",
        createdAt: null,
      },
    ];
  }

  return Promise.all(buckets.map(mapToS3ViewerBucket));
}

export async function extractCloudProviderName(
  connection: S3Client,
): Promise<string | null> {
  return match(connection.config.endpoint)
    .with(P.nonNullable, async (endpoint) => {
      return match((await endpoint()).hostname)
        .with("s3.fr-par.scw.cloud", () => "Scaleway")
        .with("s3.eu-west-3.amazonaws.com", () => "AWS")
        .otherwise(() => {
          return "Garage";
        });
    })
    .otherwise(() => "AWS");
}

async function getBucketSize(
  connection: S3Client,
  bucketName: string,
): Promise<number> {
  let totalSize = 0;
  let continuationToken: string | undefined;

  try {
    do {
      const res = await connection.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
        }),
      );

      if (res.Contents) {
        for (const object of res.Contents) {
          totalSize += object.Size ?? 0;
        }
      }

      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    return totalSize;
  } catch (err) {
    return 0;
  }
}

function getCloudProviderLogoUrl(cloudProviderName: string | null) {
  return match(cloudProviderName)
    .with(
      "Scaleway",
      () =>
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRqN9RIEUF8A45dNLGl3nbRgbvIUOhNOQOyfQ&s",
    )
    .with(
      "AWS",
      () =>
        "https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg",
    )
    .with(
      "Garage",
      () =>
        "data:image/png;base64,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",
    )
    .otherwise(() => "");
}
