import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";

export const S3_VIEWER_ACCOUNTS_DIR =
  process.env.S3_VIEWER_ACCOUNTS_DIR ?? "/etc/s3-viewer/accounts";

export const ACCOUNT_ENV_PREFIX = "S3_VIEWER_ACCOUNT_";

export function loadS3ViewerAccountEnv(): Record<string, string> {
  if (existsSync(S3_VIEWER_ACCOUNTS_DIR)) {
    return loadFromDirectory(resolveAccountSecretDataDir());
  }

  return loadFromProcessEnv();
}

function resolveAccountSecretDataDir(
  mountDir = S3_VIEWER_ACCOUNTS_DIR,
): string {
  const dataLink = join(mountDir, "..data");

  if (!existsSync(dataLink)) {
    return mountDir;
  }

  try {
    return realpathSync(dataLink);
  } catch {
    return mountDir;
  }
}

function loadFromDirectory(dataDir: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const entry of readdirSync(dataDir)) {
    const filePath = join(dataDir, entry);

    try {
      if (!statSync(filePath).isFile()) {
        continue;
      }

      env[entry] = readFileSync(filePath, "utf8").replace(/\n$/, "");
    } catch {
      // Ignore unreadable entries during mount setup.
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
