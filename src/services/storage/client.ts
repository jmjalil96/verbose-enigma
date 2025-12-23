import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../../lib/env.js";

let client: S3Client | null = null;

/**
 * Get S3 client (lazy singleton).
 * Throws if R2 credentials not configured.
 */
export function getClient(): S3Client {
  if (!client) {
    if (
      !env.R2_ACCOUNT_ID ||
      !env.R2_ACCESS_KEY_ID ||
      !env.R2_SECRET_ACCESS_KEY
    ) {
      throw new Error("R2 storage not configured: missing credentials");
    }

    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return client;
}

export function getBucket(): string {
  if (!env.R2_BUCKET_NAME) {
    throw new Error("R2 storage not configured: missing bucket name");
  }
  return env.R2_BUCKET_NAME;
}
