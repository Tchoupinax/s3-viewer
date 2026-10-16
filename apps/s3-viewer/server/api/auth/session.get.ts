import type { S3ViewerResponse } from "~/server/types/response";
import { authConfig, AUTH_COOKIE, secretsMatch, sessionToken } from "~/server/utils/auth";

export default defineEventHandler(
  (event): S3ViewerResponse<{ authenticated: boolean; required: boolean }> => {
    const auth = authConfig();
    const cookie = getCookie(event, AUTH_COOKIE) ?? "";
    const authenticated = auth.enabled && secretsMatch(
      cookie,
      sessionToken(auth.user, auth.password),
    );

    return {
      status: "OK",
      data: {
        required: auth.enabled,
        authenticated,
      },
    };
  },
);
