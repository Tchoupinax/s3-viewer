export type ObjectVersion = {
  etag: string | null;
  isDeleteMarker: boolean;
  isLatest: boolean;
  lastModified: string | null;
  size: number;
  versionId: string;
};

export type ObjectVersions = {
  key: string;
  status: string | null;
  versions: ObjectVersion[];
};
