import { StoreGateway } from "~/server/api/gateway/store";
import { S3ViewerBucket } from "~/server/types/bucket";

class InMemoryStoreGateway implements StoreGateway {
  private buckets: Array<S3ViewerBucket> = [];

  getBuckets(): Array<S3ViewerBucket> {
    return this.buckets;
  }

  persistBuckets(buckets: Array<S3ViewerBucket>): void {
    this.buckets.push(...buckets);
  }
}

export const store = new InMemoryStoreGateway();
