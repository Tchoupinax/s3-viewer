import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const S3_VIEWER_ACCOUNTS_DIR =
  process.env.S3_VIEWER_ACCOUNTS_DIR ?? "/etc/s3-viewer/accounts";

export const ACCOUNT_ENV_PREFIX = "S3_VIEWER_ACCOUNT_";

export function loadS3ViewerAccountEnv(): Record<string, string> {
  if (existsSync(S3_VIEWER_ACCOUNTS_DIR)) {
    return loadFromDirectory(S3_VIEWER_ACCOUNTS_DIR);
  }

  return loadFromProcessEnv();
}

function loadFromDirectory(dir: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const entry of readdirSync(dir)) {
    const filePath = join(dir, entry);

    try {
      if (!statSync(filePath).isFile()) {
        continue;
      }

      env[entry] = readFileSync(filePath, "utf8").replace(/\n$/, "");
    } catch {
      // Secret volume files can briefly disappear while kubelet syncs.
    }
  }

  return env;
}

function loadFromProcessEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(ACCOUNT_ENV_PREFIX) && value) {
      env[key] = value;
    }
  }

  return env;
}

export function fingerprintAccountEnv(env: Record<string, string>): string {
  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}
