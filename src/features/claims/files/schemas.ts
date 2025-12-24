import { z } from "zod";
import { ClaimFileType } from "@prisma/client";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const createPendingFileUploadUrlSchema = {
  body: z.object({
    sessionKey: z.string().min(1).optional(),
    fileName: z.string().min(1),
    fileType: z.enum(ClaimFileType),
    contentType: z.string().min(1),
    fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  }),
};

export type CreatePendingFileUploadUrlBody = z.infer<
  typeof createPendingFileUploadUrlSchema.body
>;

// ─────────────────────────────────────────────────────────────────────────────
// Claim files CRUD (for existing claims)
// ─────────────────────────────────────────────────────────────────────────────

export const listClaimFilesSchema = {
  params: z.object({
    claimId: z.string().min(1),
  }),
};

export type ListClaimFilesParams = z.infer<typeof listClaimFilesSchema.params>;

export const addClaimFileUploadUrlSchema = {
  params: z.object({
    claimId: z.string().min(1),
  }),
  body: z.object({
    fileName: z.string().min(1),
    fileType: z.enum(ClaimFileType),
    contentType: z.string().min(1),
    fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  }),
};

export type AddClaimFileUploadUrlParams = z.infer<
  typeof addClaimFileUploadUrlSchema.params
>;
export type AddClaimFileUploadUrlBody = z.infer<
  typeof addClaimFileUploadUrlSchema.body
>;

export const getClaimFileDownloadUrlSchema = {
  params: z.object({
    claimId: z.string().min(1),
    fileId: z.string().min(1),
  }),
};

export type GetClaimFileDownloadUrlParams = z.infer<
  typeof getClaimFileDownloadUrlSchema.params
>;

export const deleteClaimFileSchema = {
  params: z.object({
    claimId: z.string().min(1),
    fileId: z.string().min(1),
  }),
};

export type DeleteClaimFileParams = z.infer<
  typeof deleteClaimFileSchema.params
>;
