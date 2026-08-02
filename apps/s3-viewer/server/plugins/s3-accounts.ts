import { initS3Accounts } from "~/server/utils/s3";

export default defineNitroPlugin(() => {
  initS3Accounts();
});
