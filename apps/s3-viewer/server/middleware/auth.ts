import { authConfig, AUTH_COOKIE, secretsMatch, sessionToken } from "~/server/utils/auth";

const OPEN_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/health",
  "/_nuxt",
];

export default defineEventHandler(event => {
  const auth = authConfig();
  if (!auth.enabled) {return;}

  const path = event.path?.split("?")[0] ?? "";
  if (OPEN_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) {
    return;
  }

  if (!path.startsWith("/api/")) {return;}

  const cookie = getCookie(event, AUTH_COOKIE) ?? "";
  const expected = sessionToken(auth.user, auth.password);
  if (!secretsMatch(cookie, expected)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }
});
