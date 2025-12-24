import { AuditAction, type Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../../lib/errors/index.js";
import { logAudit } from "../../../services/audit/index.js";
import type {
  CreateClaimInvoiceBody,
  CreateClaimInvoiceParams,
  DeleteClaimInvoiceParams,
  GetClaimInvoiceParams,
  ListClaimInvoicesParams,
  UpdateClaimInvoiceBody,
  UpdateClaimInvoiceParams,
} from "./schemas.js";
import {
  createClaimInvoiceUseCase,
  deleteClaimInvoiceUseCase,
  getClaimInvoiceUseCase,
  listClaimInvoicesUseCase,
  updateClaimInvoiceUseCase,
} from "./service.js";

// ─────────────────────────────────────────────────────────────────────────────
// List invoices
// ─────────────────────────────────────────────────────────────────────────────

export async function listClaimInvoices(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { claimId } = req.params as ListClaimInvoicesParams;

  const result = await listClaimInvoicesUseCase(claimId);

  req.log.info(
    { userId: user.id, claimId, invoiceCount: result.invoices.length },
    "Claim invoices listed",
  );

  res.json(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// Get invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function getClaimInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { claimId, invoiceId } = req.params as GetClaimInvoiceParams;

  const invoice = await getClaimInvoiceUseCase(claimId, invoiceId);

  req.log.info(
    { userId: user.id, claimId, invoiceId },
    "Claim invoice retrieved",
  );

  res.json(invoice);
}

// ─────────────────────────────────────────────────────────────────────────────
// Create invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function createClaimInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { claimId } = req.params as CreateClaimInvoiceParams;
  const body = req.body as CreateClaimInvoiceBody;

  const invoice = await createClaimInvoiceUseCase(user, claimId, body);

  logAudit(
    {
      action: AuditAction.CREATE,
      resource: "claimInvoice",
      resourceId: invoice.id,
      metadata: {
        claimId,
        invoiceNumber: invoice.invoiceNumber,
        providerName: invoice.providerName,
      },
    },
    req,
  );

  req.log.info(
    { userId: user.id, claimId, invoiceId: invoice.id },
    "Claim invoice created",
  );

  res.status(201).json(invoice);
}

// ─────────────────────────────────────────────────────────────────────────────
// Update invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function updateClaimInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { claimId, invoiceId } = req.params as UpdateClaimInvoiceParams;
  const body = req.body as UpdateClaimInvoiceBody;

  const { invoice, changes } = await updateClaimInvoiceUseCase(claimId, invoiceId, body);

  if (changes.fields.length > 0) {
    logAudit(
      {
        action: AuditAction.UPDATE,
        resource: "claimInvoice",
        resourceId: invoiceId,
        metadata: { claimId, ...changes } as unknown as Prisma.InputJsonObject,
      },
      req,
    );
  }

  req.log.info(
    { userId: user.id, claimId, invoiceId },
    "Claim invoice updated",
  );

  res.json(invoice);
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteClaimInvoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { claimId, invoiceId } = req.params as DeleteClaimInvoiceParams;

  const { invoiceNumber } = await deleteClaimInvoiceUseCase(claimId, invoiceId);

  logAudit(
    {
      action: AuditAction.DELETE,
      resource: "claimInvoice",
      resourceId: invoiceId,
      metadata: { claimId, invoiceNumber },
    },
    req,
  );

  req.log.info(
    { userId: user.id, claimId, invoiceId },
    "Claim invoice deleted",
  );

  res.status(204).send();
}
