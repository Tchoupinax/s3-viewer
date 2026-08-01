import { initS3AccountHotReload } from "~/server/utils/s3";

export default defineNitroPlugin(() => {
  initS3AccountHotReload();
});
