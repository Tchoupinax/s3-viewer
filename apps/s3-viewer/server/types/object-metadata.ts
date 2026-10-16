export type ObjectMetadata = {
  cacheControl: string | null;
  contentEncoding: string | null;
  contentLength: number;
  contentType: string | null;
  etag: string | null;
  key: string;
  lastModified: string | null;
  metadata: Record<string, string>;
  storageClass: string | null;
};
