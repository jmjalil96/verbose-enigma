import { Router } from "express";
import { requireAuth, requirePermissions, requireScope } from "../../../lib/auth/index.js";
import { validate } from "../../../lib/middleware/index.js";
import { asyncHandler } from "../../../lib/utils/async-handler.js";
import { listClaimAudit } from "./handlers.js";
import { listClaimAuditSchema } from "./schemas.js";

export const claimAuditRouter = Router({ mergeParams: true });

claimAuditRouter.get(
  "/",
  requireAuth(),
  requirePermissions("claims:read"),
  requireScope("UNLIMITED"),
  validate(listClaimAuditSchema),
  asyncHandler(listClaimAudit),
);
