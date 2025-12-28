import {
  ClaimStatus,
  type ClaimFileStatus,
  type ClaimFileType,
  type Prisma,
} from "@prisma/client";
import type { SessionUser } from "../../lib/auth/types.js";
import { db } from "../../lib/db.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../lib/errors/index.js";
import { computeChanges, type ChangeSet } from "../../lib/utils/diff.js";
import { applyDateRange, applyNumberRange } from "../../lib/utils/query.js";
import {
  agentHasClientAccess,
  clientAdminHasClientAccess,
  type ClaimDetail,
  type ClaimListItem,
  countClaims,
  createClaim,
  createClaimFile,
  createClaimHistory,
  deletePendingClaimFiles,
  findAffiliateWithClient,
  findClaims,
  findPatientForClaim,
  findUserAffiliate,
  getClaimById,
  getClaimForUpdate,
  getClaimStatus,
  getPendingFilesBySession,
  getUserAssignedClientIds,
  incrementGlobalCounter,
  updateClaimById,
} from "./repository.js";
import type {
  CreateClaimBody,
  ListClaimsQuery,
  TransitionClaimBody,
  UpdateClaimBody,
} from "./schemas.js";
import {
  canTransition,
  getEditableFields,
  getInvariants,
  isReasonRequired,
  isTerminal,
} from "./state-machine.js";
import { buildClaimFileTargetKey } from "./files/service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Scope filters
// ─────────────────────────────────────────────────────────────────────────────

export interface ScopeFilters {
  scopeClientIds?: string[];
  scopeAffiliateId?: string;
}

