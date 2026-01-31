export type BucketIdentityNumber = string & { readonly "": unique symbol };

export type BucketIdentity = {
  accountId: string;
  bucketName: string | null;
  region: string;
};

export function generateBucketIdentityNumber(
  bucketIdentity: BucketIdentity,
): BucketIdentityNumber {
  return base64UrlEncode(
    JSON.stringify(bucketIdentity),
  ) as BucketIdentityNumber;
}

export function extractGenerateBucketIdentity(
  bucketIdentityNumber: BucketIdentityNumber,
): BucketIdentity {
  return JSON.parse(base64UrlDecode(bucketIdentityNumber)) as BucketIdentity;
}

function base64UrlEncode(str: string): string {
  const base64 =
    typeof btoa === "function"
      ? // Browser
        btoa(String.fromCharCode(...new TextEncoder().encode(str)))
      : // Node.js
        Buffer.from(str, "utf-8").toString("base64");

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(base64Url: string): string {
  const base64 = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=");

  if (typeof atob === "function") {
    // Browser
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  // Node.js
  return Buffer.from(base64, "base64").toString("utf-8");
}
