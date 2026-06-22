type ProgressEvent =
  | { type: "progress"; deleted: number; total: number }
  | { type: "complete"; deletedCount: number }
  | { type: "error"; message: string; code?: string };

export async function fetchWithProgress(
  url: string,
  onProgress: (deleted: number, total: number) => void,
): Promise<{ deletedCount: number }> {
  const response = await fetch(url);

  if (!response.ok) {
    let message = "Operation failed";
    try {
      const payload = await response.json();
      message = payload?.statusMessage ?? payload?.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Operation failed: empty response");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let deletedCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {break;}

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {continue;}

      const event = JSON.parse(line) as ProgressEvent;

      if (event.type === "progress") {
        onProgress(event.deleted, event.total);
      } else if (event.type === "complete") {
        deletedCount = event.deletedCount;
      } else if (event.type === "error") {
        throw {
          statusCode: event.code === "READ_ONLY" ? 403 : 502,
          statusMessage: event.message,
          data: event.code ? { code: event.code } : undefined,
        };
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as ProgressEvent;
    if (event.type === "complete") {
      deletedCount = event.deletedCount;
    } else if (event.type === "error") {
      throw {
        statusCode: event.code === "READ_ONLY" ? 403 : 502,
        statusMessage: event.message,
        data: event.code ? { code: event.code } : undefined,
      };
    }
  }

  return { deletedCount };
}

export async function deleteWithProgress(
  url: string,
  params: { key: string; isFolder: boolean; total?: number },
  onProgress: (deleted: number, total: number) => void,
): Promise<{ deletedCount: number }> {
  const query = new URLSearchParams({
    key: params.key,
    isFolder: params.isFolder ? "1" : "0",
    total: String(params.total ?? 0),
  });

  return fetchWithProgress(`${url}?${query.toString()}`, onProgress);
}

export async function emptyBucketWithProgress(
  url: string,
  total: number,
  onProgress: (deleted: number, total: number) => void,
): Promise<{ deletedCount: number }> {
  const query = new URLSearchParams({
    total: String(total),
  });

  return fetchWithProgress(`${url}?${query.toString()}`, onProgress);
}
