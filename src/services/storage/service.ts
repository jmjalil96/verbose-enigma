import type { Readable } from "node:stream";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getClient, getBucket } from "./client.js";
import { createModuleLogger } from "../../lib/logger/index.js";
import type {
  UploadOptions,
  SignedUploadUrl,
  SignedUrlOptions,
  SignedUploadOptions,
} from "./types.js";

const log = createModuleLogger("storage");
const DEFAULT_EXPIRES_IN = 900; // 15 minutes

/**
 * Upload a file to storage.
 */
export async function upload(
  key: string,
  data: Buffer | Readable,
  options: UploadOptions,
): Promise<void> {
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: options.contentType,
      Metadata: options.metadata,
    }),
  );

  log.debug({ key, contentType: options.contentType }, "File uploaded");
}

/**
 * Download a file as a stream (Node.js only).
 * Returns SDK stream cast to Readable - works in Node runtime.
 */
export async function downloadStream(key: string): Promise<Readable> {
  const client = getClient();
  const bucket = getBucket();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Empty response for key: ${key}`);
  }

  log.debug({ key }, "File download started");
  // AWS SDK v3 returns SdkStream which implements Readable in Node
  return response.Body as Readable;
}

/**
 * Download a file as a buffer (convenience, use for small files only).
 */
export async function downloadBuffer(key: string): Promise<Buffer> {
  const stream = await downloadStream(key);
  const chunks: Uint8Array[] = [];

  for await (const chunk of stream) {
    chunks.push(
      chunk instanceof Uint8Array ? chunk : Buffer.from(chunk as string),
    );
  }

  return Buffer.concat(chunks);
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  log.debug({ key }, "File deleted");
}

/**
 * Generate a presigned URL for direct browser upload.
 * Client must send the returned headers exactly.
 */
export async function getSignedUploadUrl(
  key: string,
  options: SignedUploadOptions,
): Promise<SignedUploadUrl> {
  const client = getClient();
  const bucket = getBucket();
  const expiresIn = options.expiresIn ?? DEFAULT_EXPIRES_IN;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: options.contentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn });

  log.debug({ key, expiresIn }, "Signed upload URL generated");

  return {
    url,
    headers: {
      "Content-Type": options.contentType,
    },
    key,
  };
}

/**
 * Generate a presigned URL for direct browser download.
 */
export async function getSignedDownloadUrl(
  key: string,
  options: SignedUrlOptions = {},
): Promise<string> {
  const client = getClient();
  const bucket = getBucket();
  const expiresIn = options.expiresIn ?? DEFAULT_EXPIRES_IN;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, { expiresIn });

  log.debug({ key, expiresIn }, "Signed download URL generated");

  return url;
}
