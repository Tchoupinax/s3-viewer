import type { Account } from "~/server/types/account";

const READ_ONLY_MESSAGE =
  "These credentials are read-only. Write operations such as delete and empty bucket are not allowed.";

export function isS3AccessDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {return false;}

  const e = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };

  return (
    e.name === "AccessDenied" ||
    e.Code === "AccessDenied" ||
    e.$metadata?.httpStatusCode === 403
  );
}

export function createReadOnlyError(reason?: string) {
  return createError({
    statusCode: 403,
    statusMessage: reason ?? READ_ONLY_MESSAGE,
    data: { code: "READ_ONLY" },
  });
}

export function assertWriteAccess(account: Account): void {
  if (account.readOnly) {
    throw createReadOnlyError();
  }
}

export function rethrowWriteAccessError(error: unknown): never {
  if (isS3AccessDeniedError(error)) {
    throw createReadOnlyError(
      "These credentials do not have permission to modify objects in this bucket. They may be read-only.",
    );
  }

  throw error;
}
