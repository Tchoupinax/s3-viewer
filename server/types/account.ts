import type { S3Client } from "@aws-sdk/client-s3";

import type { S3ViewerBucket } from "~/server/types/bucket";

export type Account = {
  connection: S3Client;
  id: string;
  mappedBuckets: Array<S3ViewerBucket> | null;
  organizationOrAccountName: string;
  readOnly: boolean;
};
