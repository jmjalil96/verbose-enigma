import type { ClaimFileType } from "@prisma/client";
import { db } from "../../../lib/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Pending Files
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePendingClaimFileData {
  id?: string;
  userId: string;
  sessionKey: string;
  fileType: ClaimFileType;
  fileName: string;
  fileKey: string;
  fileSize: number;
  contentType: string;
  expiresAt: Date;
}

export async function createPendingClaimFile(data: CreatePendingClaimFileData) {
  return db.pendingClaimFile.create({
    data,
    select: {
      id: true,
      sessionKey: true,
      fileKey: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim Files - Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get claim for file operations (need clientId for storage key).
 */
export async function getClaimForFileOps(claimId: string) {
  return db.claim.findUnique({
    where: { id: claimId },
    select: { id: true, clientId: true },
  });
}

/**
 * List non-deleted files for a claim.
 */
export async function getClaimFiles(claimId: string) {
  return db.claimFile.findMany({
    where: { claimId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileType: true,
      fileName: true,
      fileSize: true,
      contentType: true,
      status: true,
      createdAt: true,
    },
  });
}

/**
 * Get single file (non-deleted) for a claim.
 */
export async function getClaimFile(fileId: string, claimId: string) {
  return db.claimFile.findFirst({
    where: { id: fileId, claimId, deletedAt: null },
    select: {
      id: true,
      fileType: true,
      fileName: true,
      fileSize: true,
      contentType: true,
      status: true,
      targetKey: true,
      createdAt: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim Files - Writes (Primitives)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create claim file record with PENDING status.
 */
export async function createClaimFileRow(data: {
  claimId: string;
  fileType: ClaimFileType;
  fileName: string;
  fileSize: number;
  contentType: string;
  createdById: string;
}) {
  return db.claimFile.create({
    data: {
      claimId: data.claimId,
      fileType: data.fileType,
      fileName: data.fileName,
      fileSize: data.fileSize,
      contentType: data.contentType,
      sourceKey: "",
      status: "PENDING",
      createdById: data.createdById,
    },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      status: true,
    },
  });
}

/**
 * Update claim file target key.
 */
export async function updateClaimFileTargetKey(
  fileId: string,
  targetKey: string,
) {
  return db.claimFile.update({
    where: { id: fileId },
    data: { targetKey },
    select: { id: true, targetKey: true },
  });
}

/**
 * Soft delete a claim file.
 */
export async function softDeleteClaimFile(fileId: string) {
  return db.claimFile.update({
    where: { id: fileId },
    data: { deletedAt: new Date() },
  });
}
