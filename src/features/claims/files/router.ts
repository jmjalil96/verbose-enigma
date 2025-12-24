import { Router } from "express";
import { requireAuth, requirePermissions, requireScope } from "../../../lib/auth/index.js";
import { validate } from "../../../lib/middleware/index.js";
import { asyncHandler } from "../../../lib/utils/async-handler.js";
import {
  createPendingFileUploadUrl,
  listClaimFiles,
  addClaimFileUploadUrl,
  getClaimFileDownloadUrl,
  deleteClaimFile,
} from "./handlers.js";
import {
  createPendingFileUploadUrlSchema,
  listClaimFilesSchema,
  addClaimFileUploadUrlSchema,
  getClaimFileDownloadUrlSchema,
  deleteClaimFileSchema,
} from "./schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Pending files router (before claim exists)
// ─────────────────────────────────────────────────────────────────────────────

export const filesRouter = Router();

filesRouter.post(
  "/upload-url",
  requireAuth(),
  validate(createPendingFileUploadUrlSchema),
  asyncHandler(createPendingFileUploadUrl),
);

// ─────────────────────────────────────────────────────────────────────────────
// Claim files router (for existing claims)
// ─────────────────────────────────────────────────────────────────────────────

export const claimFilesRouter = Router({ mergeParams: true });

claimFilesRouter.get(
  "/",
  requireAuth(),
  requirePermissions("claims:read"),
  requireScope("UNLIMITED"),
  validate(listClaimFilesSchema),
  asyncHandler(listClaimFiles),
);

claimFilesRouter.post(
  "/upload-url",
  requireAuth(),
  requirePermissions("claims:edit"),
  requireScope("UNLIMITED"),
  validate(addClaimFileUploadUrlSchema),
  asyncHandler(addClaimFileUploadUrl),
);

claimFilesRouter.get(
  "/:fileId/download-url",
  requireAuth(),
  requirePermissions("claims:read"),
  requireScope("UNLIMITED"),
  validate(getClaimFileDownloadUrlSchema),
  asyncHandler(getClaimFileDownloadUrl),
);

claimFilesRouter.delete(
  "/:fileId",
  requireAuth(),
  requirePermissions("claims:edit"),
  requireScope("UNLIMITED"),
  validate(deleteClaimFileSchema),
  asyncHandler(deleteClaimFile),
);
