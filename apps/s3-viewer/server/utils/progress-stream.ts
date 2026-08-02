import { Readable } from "node:stream";

type ProgressEvent =
  | { type: "progress"; deleted: number; total: number }
  | { type: "complete"; deletedCount: number }
  | { type: "error"; message: string; code?: string };

type ProgressStreamEvent = {
  _handled?: boolean;
  node?: {
    res?: import("node:http").ServerResponse;
  };
};

export type ProgressWriter = {
  progress: (deleted: number, total: number) => void;
  complete: (deletedCount: number) => void;
  error: (message: string, code?: string) => void;
};

function setStreamHeaders(res: import("node:http").ServerResponse) {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
}

export function streamProgressResponse(
  event: ProgressStreamEvent,
  estimatedTotal: number,
  run: (writer: ProgressWriter) => Promise<void>,
) {
  const res = event.node?.res;
  if (!res) {
    throw createError({
      statusCode: 500,
      statusMessage: "Streaming unavailable",
    });
  }

  setStreamHeaders(res);
  event._handled = true;

  const stream = new Readable({
    read() {},
  });

  const push = (payload: ProgressEvent) => {
    if (!stream.destroyed) {
      stream.push(`${JSON.stringify(payload)}\n`);
    }
  };

  const writer: ProgressWriter = {
    progress(deleted, total) {
      push({ type: "progress", deleted, total });
    },
    complete(deletedCount) {
      push({ type: "complete", deletedCount });
    },
    error(message, code) {
      push({ type: "error", message, code });
    },
  };

  void (async () => {
    try {
      if (estimatedTotal > 0) {
        writer.progress(0, estimatedTotal);
      }

      await run(writer);
    } catch (error) {
      writer.error(
        error instanceof Error ? error.message : "Operation failed",
      );
    } finally {
      stream.push(null);
    }
  })();

  return new Promise<void>((resolve, reject) => {
    stream.on("error", reject);
    res.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(res);
  });
}

export function writeAccessDeniedError(writer: ProgressWriter) {
  writer.error(
    "These credentials do not have permission to modify objects in this bucket. They may be read-only.",
    "READ_ONLY",
  );
}

export function writeHandlerError(writer: ProgressWriter, error: unknown) {
  if (error && typeof error === "object" && "statusMessage" in error) {
    const h3Error = error as {
      statusMessage?: string;
      data?: { code?: string };
    };
    writer.error(
      h3Error.statusMessage ?? "Operation failed",
      h3Error.data?.code,
    );
    return;
  }

  writer.error(error instanceof Error ? error.message : "Operation failed");
}
