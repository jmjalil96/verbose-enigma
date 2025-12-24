import { Router } from "express";
import { requireAuth, requirePermissions, requireScope } from "../../lib/auth/index.js";
import { validate } from "../../lib/middleware/index.js";
import { asyncHandler } from "../../lib/utils/async-handler.js";
import { claimAuditRouter } from "./audit/index.js";
import { filesRouter, claimFilesRouter } from "./files/index.js";
import { claimInvoicesRouter } from "./invoices/index.js";
import {
  createClaim,
  getClaim,
  listClaims,
  transitionClaim,
  updateClaim,
} from "./handlers.js";
import {
  createClaimSchema,
  getClaimSchema,
  listClaimsSchema,
  transitionClaimSchema,
  updateClaimSchema,
} from "./schemas.js";

export const claimsRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Pending file endpoints
// ─────────────────────────────────────────────────────────────────────────────

claimsRouter.use("/pending-files", filesRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Claim endpoints
// ─────────────────────────────────────────────────────────────────────────────

claimsRouter.get(
  "/",
  requireAuth(),
  requirePermissions("claims:read"),
  validate(listClaimsSchema),
  asyncHandler(listClaims),
);

claimsRouter.get(
  "/:id",
  requireAuth(),
  requirePermissions("claims:read"),
  validate(getClaimSchema),
  asyncHandler(getClaim),
);

claimsRouter.post(
  "/",
  requireAuth(),
  requirePermissions("claims:create"),
  validate(createClaimSchema),
  asyncHandler(createClaim),
);

claimsRouter.patch(
  "/:id",
  requireAuth(),
  requirePermissions("claims:edit"),
  requireScope("UNLIMITED"),
  validate(updateClaimSchema),
  asyncHandler(updateClaim),
);

claimsRouter.post(
  "/:id/transition",
  requireAuth(),
  requirePermissions("claims:edit"),
  requireScope("UNLIMITED"),
  validate(transitionClaimSchema),
  asyncHandler(transitionClaim),
);

// ─────────────────────────────────────────────────────────────────────────────
// Claim file endpoints
// ─────────────────────────────────────────────────────────────────────────────

claimsRouter.use("/:claimId/files", claimFilesRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Claim invoice endpoints
// ─────────────────────────────────────────────────────────────────────────────

claimsRouter.use("/:claimId/invoices", claimInvoicesRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Claim audit endpoints
// ─────────────────────────────────────────────────────────────────────────────

claimsRouter.use("/:claimId/audit", claimAuditRouter);
