import type { Job } from "bullmq";
import { db } from "../db.js";
import { createModuleLogger } from "../logger/index.js";
import { DEFAULT_JOB_ATTEMPTS } from "./queue.js";
import { JobType, jobPayloadSchemas } from "./types.js";
import {
  sendClaimCreatedEmail,
  sendInviteEmail,
  sendPasswordResetEmail,
} from "../../services/email/index.js";
import { copyFile, deleteFile, headObject } from "../../services/storage/index.js";

const log = createModuleLogger("jobs");

// ─────────────────────────────────────────────────────────────────────────────
// Claim file migration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Migrate claim files from temporary to permanent storage.
 * Processes files sequentially, updating status after each.
 * Idempotent: only processes PENDING files.
 *
 * Retry behavior:
 * - On success: copy file, delete temp, mark READY
 * - On failure (not final attempt): keep PENDING, store error for debugging
 * - On failure (final attempt): mark FAILED
 */
async function migrateClaimFiles(
  claimId: string,
  attemptsMade: number,
): Promise<void> {
  const maxAttempts = DEFAULT_JOB_ATTEMPTS;
  const isFinalAttempt = attemptsMade >= maxAttempts - 1;
  // Fetch all PENDING ClaimFiles for this claim
  const files = await db.claimFile.findMany({
    where: { claimId, status: "PENDING" },
    select: {
      id: true,
      sourceKey: true,
      targetKey: true,
      fileName: true,
    },
  });

  if (files.length === 0) {
    log.info({ claimId }, "No pending files to migrate");
    return;
  }

  log.info({ claimId, fileCount: files.length }, "Starting file migration");

  let successCount = 0;
  let failCount = 0;

  // Process each file
  for (const file of files) {
    try {
      // Skip if targetKey is missing (shouldn't happen, but be safe)
      if (!file.targetKey) {
        throw new Error("Missing targetKey for file");
      }

      // Copy file to permanent location
      await copyFile({
        sourceKey: file.sourceKey,
        destinationKey: file.targetKey,
      });

      // Delete temp file
      await deleteFile(file.sourceKey);

      // Update status to READY
      await db.claimFile.update({
        where: { id: file.id },
        data: {
          status: "READY",
          migratedAt: new Date(),
          sourceKey: "", // Clear sourceKey since temp file is deleted
        },
      });

      successCount++;
      log.debug({ claimId, fileId: file.id }, "File migrated successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (isFinalAttempt) {
        // Final attempt: mark as FAILED
        await db.claimFile.update({
          where: { id: file.id },
          data: {
            status: "FAILED",
            errorMessage,
          },
        });
        log.error(
          { claimId, fileId: file.id, error: errorMessage },
          "File migration failed (final attempt)",
        );
      } else {
        // Not final attempt: keep PENDING, store error for debugging
        await db.claimFile.update({
          where: { id: file.id },
          data: { errorMessage },
        });
        log.warn(
          { claimId, fileId: file.id, error: errorMessage, attemptsMade },
          "File migration failed (will retry)",
        );
      }

      failCount++;
    }
  }

  log.info(
    { claimId, successCount, failCount, total: files.length },
    "File migration completed",
  );

  // Throw if any failed (triggers job retry)
  if (failCount > 0) {
    throw new Error(
      `${String(failCount)} of ${String(files.length)} files failed to migrate`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim file verify (for direct uploads)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a claim file upload exists in storage.
 * Called after presigned upload URL is issued to confirm file was uploaded.
 */
async function verifyClaimFile(
  fileId: string,
  attemptsMade: number,
): Promise<void> {
  const maxAttempts = DEFAULT_JOB_ATTEMPTS;
  const isFinalAttempt = attemptsMade >= maxAttempts - 1;

  const file = await db.claimFile.findUnique({
    where: { id: fileId },
    select: { id: true, targetKey: true, status: true, deletedAt: true },
  });

  if (!file) {
    log.warn({ fileId }, "File not found, skipping verify");
    return;
  }

  // Skip soft-deleted files (delete handler already enqueued cleanup)
  if (file.deletedAt) {
    log.info({ fileId }, "File was deleted, skipping verify");
    return;
  }

  if (file.status !== "PENDING") {
    log.info({ fileId, status: file.status }, "File not pending, skipping verify");
    return;
  }

  if (!file.targetKey) {
    throw new Error("Missing targetKey for file");
  }

  const exists = await headObject(file.targetKey);

  if (exists) {
    await db.claimFile.update({
      where: { id: fileId },
      data: { status: "READY" },
    });
    log.info({ fileId }, "File verified and marked READY");
  } else {
    if (isFinalAttempt) {
      await db.claimFile.update({
        where: { id: fileId },
        data: { status: "FAILED", errorMessage: "Upload not found" },
      });
      log.error({ fileId }, "File verify failed (final attempt)");
    } else {
      log.warn({ fileId, attemptsMade }, "File not yet uploaded, will retry");
      throw new Error("File not yet uploaded");
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim file delete (storage cleanup)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete a claim file from storage after soft delete.
 */
async function deleteClaimFileStorage(
  fileId: string,
  targetKey: string,
): Promise<void> {
  await deleteFile(targetKey);
  log.info({ fileId, targetKey }, "File deleted from storage");
}

/**
 * Job processors registry.
 */
export const processors: Record<string, (job: Job) => Promise<void>> = {
  [JobType.EMAIL_SEND_INVITE]: async (job) => {
    const payload = jobPayloadSchemas[JobType.EMAIL_SEND_INVITE].parse(
      job.data,
    );
    await sendInviteEmail(payload.invitationId, payload.token);
  },

  [JobType.EMAIL_SEND_PASSWORD_RESET]: async (job) => {
    const payload = jobPayloadSchemas[JobType.EMAIL_SEND_PASSWORD_RESET].parse(
      job.data,
    );
    await sendPasswordResetEmail(payload.userId, payload.token);
  },

  [JobType.EMAIL_CLAIM_CREATED]: async (job) => {
    const payload = jobPayloadSchemas[JobType.EMAIL_CLAIM_CREATED].parse(
      job.data,
    );
    await sendClaimCreatedEmail(payload.claimId, payload.affiliateId);
  },

  [JobType.CLAIM_FILES_MIGRATE]: async (job) => {
    const payload = jobPayloadSchemas[JobType.CLAIM_FILES_MIGRATE].parse(
      job.data,
    );
    await migrateClaimFiles(payload.claimId, job.attemptsMade);
  },

  [JobType.CLAIM_FILE_VERIFY]: async (job) => {
    const payload = jobPayloadSchemas[JobType.CLAIM_FILE_VERIFY].parse(
      job.data,
    );
    await verifyClaimFile(payload.fileId, job.attemptsMade);
  },

  [JobType.CLAIM_FILE_DELETE]: async (job) => {
    const payload = jobPayloadSchemas[JobType.CLAIM_FILE_DELETE].parse(
      job.data,
    );
    await deleteClaimFileStorage(payload.fileId, payload.targetKey);
  },
};

/**
 * Main processor function - routes jobs to their handlers.
 */
export async function processJob(job: Job): Promise<void> {
  const processor = processors[job.name];

  if (!processor) {
    log.error({ jobName: job.name, jobId: job.id }, "No processor for job type");
    throw new Error(`No processor registered for job type: ${job.name}`);
  }

  await processor(job);
}
