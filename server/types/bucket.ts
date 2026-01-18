export type S3ViewerBucket = {
  accountId: string;
  cloudProvider: CloudProvider;
  createdAt: Date | null;
  id: string;
  name: string;
  organizationOrAccountName: string;
  region: string | null;
  size: number;
  sizeHuman: string;
};

type CloudProvider = {
  logoUrl: string;
  name: string | null;
};
