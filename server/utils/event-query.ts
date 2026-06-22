import { parseQuery } from "ufo";

type EventWithPath = {
  path?: string;
  node?: {
    req?: import("node:http").IncomingMessage;
  };
};

export function getEventQuery(event: EventWithPath) {
  const rawPath = event.path ?? event.node?.req?.url ?? "";
  const queryString = rawPath.includes("?")
    ? rawPath.slice(rawPath.indexOf("?") + 1).split("#")[0]!
    : "";

  return parseQuery(queryString);
}

function readNodeRequestBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", chunk => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

export async function readEventJsonBody<T>(event: EventWithPath): Promise<T> {
  const req = event.node?.req;
  if (!req) {
    return {} as T;
  }

  const rawBody = await readNodeRequestBody(req);
  if (!rawBody) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
}
