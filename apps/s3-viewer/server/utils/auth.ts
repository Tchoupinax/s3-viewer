import { createHash, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "s3_viewer_session";

export function authConfig() {
  const user = process.env.S3_VIEWER_AUTH_USER ?? "";
  const password = process.env.S3_VIEWER_AUTH_PASSWORD ?? "";
  return {
    enabled: Boolean(user && password),
    user,
    password,
  };
}

export function sessionToken(user: string, password: string) {
  return createHash("sha256").update(`s3-viewer:${user}:${password}`).digest("hex");
}

export function secretsMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {return false;}
  return timingSafeEqual(leftBuffer, rightBuffer);
}