export async function getClaimsScopeFilters(
  user: SessionUser,
  requestedClientId?: string,
): Promise<ScopeFilters> {
  if (user.role.scopeType === "UNLIMITED") {
    return {};
  }

  if (user.role.scopeType === "CLIENT") {
    const clientIds = await getUserAssignedClientIds(user.id);
    if (requestedClientId && !clientIds.includes(requestedClientId)) {
      throw new ForbiddenError("Not authorized for this client");
    }
    return {
      scopeClientIds: requestedClientId ? [requestedClientId] : clientIds,
    };
  }

  // SELF scope
  const affiliate = await findUserAffiliate(user.id);
  if (!affiliate) {
    throw new ForbiddenError("No affiliate profile found");
  }

  return { scopeAffiliateId: affiliate.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// List claims (query construction lives in service)
// ─────────────────────────────────────────────────────────────────────────────

type ClaimsFilterParams = ListClaimsQuery & ScopeFilters;

const DATE_RANGE_FIELDS = [
  ["createdAt", "createdFrom", "createdTo"],
  ["submittedDate", "submittedFrom", "submittedTo"],
  ["settlementDate", "settlementFrom", "settlementTo"],
  ["incidentDate", "incidentFrom", "incidentTo"],
] as const;

const AMOUNT_RANGE_FIELDS = [
  ["amountSubmitted", "amountSubmittedMin", "amountSubmittedMax"],
  ["amountApproved", "amountApprovedMin", "amountApprovedMax"],
  ["amountDenied", "amountDeniedMin", "amountDeniedMax"],
] as const;

function buildClaimsWhereClause(
  params: ClaimsFilterParams,
): Prisma.ClaimWhereInput {
  const where: Prisma.ClaimWhereInput = {};
  const andConditions: Prisma.ClaimWhereInput[] = [];

  // Scope constraints (locked, non-overridable)
  if (params.scopeAffiliateId) {
    if (params.affiliateId && params.affiliateId !== params.scopeAffiliateId) {
      throw new ForbiddenError("Cannot filter by other affiliates");
    }
    where.affiliateId = params.scopeAffiliateId;
  }
  if (params.scopeClientIds?.length) {
    // clientId validation already happens in getClaimsScopeFilters
    where.clientId = { in: params.scopeClientIds };
  }

  // User filters (only for non-scoped fields)
  if (!params.scopeAffiliateId && params.affiliateId) {
    where.affiliateId = params.affiliateId;
  }
  if (!params.scopeClientIds?.length && params.clientId) {
    where.clientId = params.clientId;
  }
  if (params.patientId) where.patientId = params.patientId;
  if (params.policyId) where.policyId = params.policyId;
  if (params.createdById) where.createdById = params.createdById;

  // Status/type
  if (params.status?.length) where.status = { in: params.status };
  if (params.careType) where.careType = params.careType;

  // Date ranges (loop)
  for (const [field, fromKey, toKey] of DATE_RANGE_FIELDS) {
    applyDateRange(
      where as Record<string, unknown>,
      field,
      params[fromKey],
      params[toKey],
    );
  }

  // Amount ranges (loop)
  for (const [field, minKey, maxKey] of AMOUNT_RANGE_FIELDS) {
    applyNumberRange(
      where as Record<string, unknown>,
      field,
      params[minKey],
      params[maxKey],
    );
  }

  // Search
  if (params.search) {
    const searchTerm = params.search.trim();
    const numericMatch = /^(?:CLM-?)?(\d+)$/i.exec(searchTerm);

    if (numericMatch?.[1]) {
      where.claimNumber = parseInt(numericMatch[1], 10);
    } else {
      andConditions.push({
        OR: [
          { diagnosis: { contains: searchTerm, mode: "insensitive" } },
          {
            affiliate: {
              OR: [
                { firstName: { contains: searchTerm, mode: "insensitive" } },
                { lastName: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          },
          {
            patient: {
              OR: [
                { firstName: { contains: searchTerm, mode: "insensitive" } },
                { lastName: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          },
          { client: { name: { contains: searchTerm, mode: "insensitive" } } },
        ],
      });
    }
  }

  if (andConditions.length) where.AND = andConditions;

  return where;
}

export async function listClaimsUseCase(
  user: SessionUser,
  query: ListClaimsQuery,
): Promise<{ claims: ClaimListItem[]; total: number; page: number; limit: number }> {
  const scopeFilters = await getClaimsScopeFilters(user, query.clientId);
  const where = buildClaimsWhereClause({ ...query, ...scopeFilters });
  const offset = (query.page - 1) * query.limit;

  const [claims, total] = await Promise.all([
    findClaims({ where, offset, limit: query.limit }),
    countClaims(where),
  ]);

  return { claims, total, page: query.page, limit: query.limit };
}

// ─────────────────────────────────────────────────────────────────────────────
// Get claim
// ─────────────────────────────────────────────────────────────────────────────

export async function getClaimUseCase(
  user: SessionUser,
  claimId: string,
): Promise<ClaimDetail> {
  const scopeFilters = await getClaimsScopeFilters(user);
  const claim = await getClaimById(claimId, scopeFilters);
  if (!claim) {
    throw new NotFoundError("Claim not found");
  }
  return claim;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create claim
// ─────────────────────────────────────────────────────────────────────────────

const CLAIM_NUMBER_COUNTER_ID = "claim_number";

export async function createClaimUseCase(
  user: SessionUser,
  body: CreateClaimBody,
) {
  // Scope-based access control
  if (user.role.scopeType === "SELF") {
    const userAffiliate = await findUserAffiliate(user.id);
    if (!userAffiliate || userAffiliate.id !== body.affiliateId) {
      throw new ForbiddenError("Cannot create claims for other affiliates");
    }
  } else if (user.role.scopeType === "CLIENT") {
    const hasAccess =
      (await agentHasClientAccess(user.id, body.clientId)) ||
      (await clientAdminHasClientAccess(user.id, body.clientId));
    if (!hasAccess) {
      throw new ForbiddenError("Not authorized for this client");
    }
  }

  // Relationship validation
  const affiliate = await findAffiliateWithClient(
    body.affiliateId,
    body.clientId,
  );
  if (!affiliate) {
    throw new BadRequestError(
      "Affiliate not found or does not belong to client",
    );
  }

  const patient = await findPatientForClaim(
    body.patientId,
    body.clientId,
    user.role.scopeType === "SELF" ? body.affiliateId : undefined,
  );
  if (!patient) {
    throw new BadRequestError("Patient not found or not valid for this claim");
  }

  const pendingFiles = body.sessionKey
    ? await getPendingFilesBySession(user.id, body.sessionKey)
    : [];

  return db.$transaction(async (tx) => {
    const claimNumber = await incrementGlobalCounter(
      tx,
      CLAIM_NUMBER_COUNTER_ID,
    );

    const claim = await createClaim(tx, {
      claimNumber,
      clientId: body.clientId,
      affiliateId: body.affiliateId,
      patientId: body.patientId,
      description: body.description,
      status: ClaimStatus.DRAFT,
      createdById: user.id,
    });

    const files: {
      id: string;
      fileName: string;
      fileType: ClaimFileType;
      status: ClaimFileStatus;
    }[] = [];

    for (const pf of pendingFiles) {
      const claimFile = await createClaimFile(tx, {
        id: pf.id,
        claimId: claim.id,
        fileType: pf.fileType,
        fileName: pf.fileName,
        fileSize: pf.fileSize,
        contentType: pf.contentType,
        sourceKey: pf.fileKey,
        targetKey: buildClaimFileTargetKey(
          body.clientId,
          claim.id,
          pf.id,
          pf.fileName,
        ),
        status: "PENDING",
        createdById: user.id,
      });
      files.push(claimFile);
    }

    if (pendingFiles.length > 0) {
      await deletePendingClaimFiles(
        tx,
        pendingFiles.map((pf) => pf.id),
      );
    }

    await createClaimHistory(tx, {
      claimId: claim.id,
      toStatus: ClaimStatus.DRAFT,
      createdById: user.id,
    });

    return { claim, files };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Update claim (PATCH)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateClaimUseCase(
  user: SessionUser,
  claimId: string,
  patch: UpdateClaimBody,
): Promise<{ claim: Awaited<ReturnType<typeof updateClaimById>>; changes: ChangeSet }> {
  const claim = await getClaimForUpdate(claimId);
  if (!claim) {
    throw new NotFoundError("Claim not found");
  }

  if (isTerminal(claim.status)) {
    throw new BadRequestError(`Cannot edit claim in ${claim.status} status`);
  }

  const editableFields = getEditableFields(claim.status);
  const attemptedFields = Object.keys(patch);
  const forbiddenFields = attemptedFields.filter(
    (f) => !editableFields.includes(f),
  );

  if (forbiddenFields.length > 0) {
    throw new BadRequestError(
      `Cannot edit fields in ${claim.status} status: ${forbiddenFields.join(", ")}`,
    );
  }

  const merged = { ...claim, ...patch };
  const invariants = getInvariants(claim.status);
  const violatedInvariants = invariants.filter((f) => {
    const val = merged[f as keyof typeof merged];
    if (val == null) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    return false;
  });

  if (violatedInvariants.length > 0) {
    throw new BadRequestError(
      `Required fields cannot be empty: ${violatedInvariants.join(", ")}`,
    );
  }

  // Compute changes before the update
  const changes = computeChanges(claim, patch);

  const updated = await db.$transaction(async (tx) => {
    const result = await updateClaimById(tx, claimId, {
      ...patch,
      updatedById: user.id,
    });

    await createClaimHistory(tx, {
      claimId,
      fromStatus: claim.status,
      toStatus: claim.status,
      notes: "Fields updated",
      createdById: user.id,
    });

    return result;
  });

  return { claim: updated, changes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition claim
// ─────────────────────────────────────────────────────────────────────────────

export interface StatusTransition {
  from: ClaimStatus;
  to: ClaimStatus;
  reason?: string;
}

export async function transitionClaimUseCase(
  user: SessionUser,
  claimId: string,
  body: TransitionClaimBody,
): Promise<{ claim: Awaited<ReturnType<typeof updateClaimById>>; transition: StatusTransition }> {
  const claim = await getClaimForUpdate(claimId);
  if (!claim) {
    throw new NotFoundError("Claim not found");
  }

  if (claim.status === body.toStatus) {
    throw new BadRequestError(`Claim is already in ${claim.status} status`);
  }

  if (!canTransition(claim.status, body.toStatus)) {
    throw new BadRequestError(
      `Cannot transition claim from ${claim.status} to ${body.toStatus}`,
    );
  }

  if (isReasonRequired(claim.status, body.toStatus) && !body.reason) {
    throw new BadRequestError(
      `Reason is required for transition ${claim.status} -> ${body.toStatus}`,
    );
  }

  const invariants = getInvariants(body.toStatus);
  const violatedInvariants = invariants.filter((f) => {
    const val = claim[f as keyof typeof claim];
    if (val == null) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    return false;
  });

  if (violatedInvariants.length > 0) {
    throw new BadRequestError(
      `Missing required fields for ${body.toStatus}: ${violatedInvariants.join(", ")}`,
    );
  }

  const transition: StatusTransition = {
    from: claim.status,
    to: body.toStatus,
    reason: body.reason,
  };

  const updated = await db.$transaction(async (tx) => {
    const current = await getClaimStatus(tx, claimId);
    if (!current) {
      throw new NotFoundError("Claim not found");
    }

    if (current.status !== claim.status) {
      throw new ConflictError(
        `Claim status changed (expected ${claim.status}, got ${current.status})`,
      );
    }

    const result = await updateClaimById(tx, claimId, {
      status: body.toStatus,
      updatedById: user.id,
    });

    await createClaimHistory(tx, {
      claimId,
      fromStatus: claim.status,
      toStatus: body.toStatus,
      reason: body.reason,
      notes: body.notes,
      createdById: user.id,
    });

    return result;
  });

  return { claim: updated, transition };
}
