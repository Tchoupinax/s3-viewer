import { S3Client } from "@aws-sdk/client-s3";
import { existsSync, watch } from "node:fs";
import { clearTimeout, setInterval, setTimeout } from "node:timers";

import type { Account } from "~/server/types/account";
import {
  ACCOUNT_ENV_PREFIX,
  fingerprintAccountEnv,
  loadS3ViewerAccountEnv,
  S3_VIEWER_ACCOUNTS_DIR,
} from "~/server/utils/s3-env";

const REQUIRED_FIELDS = [
  "ACCESS_KEY",
  "ENDPOINT",
  "ID",
  "NAME",
  "REGION",
  "SECRET_KEY",
] as const;

const ACCOUNT_FIELD_SUFFIXES = [
  "ACCESS_KEY",
  "SECRET_KEY",
  "ENDPOINT",
  "ID",
  "NAME",
  "REGION",
  "READ_ONLY",
] as const;

type RawAccount = {
  ACCESS_KEY: string;
  ENDPOINT: string;
  ID: string;
  NAME: string;
  REGION: string;
  SECRET_KEY: string;
  READ_ONLY?: string;
};

let currentConnections: Array<Account> = [];
let currentFingerprint = "";
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

function parseReadOnly(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseRawAccounts(env: Record<string, string>): Record<string, RawAccount> {
  const rawAccounts: Record<string, Partial<RawAccount>> = {};

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(ACCOUNT_ENV_PREFIX) || !value) {
      continue;
    }

    const rest = key.slice(ACCOUNT_ENV_PREFIX.length);

    for (const field of ACCOUNT_FIELD_SUFFIXES) {
      const suffix = `_${field}`;

      if (!rest.endsWith(suffix)) {
        continue;
      }

      const accountKey = rest.slice(0, -suffix.length);

      if (!accountKey) {
        continue;
      }

      rawAccounts[accountKey] ??= {};
      rawAccounts[accountKey][field as keyof RawAccount] = value;
      break;
    }
  }

  const parsed: Record<string, RawAccount> = {};

  for (const [accountKey, raw] of Object.entries(rawAccounts)) {
    for (const field of REQUIRED_FIELDS) {
      if (!raw[field]) {
        throw new Error(
          `Missing env var: ${ACCOUNT_ENV_PREFIX}${accountKey}_${field}`,
        );
      }
    }

    parsed[accountKey] = raw as RawAccount;
  }

  return parsed;
}

function buildAccountsFromEnv(env: Record<string, string>): Array<Account> {
  const rawAccounts = parseRawAccounts(env);

  return Object.values(rawAccounts).map(raw => ({
    id: raw.ID,
    organizationOrAccountName: raw.NAME,
    readOnly: parseReadOnly(raw.READ_ONLY),
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
  }));
}

function reloadConnections(): void {
  const env = loadS3ViewerAccountEnv();
  const fingerprint = fingerprintAccountEnv(env);

  if (fingerprint === currentFingerprint) {
    return;
  }

  const nextConnections = buildAccountsFromEnv(env);
  currentFingerprint = fingerprint;
  currentConnections = nextConnections;

  console.log(
    `[s3-viewer] loaded ${nextConnections.length} S3 account(s) from ${
      existsSync(S3_VIEWER_ACCOUNTS_DIR)
        ? S3_VIEWER_ACCOUNTS_DIR
        : "process.env"
    }`,
  );
}

function scheduleReload(): void {
  if (reloadTimer) {
    clearTimeout(reloadTimer);
  }

  reloadTimer = setTimeout(() => {
    reloadTimer = null;

    try {
      reloadConnections();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[s3-viewer] failed to reload S3 accounts: ${message}`);
    }
  }, 250);
}

export function getConnections(): Array<Account> {
  return currentConnections;
}

export function initS3AccountHotReload(): void {
  reloadConnections();

  if (!existsSync(S3_VIEWER_ACCOUNTS_DIR)) {
    console.log(
      "[s3-viewer] account hot reload disabled (set S3_VIEWER_ACCOUNTS_DIR or mount secret volume)",
    );
    return;
  }

  watch(S3_VIEWER_ACCOUNTS_DIR, { persistent: true }, () => scheduleReload());
  setInterval(() => scheduleReload(), 5_000);

  console.log(
    `[s3-viewer] account hot reload enabled for ${S3_VIEWER_ACCOUNTS_DIR}`,
  );
}
