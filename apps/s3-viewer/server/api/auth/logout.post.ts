import type { S3ViewerResponse } from "~/server/types/response";
import { AUTH_COOKIE } from "~/server/utils/auth";

export default defineEventHandler((event): S3ViewerResponse<{ authenticated: boolean }> => {
  deleteCookie(event, AUTH_COOKIE, { path: "/" });
  return {
    status: "OK",
    data: { authenticated: false },
  };
});
