import { S3ViewerBucket } from "~/server/types/bucket";

export interface StoreGateway {
  getBuckets(): Array<S3ViewerBucket>;
  persistBuckets(buckets: Array<S3ViewerBucket>): void;
}
