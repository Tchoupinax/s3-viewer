import { S3Client } from "@aws-sdk/client-s3";
import { Account } from "~/server/types/account";

const REQUIRED_FIELDS = [
  "ACCESS_KEY",
  "ENDPOINT",
  "ID",
  "NAME",
  "REGION",
  "SECRET_KEY",
] as const;

type RawAccount = {
  ACCESS_KEY: string;
  ENDPOINT: string;
  ID: string;
  NAME: string;
  REGION: string;
  SECRET_KEY: string;
};

export function loadS3AccountsFromEnv(): Array<Account> {
  const rawAccounts: Record<string, RawAccount> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("S3_VIEWER_ACCOUNT_") || !value) continue;

    // S3_<ACCOUNT>_<FIELD>
    const match = key.match(/^S3_VIEWER_ACCOUNT_([^_]+)_(.+)$/);
    if (!match) {
      continue;
    }

    const [, accountName, field] = match;

    rawAccounts[accountName] ??= {};
    rawAccounts[accountName][field as keyof RawAccount] = value;
  }

  return Object.entries(rawAccounts).map(([accountKey, raw]) => {
    for (const field of REQUIRED_FIELDS) {
      if (!raw[field]) {
        throw new Error(
          `Missing env var: S3_VIEWER_ACCOUNT_${accountKey}_${field}`,
        );
      }
    }

    return {
      id: raw.ID,
      organizationOrAccountName: raw.NAME,
      connection: new S3Client({
        endpoint: raw.ENDPOINT,
        region: raw.REGION,
        forcePathStyle: true,
        credentials: {
          accessKeyId: raw.ACCESS_KEY,
          secretAccessKey: raw.SECRET_KEY,
        },
      }),
      mappedBuckets: null,
    };
  });
}

loadS3AccountsFromEnv();

export const connections = loadS3AccountsFromEnv();
