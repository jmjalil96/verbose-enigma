import { z } from "zod";
import { CareType, ClaimStatus, Prisma } from "@prisma/client";

export const createClaimSchema = {
  body: z.object({
    clientId: z.string().min(1),
    affiliateId: z.string().min(1),
    patientId: z.string().min(1),
    description: z.string().min(1),
    sessionKey: z.string().min(1).optional(),
  }),
};

export type CreateClaimBody = z.infer<typeof createClaimSchema.body>;

// ─────────────────────────────────────────────────────────────────────────────
// Get Claim
// ─────────────────────────────────────────────────────────────────────────────

export const getClaimSchema = {
  params: z.object({
    id: z.string().min(1),
  }),
};

export type GetClaimParams = z.infer<typeof getClaimSchema.params>;

// ─────────────────────────────────────────────────────────────────────────────
// List Claims
// ─────────────────────────────────────────────────────────────────────────────

export const listClaimsSchema = {
  query: z.object({
    // Cursor pagination (claimNumber-based)
    cursor: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),

    // Relationship filters
    clientId: z.string().min(1).optional(),
    affiliateId: z.string().min(1).optional(),
    patientId: z.string().min(1).optional(),
    policyId: z.string().min(1).optional(),
    createdById: z.string().min(1).optional(),

    // Status filter (comma-separated for multi-select: "DRAFT,SUBMITTED")
    status: z.preprocess(
      (val) => (typeof val === "string" && val ? val.split(",") : undefined),
      z.array(z.enum(ClaimStatus)).optional(),
    ),

    // Care type filter
    careType: z.enum(CareType).optional(),

    // Date range filters (ISO date strings)
    createdFrom: z.coerce.date().optional(),
    createdTo: z.coerce.date().optional(),
    submittedFrom: z.coerce.date().optional(),
    submittedTo: z.coerce.date().optional(),
    settlementFrom: z.coerce.date().optional(),
    settlementTo: z.coerce.date().optional(),
    incidentFrom: z.coerce.date().optional(),
    incidentTo: z.coerce.date().optional(),

    // Amount range filters (numbers, Prisma handles Decimal comparison)
    amountSubmittedMin: z.coerce.number().nonnegative().optional(),
    amountSubmittedMax: z.coerce.number().nonnegative().optional(),
    amountApprovedMin: z.coerce.number().nonnegative().optional(),
    amountApprovedMax: z.coerce.number().nonnegative().optional(),
    amountDeniedMin: z.coerce.number().nonnegative().optional(),
    amountDeniedMax: z.coerce.number().nonnegative().optional(),

    // Search (claimNumber, diagnosis, affiliate/patient/client name)
    search: z.string().max(100).optional(),

    // Include total count (optional for performance)
    includeTotal: z.coerce.boolean().default(false),
  }),
};

export type ListClaimsQuery = z.infer<typeof listClaimsSchema.query>;

// ─────────────────────────────────────────────────────────────────────────────
// Update Claim
// ─────────────────────────────────────────────────────────────────────────────

const decimal = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format")
  .transform((v) => new Prisma.Decimal(v));

export const updateClaimSchema = {
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      // Core fields
      policyId: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      careType: z.enum(CareType).optional(),
      diagnosis: z.string().min(1).optional(),
      incidentDate: z.coerce.date().optional(),
      // Submission fields
      amountSubmitted: decimal.optional(),
      submittedDate: z.coerce.date().optional(),
      // Settlement fields
      amountApproved: decimal.optional(),
      amountDenied: decimal.optional(),
      amountUnprocessed: decimal.optional(),
      deductibleApplied: decimal.optional(),
      copayApplied: decimal.optional(),
      settlementDate: z.coerce.date().optional(),
      settlementNumber: z.string().min(1).optional(),
      settlementNotes: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
};

export type UpdateClaimParams = z.infer<typeof updateClaimSchema.params>;
export type UpdateClaimBody = z.infer<typeof updateClaimSchema.body>;

// ─────────────────────────────────────────────────────────────────────────────
// Transition Claim
// ─────────────────────────────────────────────────────────────────────────────

export const transitionClaimSchema = {
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    toStatus: z.enum(ClaimStatus),
    reason: z.string().min(1).optional(),
    notes: z.string().optional(),
  }),
};

export type TransitionClaimParams = z.infer<
  typeof transitionClaimSchema.params
>;
export type TransitionClaimBody = z.infer<typeof transitionClaimSchema.body>;
