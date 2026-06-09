type FetchErrorShape = {
  statusCode?: number;
  statusMessage?: string;
  message?: string;
  data?: {
    statusMessage?: string;
    code?: string;
  };
};

export function getFetchErrorMessage(error: unknown, fallback: string): string {
  const err = error as FetchErrorShape;
  return err.data?.statusMessage ?? err.statusMessage ?? err.message ?? fallback;
}

export function isReadOnlyFetchError(error: unknown): boolean {
  const err = error as FetchErrorShape;
  const message = getFetchErrorMessage(error, "").toLowerCase();

  return (
    err.data?.code === "READ_ONLY" ||
    (err.statusCode === 403 && message.includes("read-only")) ||
    (err.statusCode === 403 && message.includes("permission to modify"))
  );
}
