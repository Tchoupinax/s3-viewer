type S3ViewerResponse<T> = {
  data: T;
  status: "OK" | "KO";
};
