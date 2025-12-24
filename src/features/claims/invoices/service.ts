import type { SessionUser } from "../../../lib/auth/types.js";
import { computeChanges, type ChangeSet } from "../../../lib/utils/diff.js";
import { NotFoundError } from "../../../lib/errors/index.js";
import {
  createClaimInvoice,
  deleteClaimInvoice,
  getClaimForInvoiceOps,
  getClaimInvoice,
  getClaimInvoices,
  updateClaimInvoice,
} from "./repository.js";
import type {
  CreateClaimInvoiceBody,
  UpdateClaimInvoiceBody,
} from "./schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// List invoices
// ─────────────────────────────────────────────────────────────────────────────

export async function listClaimInvoicesUseCase(claimId: string) {
  const claim = await getClaimForInvoiceOps(claimId);
  if (!claim) {
    throw new NotFoundError("Claim not found");
  }

  const invoices = await getClaimInvoices(claimId);
  return { invoices };
}

// ─────────────────────────────────────────────────────────────────────────────
// Get invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function getClaimInvoiceUseCase(
  claimId: string,
  invoiceId: string,
) {
  const invoice = await getClaimInvoice(invoiceId, claimId);
  if (!invoice) {
    throw new NotFoundError("Invoice not found");
  }

  return invoice;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function createClaimInvoiceUseCase(
  user: SessionUser,
  claimId: string,
  body: CreateClaimInvoiceBody,
) {
  const claim = await getClaimForInvoiceOps(claimId);
  if (!claim) {
    throw new NotFoundError("Claim not found");
  }

  return createClaimInvoice({
    claimId,
    invoiceNumber: body.invoiceNumber,
    providerName: body.providerName,
    amountSubmitted: body.amountSubmitted,
    createdById: user.id,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Update invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function updateClaimInvoiceUseCase(
  claimId: string,
  invoiceId: string,
  body: UpdateClaimInvoiceBody,
): Promise<{ invoice: Awaited<ReturnType<typeof updateClaimInvoice>>; changes: ChangeSet }> {
  const existing = await getClaimInvoice(invoiceId, claimId);
  if (!existing) {
    throw new NotFoundError("Invoice not found");
  }

  const changes = computeChanges(
    existing as unknown as Record<string, unknown>,
    body as unknown as Record<string, unknown>,
  );
  const invoice = await updateClaimInvoice(invoiceId, body);

  return { invoice, changes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteClaimInvoiceUseCase(
  claimId: string,
  invoiceId: string,
) {
  const invoice = await getClaimInvoice(invoiceId, claimId);
  if (!invoice) {
    throw new NotFoundError("Invoice not found");
  }

  await deleteClaimInvoice(invoiceId);

  return { invoiceNumber: invoice.invoiceNumber };
}
