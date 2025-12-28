import { Router } from "express";
import { requireAuth, requirePermissions } from "../../../lib/auth/index.js";
import { validate } from "../../../lib/middleware/index.js";
import { asyncHandler } from "../../../lib/utils/async-handler.js";
import {
  listAffiliates,
  listClients,
  listPatients,
  listPolicies,
} from "./handlers.js";
import {
  listAffiliatesSchema,
  listPatientsSchema,
  listPoliciesSchema,
} from "./schemas.js";

export const lookupsRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────

lookupsRouter.get(
  "/clients",
  requireAuth(),
  requirePermissions("claims:create"),
  asyncHandler(listClients),
);

// ─────────────────────────────────────────────────────────────────────────────
// Affiliates
// ─────────────────────────────────────────────────────────────────────────────

lookupsRouter.get(
  "/affiliates",
  requireAuth(),
  requirePermissions("claims:create"),
  validate(listAffiliatesSchema),
  asyncHandler(listAffiliates),
);

// ─────────────────────────────────────────────────────────────────────────────
// Patients
// ─────────────────────────────────────────────────────────────────────────────

lookupsRouter.get(
  "/patients",
  requireAuth(),
  requirePermissions("claims:create"),
  validate(listPatientsSchema),
  asyncHandler(listPatients),
);

// ─────────────────────────────────────────────────────────────────────────────
// Policies
// ─────────────────────────────────────────────────────────────────────────────

lookupsRouter.get(
  "/policies",
  requireAuth(),
  requirePermissions("claims:edit"),
  validate(listPoliciesSchema),
  asyncHandler(listPolicies),
);
