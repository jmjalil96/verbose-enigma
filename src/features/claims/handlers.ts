import { AuditAction, type Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../lib/errors/index.js";
import { enqueue, JobType } from "../../lib/jobs/index.js";
import { buildOffsetPagination } from "../../lib/utils/pagination.js";
import { logAudit } from "../../services/audit/index.js";
import type {
  CreateClaimBody,
  GetClaimParams,
  ListClaimsQuery,
  TransitionClaimBody,
  TransitionClaimParams,
  UpdateClaimBody,
  UpdateClaimParams,
} from "./schemas.js";
import {
  createClaimUseCase,
  getClaimUseCase,
  listClaimsUseCase,
  transitionClaimUseCase,
  updateClaimUseCase,
} from "./service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Create claim
// ─────────────────────────────────────────────────────────────────────────────

export async function createClaim(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const body = req.body as CreateClaimBody;

  const { claim, files } = await createClaimUseCase(user, body);

  if (files.length > 0) {
    await enqueue(
      JobType.CLAIM_FILES_MIGRATE,
      { claimId: claim.id, clientId: body.clientId },
      { jobId: `claim-files-migrate:${claim.id}` },
    );
  }

  await enqueue(
    JobType.EMAIL_CLAIM_CREATED,
    { claimId: claim.id, affiliateId: body.affiliateId },
    { jobId: `claim-created-email:${claim.id}` },
  );

  logAudit(
    {
      action: AuditAction.CREATE,
      resource: "claim",
      resourceId: claim.id,
      metadata: { claimNumber: claim.claimNumber },
    },
    req,
  );

  req.log.info(
    { userId: user.id, claimId: claim.id, claimNumber: claim.claimNumber },
    "Claim created",
  );

  res.status(201).json({
    id: claim.id,
    claimNumber: claim.claimNumber,
    status: claim.status,
    files: files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileType: f.fileType,
      status: f.status,
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// List claims
// ─────────────────────────────────────────────────────────────────────────────

export async function listClaims(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const query = req.query as unknown as ListClaimsQuery;

  const { claims, total, page, limit } = await listClaimsUseCase(user, query);
  const response = buildOffsetPagination(claims, page, limit, total);

  req.log.info(
    { total, returned: response.data.length, page },
    "Claims listed",
  );

  res.json(response);
}

// ─────────────────────────────────────────────────────────────────────────────
// Get claim
// ─────────────────────────────────────────────────────────────────────────────

export async function getClaim(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { id } = req.params as GetClaimParams;

  const claim = await getClaimUseCase(user, id);

  req.log.info(
    {
      userId: user.id,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
    },
    "Claim retrieved",
  );

  res.json(claim);
}

// ─────────────────────────────────────────────────────────────────────────────
// Update claim
// ─────────────────────────────────────────────────────────────────────────────

export async function updateClaim(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { id } = req.params as UpdateClaimParams;
  const body = req.body as UpdateClaimBody;

  const { claim, changes } = await updateClaimUseCase(user, id, body);

  if (changes.fields.length > 0) {
    logAudit(
      {
        action: AuditAction.UPDATE,
        resource: "claim",
        resourceId: claim.id,
        metadata: changes as unknown as Prisma.InputJsonObject,
      },
      req,
    );
  }

  req.log.info(
    { userId: user.id, claimId: claim.id, claimNumber: claim.claimNumber },
    "Claim updated",
  );

  res.json(claim);
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition claim
// ─────────────────────────────────────────────────────────────────────────────

export async function transitionClaim(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { id } = req.params as TransitionClaimParams;
  const body = req.body as TransitionClaimBody;

  const { claim, transition } = await transitionClaimUseCase(user, id, body);

  logAudit(
    {
      action: AuditAction.STATUS_CHANGE,
      resource: "claim",
      resourceId: claim.id,
      metadata: { ...transition },
    },
    req,
  );

  req.log.info(
    {
      userId: user.id,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      toStatus: body.toStatus,
    },
    "Claim transitioned",
  );

  res.json(claim);
}
