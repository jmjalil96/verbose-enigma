import { Router } from "express";
import { requireAuth, requirePermissions, requireScope } from "../../../lib/auth/index.js";
import { validate } from "../../../lib/middleware/index.js";
import { asyncHandler } from "../../../lib/utils/async-handler.js";
import {
  createClaimInvoice,
  deleteClaimInvoice,
  getClaimInvoice,
  listClaimInvoices,
  updateClaimInvoice,
} from "./handlers.js";
import {
  createClaimInvoiceSchema,
  deleteClaimInvoiceSchema,
  getClaimInvoiceSchema,
  listClaimInvoicesSchema,
  updateClaimInvoiceSchema,
} from "./schemas.js";

export const claimInvoicesRouter = Router({ mergeParams: true });

// ─────────────────────────────────────────────────────────────────────────────
// List invoices
// ─────────────────────────────────────────────────────────────────────────────

claimInvoicesRouter.get(
  "/",
  requireAuth(),
  requirePermissions("claims:read"),
  requireScope("UNLIMITED"),
  validate(listClaimInvoicesSchema),
  asyncHandler(listClaimInvoices),
);

// ─────────────────────────────────────────────────────────────────────────────
// Create invoice
// ─────────────────────────────────────────────────────────────────────────────

claimInvoicesRouter.post(
  "/",
  requireAuth(),
  requirePermissions("claims:edit"),
  requireScope("UNLIMITED"),
  validate(createClaimInvoiceSchema),
  asyncHandler(createClaimInvoice),
);

// ─────────────────────────────────────────────────────────────────────────────
// Get invoice
// ─────────────────────────────────────────────────────────────────────────────

claimInvoicesRouter.get(
  "/:invoiceId",
  requireAuth(),
  requirePermissions("claims:read"),
  requireScope("UNLIMITED"),
  validate(getClaimInvoiceSchema),
  asyncHandler(getClaimInvoice),
);

// ─────────────────────────────────────────────────────────────────────────────
// Update invoice
// ─────────────────────────────────────────────────────────────────────────────

claimInvoicesRouter.patch(
  "/:invoiceId",
  requireAuth(),
  requirePermissions("claims:edit"),
  requireScope("UNLIMITED"),
  validate(updateClaimInvoiceSchema),
  asyncHandler(updateClaimInvoice),
);

// ─────────────────────────────────────────────────────────────────────────────
// Delete invoice
// ─────────────────────────────────────────────────────────────────────────────

claimInvoicesRouter.delete(
  "/:invoiceId",
  requireAuth(),
  requirePermissions("claims:edit"),
  requireScope("UNLIMITED"),
  validate(deleteClaimInvoiceSchema),
  asyncHandler(deleteClaimInvoice),
);
