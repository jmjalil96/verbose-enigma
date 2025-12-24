import type { Prisma } from "@prisma/client";
import { db } from "../../../lib/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Claim lookup
// ─────────────────────────────────────────────────────────────────────────────

export async function getClaimForInvoiceOps(claimId: string) {
  return db.claim.findUnique({
    where: { id: claimId },
    select: { id: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// List invoices
// ─────────────────────────────────────────────────────────────────────────────

export async function getClaimInvoices(claimId: string) {
  return db.claimInvoice.findMany({
    where: { claimId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      providerName: true,
      amountSubmitted: true,
      createdAt: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Get single invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function getClaimInvoice(invoiceId: string, claimId: string) {
  return db.claimInvoice.findFirst({
    where: { id: invoiceId, claimId },
    select: {
      id: true,
      invoiceNumber: true,
      providerName: true,
      amountSubmitted: true,
      createdById: true,
      createdAt: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Create invoice
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateClaimInvoiceData {
  claimId: string;
  invoiceNumber: string;
  providerName: string;
  amountSubmitted: Prisma.Decimal;
  createdById: string;
}

export async function createClaimInvoice(data: CreateClaimInvoiceData) {
  return db.claimInvoice.create({
    data,
    select: {
      id: true,
      invoiceNumber: true,
      providerName: true,
      amountSubmitted: true,
      createdAt: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Update invoice
// ─────────────────────────────────────────────────────────────────────────────

export interface UpdateClaimInvoiceData {
  invoiceNumber?: string;
  providerName?: string;
  amountSubmitted?: Prisma.Decimal;
}

export async function updateClaimInvoice(
  invoiceId: string,
  data: UpdateClaimInvoiceData,
) {
  return db.claimInvoice.update({
    where: { id: invoiceId },
    data,
    select: {
      id: true,
      invoiceNumber: true,
      providerName: true,
      amountSubmitted: true,
      createdAt: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteClaimInvoice(invoiceId: string) {
  return db.claimInvoice.delete({
    where: { id: invoiceId },
  });
}
