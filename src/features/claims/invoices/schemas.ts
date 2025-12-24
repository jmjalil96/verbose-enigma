import { Prisma } from "@prisma/client";
import { z } from "zod";

const decimal = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format")
  .transform((v) => new Prisma.Decimal(v));

// ─────────────────────────────────────────────────────────────────────────────
// List invoices
// ─────────────────────────────────────────────────────────────────────────────

export const listClaimInvoicesSchema = {
  params: z.object({
    claimId: z.string().min(1),
  }),
};

export type ListClaimInvoicesParams = z.infer<
  typeof listClaimInvoicesSchema.params
>;

// ─────────────────────────────────────────────────────────────────────────────
// Create invoice
// ─────────────────────────────────────────────────────────────────────────────

export const createClaimInvoiceSchema = {
  params: z.object({
    claimId: z.string().min(1),
  }),
  body: z.object({
    invoiceNumber: z.string().min(1),
    providerName: z.string().min(1),
    amountSubmitted: decimal,
  }),
};

export type CreateClaimInvoiceParams = z.infer<
  typeof createClaimInvoiceSchema.params
>;
export type CreateClaimInvoiceBody = z.infer<
  typeof createClaimInvoiceSchema.body
>;

// ─────────────────────────────────────────────────────────────────────────────
// Get invoice
// ─────────────────────────────────────────────────────────────────────────────

export const getClaimInvoiceSchema = {
  params: z.object({
    claimId: z.string().min(1),
    invoiceId: z.string().min(1),
  }),
};

export type GetClaimInvoiceParams = z.infer<
  typeof getClaimInvoiceSchema.params
>;

// ─────────────────────────────────────────────────────────────────────────────
// Update invoice
// ─────────────────────────────────────────────────────────────────────────────

export const updateClaimInvoiceSchema = {
  params: z.object({
    claimId: z.string().min(1),
    invoiceId: z.string().min(1),
  }),
  body: z
    .object({
      invoiceNumber: z.string().min(1).optional(),
      providerName: z.string().min(1).optional(),
      amountSubmitted: decimal.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
};

export type UpdateClaimInvoiceParams = z.infer<
  typeof updateClaimInvoiceSchema.params
>;
export type UpdateClaimInvoiceBody = z.infer<
  typeof updateClaimInvoiceSchema.body
>;

// ─────────────────────────────────────────────────────────────────────────────
// Delete invoice
// ─────────────────────────────────────────────────────────────────────────────

export const deleteClaimInvoiceSchema = {
  params: z.object({
    claimId: z.string().min(1),
    invoiceId: z.string().min(1),
  }),
};

export type DeleteClaimInvoiceParams = z.infer<
  typeof deleteClaimInvoiceSchema.params
>;
