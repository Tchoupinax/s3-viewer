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
  filesCount: number;
  errorMessage: string | null;
};

export const defaultS3ViewerBucketToBucket = (): S3ViewerBucket => ({
  accountId: "",
  cloudProvider: {
    logoUrl: "",
    name: null,
  },
  createdAt: null,
  id: "",
  name: "", 
  organizationOrAccountName: "",
  region: null,
  size: 0,
  sizeHuman: "0 B",
  filesCount: 0,
  errorMessage: null,
});

type CloudProvider = {
  logoUrl: string;
  name: string | null;
};
