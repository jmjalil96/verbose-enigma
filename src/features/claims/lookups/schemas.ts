import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────

export const listClientsSchema = {
  query: z.object({}).optional(),
};

export type ListClientsQuery = z.infer<typeof listClientsSchema.query>;

// ─────────────────────────────────────────────────────────────────────────────
// Affiliates
// ─────────────────────────────────────────────────────────────────────────────

export const listAffiliatesSchema = {
  query: z.object({
    clientId: z.string().min(1),
    q: z.string().min(2).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
};

export type ListAffiliatesQuery = z.infer<typeof listAffiliatesSchema.query>;

// ─────────────────────────────────────────────────────────────────────────────
// Patients
// ─────────────────────────────────────────────────────────────────────────────

export const listPatientsSchema = {
  query: z.object({
    affiliateId: z.string().min(1),
  }),
};

export type ListPatientsQuery = z.infer<typeof listPatientsSchema.query>;

// ─────────────────────────────────────────────────────────────────────────────
// Policies
// ─────────────────────────────────────────────────────────────────────────────

export const listPoliciesSchema = {
  query: z.object({
    clientId: z.string().min(1),
  }),
};

export type ListPoliciesQuery = z.infer<typeof listPoliciesSchema.query>;
