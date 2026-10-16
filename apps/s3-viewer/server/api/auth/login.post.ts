import type { S3ViewerResponse } from "~/server/types/response";
import { authConfig, AUTH_COOKIE, secretsMatch, sessionToken } from "~/server/utils/auth";
import { readEventJsonBody } from "~/server/utils/event-query";

export default defineEventHandler(
  async (event): Promise<S3ViewerResponse<{ authenticated: boolean }>> => {
    const auth = authConfig();
    if (!auth.enabled) {
      return { status: "OK", data: { authenticated: true } };
    }

    const body = await readEventJsonBody<{ password?: string; username?: string }>(event);
    const username = String(body.username ?? "");
    const password = String(body.password ?? "");

    if (!secretsMatch(username, auth.user) || !secretsMatch(password, auth.password)) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid username or password",
      });
    }

    setCookie(event, AUTH_COOKIE, sessionToken(auth.user, auth.password), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return {
      status: "OK",
      data: { authenticated: true },
    };
  },
);
