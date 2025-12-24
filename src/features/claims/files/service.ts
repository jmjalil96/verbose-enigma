import { randomBytes, randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { SessionUser } from "../../../lib/auth/types.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../../lib/errors/index.js";
import { enqueue, JobType } from "../../../lib/jobs/index.js";
import {
  getMimeType,
  getSignedDownloadUrl,
  getSignedUploadUrl,
} from "../../../services/storage/index.js";
import {
  createClaimFileRow,
  createPendingClaimFile,
  getClaimFile,
  getClaimFiles,
  getClaimForFileOps,
  softDeleteClaimFile,
  updateClaimFileTargetKey,
} from "./repository.js";
import type {
  AddClaimFileUploadUrlBody,
  CreatePendingFileUploadUrlBody,
} from "./schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY_BYTES = 16;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a session key for grouping pending files.
 */
export function generateSessionKey(): string {
  return randomBytes(SESSION_KEY_BYTES).toString("hex");
}

/**
 * Build storage key for pending claim file.
 * Pattern: temp/claims/{userId}/{sessionKey}/{fileId}.{ext}
 */
export function buildPendingFileKey(
  userId: string,
  sessionKey: string,
  fileId: string,
  fileName: string,
): string {
  const ext = extname(fileName);
  return `temp/claims/${userId}/${sessionKey}/${fileId}${ext}`;
}

/**
 * Build final storage key for claim file.
 * Pattern: clients/{clientId}/claims/{claimId}/{fileId}.{ext}
 */
export function buildClaimFileTargetKey(
  clientId: string,
  claimId: string,
  fileId: string,
  fileName: string,
): string {
  const ext = extname(fileName);
  return `clients/${clientId}/claims/${claimId}/${fileId}${ext}`;
}

/**
 * Get expiry date for pending files (24 hours).
 */
export function getPendingFileExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that content type matches file extension.
 */
export function validateContentType(
  fileName: string,
  contentType: string,
): void {
  const expected = getMimeType(fileName);
  if (contentType !== expected) {
    throw new BadRequestError(
      `Content type mismatch: expected ${expected} for ${fileName}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Use Cases - Pending Files
// ─────────────────────────────────────────────────────────────────────────────

export async function createPendingFileUploadUrlUseCase(
  user: SessionUser,
  body: CreatePendingFileUploadUrlBody,
): Promise<{
  sessionKey: string;
  pendingFileId: string;
  key: string;
  url: string;
  headers: Record<string, string>;
}> {
  validateContentType(body.fileName, body.contentType);

  const sessionKey = body.sessionKey ?? generateSessionKey();
  const expiresAt = getPendingFileExpiry();

  // Generate ID upfront so we can compute fileKey before insert
  const pendingFileId = randomUUID();
  const fileKey = buildPendingFileKey(user.id, sessionKey, pendingFileId, body.fileName);

  // Single insert with final values (no placeholder, no update)
  const pendingFile = await createPendingClaimFile({
    id: pendingFileId,
    userId: user.id,
    sessionKey,
    fileType: body.fileType,
    fileName: body.fileName,
    fileKey,
    fileSize: body.fileSize,
    contentType: body.contentType,
    expiresAt,
  });

  // Generate presigned URL
  const signed = await getSignedUploadUrl(fileKey, {
    contentType: body.contentType,
  });

  return {
    sessionKey,
    pendingFileId: pendingFile.id,
    key: signed.key,
    url: signed.url,
    headers: signed.headers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Use Cases - Claim Files
// ─────────────────────────────────────────────────────────────────────────────

export async function listClaimFilesUseCase(claimId: string) {
  const claim = await getClaimForFileOps(claimId);
  if (!claim) {
    throw new NotFoundError("Claim not found");
  }

  const files = await getClaimFiles(claimId);
  return { files };
}

export async function addClaimFileUploadUrlUseCase(
  user: SessionUser,
  claimId: string,
  body: AddClaimFileUploadUrlBody,
): Promise<{
  fileId: string;
  key: string;
  url: string;
  headers: Record<string, string>;
}> {
  validateContentType(body.fileName, body.contentType);

  const claim = await getClaimForFileOps(claimId);
  if (!claim) {
    throw new NotFoundError("Claim not found");
  }

  // Create file record
  const file = await createClaimFileRow({
    claimId,
    fileType: body.fileType,
    fileName: body.fileName,
    fileSize: body.fileSize,
    contentType: body.contentType,
    createdById: user.id,
  });

  // Build and set target key
  const targetKey = buildClaimFileTargetKey(
    claim.clientId,
    claimId,
    file.id,
    body.fileName,
  );
  await updateClaimFileTargetKey(file.id, targetKey);

  // Generate presigned URL
  const signed = await getSignedUploadUrl(targetKey, {
    contentType: body.contentType,
  });

  // Enqueue verification job
  await enqueue(
    JobType.CLAIM_FILE_VERIFY,
    { fileId: file.id },
    { jobId: `claim-file-verify:${file.id}`, delay: 30000 },
  );

  return {
    fileId: file.id,
    key: signed.key,
    url: signed.url,
    headers: signed.headers,
  };
}

export async function getClaimFileDownloadUrlUseCase(
  claimId: string,
  fileId: string,
): Promise<{
  url: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}> {
  const file = await getClaimFile(fileId, claimId);
  if (!file) {
    throw new NotFoundError("File not found");
  }

  if (file.status !== "READY") {
    throw new BadRequestError(`File not available (status: ${file.status})`);
  }

  if (!file.targetKey) {
    throw new BadRequestError("File storage key not available");
  }

  const downloadUrl = await getSignedDownloadUrl(file.targetKey);

  return {
    url: downloadUrl,
    fileName: file.fileName,
    contentType: file.contentType,
    fileSize: file.fileSize,
  };
}

export async function deleteClaimFileUseCase(
  claimId: string,
  fileId: string,
) {
  const file = await getClaimFile(fileId, claimId);
  if (!file) {
    throw new NotFoundError("File not found");
  }

  await softDeleteClaimFile(fileId);

  // Always enqueue storage cleanup if targetKey exists (regardless of status)
  if (file.targetKey) {
    await enqueue(
      JobType.CLAIM_FILE_DELETE,
      { fileId, targetKey: file.targetKey },
      { jobId: `claim-file-delete:${fileId}` },
    );
  }

  return { fileName: file.fileName, fileType: file.fileType };
}
