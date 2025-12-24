import {
  ClaimStatus,
  type ClaimFileStatus,
  type ClaimFileType,
  type Prisma,
} from "@prisma/client";
import { db } from "../../lib/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Scope / relationship lookups (DB-only)
// ─────────────────────────────────────────────────────────────────────────────

export async function findUserAffiliate(userId: string) {
  return db.affiliate.findUnique({
    where: { userId },
    select: { id: true, clientId: true },
  });
}

export async function agentHasClientAccess(
  userId: string,
  clientId: string,
): Promise<boolean> {
  const agent = await db.agent.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!agent) return false;

  const assignment = await db.agentClient.findUnique({
    where: { agentId_clientId: { agentId: agent.id, clientId } },
    select: { agentId: true },
  });
  return assignment !== null;
}

export async function clientAdminHasClientAccess(
  userId: string,
  clientId: string,
): Promise<boolean> {
  const clientAdmin = await db.clientAdmin.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!clientAdmin) return false;

  const assignment = await db.clientAdminClient.findUnique({
    where: {
      clientAdminId_clientId: { clientAdminId: clientAdmin.id, clientId },
    },
    select: { clientAdminId: true },
  });
  return assignment !== null;
}

export async function findAffiliateWithClient(
  affiliateId: string,
  clientId: string,
) {
  return db.affiliate.findFirst({
    where: { id: affiliateId, clientId, isActive: true },
    select: { id: true, clientId: true },
  });
}

export async function findPatientForClaim(
  patientId: string,
  clientId: string,
  affiliateId?: string,
) {
  const baseWhere: Prisma.AffiliateWhereInput = {
    id: patientId,
    clientId,
    isActive: true,
  };

  if (affiliateId) {
    return db.affiliate.findFirst({
      where: {
        ...baseWhere,
        OR: [{ id: affiliateId }, { primaryAffiliateId: affiliateId }],
      },
      select: { id: true, clientId: true, firstName: true, lastName: true },
    });
  }

  return db.affiliate.findFirst({
    where: baseWhere,
    select: { id: true, clientId: true, firstName: true, lastName: true },
  });
}

export async function getUserAssignedClientIds(
  userId: string,
): Promise<string[]> {
  const agent = await db.agent.findUnique({
    where: { userId },
    select: { clients: { select: { clientId: true } } },
  });
  if (agent) return agent.clients.map((c) => c.clientId);

  const clientAdmin = await db.clientAdmin.findUnique({
    where: { userId },
    select: { clients: { select: { clientId: true } } },
  });
  if (clientAdmin) return clientAdmin.clients.map((c) => c.clientId);

  return [];
}

export async function getPendingFilesBySession(
  userId: string,
  sessionKey: string,
) {
  return db.pendingClaimFile.findMany({
    where: {
      userId,
      sessionKey,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      fileType: true,
      fileName: true,
      fileKey: true,
      fileSize: true,
      contentType: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Selects
// ─────────────────────────────────────────────────────────────────────────────

const CLAIMS_LIST_SELECT = {
  id: true,
  claimNumber: true,
  status: true,
  description: true,
  careType: true,
  diagnosis: true,
  amountSubmitted: true,
  amountApproved: true,
  amountDenied: true,
  incidentDate: true,
  submittedDate: true,
  settlementDate: true,
  createdAt: true,
  affiliate: {
    select: { id: true, firstName: true, lastName: true },
  },
  patient: {
    select: { id: true, firstName: true, lastName: true },
  },
  client: {
    select: { id: true, name: true },
  },
  policy: {
    select: { id: true, policyNumber: true },
  },
} as const;

export type ClaimListItem = Prisma.ClaimGetPayload<{
  select: typeof CLAIMS_LIST_SELECT;
}>;

const CLAIM_DETAIL_SELECT = {
  id: true,
  claimNumber: true,
  status: true,
  description: true,
  careType: true,
  diagnosis: true,
  // Amounts
  amountSubmitted: true,
  amountApproved: true,
  amountDenied: true,
  amountUnprocessed: true,
  deductibleApplied: true,
  copayApplied: true,
  // Dates
  incidentDate: true,
  submittedDate: true,
  settlementDate: true,
  createdAt: true,
  updatedAt: true,
  // Settlement
  businessDays: true,
  settlementNumber: true,
  settlementNotes: true,
  // Relations
  affiliate: { select: { id: true, firstName: true, lastName: true } },
  patient: { select: { id: true, firstName: true, lastName: true } },
  client: { select: { id: true, name: true } },
  policy: { select: { id: true, policyNumber: true } },
  createdBy: {
    select: { id: true, email: true },
  },
  updatedBy: {
    select: { id: true, email: true },
  },
} as const;

export type ClaimDetail = Prisma.ClaimGetPayload<{
  select: typeof CLAIM_DETAIL_SELECT;
}>;

const CLAIM_UPDATE_SELECT = {
  id: true,
  claimNumber: true,
  status: true,
  policyId: true,
  description: true,
  careType: true,
  diagnosis: true,
  incidentDate: true,
  amountSubmitted: true,
  submittedDate: true,
  amountApproved: true,
  amountDenied: true,
  amountUnprocessed: true,
  deductibleApplied: true,
  copayApplied: true,
  settlementDate: true,
  settlementNumber: true,
  settlementNotes: true,
} as const;

export type ClaimForUpdate = Prisma.ClaimGetPayload<{
  select: typeof CLAIM_UPDATE_SELECT;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Claim reads
// ─────────────────────────────────────────────────────────────────────────────

export async function getClaimById(
  claimId: string,
  scopeFilters: { scopeClientIds?: string[]; scopeAffiliateId?: string },
): Promise<ClaimDetail | null> {
  const where: Prisma.ClaimWhereInput = { id: claimId };

  if (scopeFilters.scopeClientIds?.length) {
    where.clientId = { in: scopeFilters.scopeClientIds };
  }
  if (scopeFilters.scopeAffiliateId) {
    where.affiliateId = scopeFilters.scopeAffiliateId;
  }

  return db.claim.findFirst({
    where,
    select: CLAIM_DETAIL_SELECT,
  });
}

export async function getClaimForUpdate(
  claimId: string,
): Promise<ClaimForUpdate | null> {
  return db.claim.findUnique({
    where: { id: claimId },
    select: CLAIM_UPDATE_SELECT,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Claims query execution (no query construction)
// ─────────────────────────────────────────────────────────────────────────────

export async function findClaims(params: {
  where: Prisma.ClaimWhereInput;
  cursor?: number;
  limit: number;
}): Promise<ClaimListItem[]> {
  const where: Prisma.ClaimWhereInput = { ...params.where };

  if (params.cursor) {
    where.claimNumber = { lt: params.cursor };
  }

  return db.claim.findMany({
    where,
    take: params.limit + 1,
    orderBy: { claimNumber: "desc" },
    select: CLAIMS_LIST_SELECT,
  });
}

export async function countClaims(
  where: Prisma.ClaimWhereInput,
): Promise<number> {
  return db.claim.count({ where });
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction primitives
// ─────────────────────────────────────────────────────────────────────────────

export async function incrementGlobalCounter(
  tx: Prisma.TransactionClient,
  counterId: string,
): Promise<number> {
  const counter = await tx.globalCounter.upsert({
    where: { id: counterId },
    create: { id: counterId, value: 1 },
    update: { value: { increment: 1 } },
  });

  return counter.value;
}

export async function createClaim(
  tx: Prisma.TransactionClient,
  data: {
    claimNumber: number;
    clientId: string;
    affiliateId: string;
    patientId: string;
    description: string;
    createdById: string;
    status: ClaimStatus;
  },
) {
  return tx.claim.create({
    data,
    select: {
      id: true,
      claimNumber: true,
      status: true,
    },
  });
}

export async function createClaimFile(
  tx: Prisma.TransactionClient,
  data: {
    id: string;
    claimId: string;
    fileType: ClaimFileType;
    fileName: string;
    fileSize: number;
    contentType: string;
    sourceKey: string;
    targetKey: string;
    status: ClaimFileStatus;
    createdById: string;
  },
): Promise<{
  id: string;
  fileName: string;
  fileType: ClaimFileType;
  status: ClaimFileStatus;
}> {
  return tx.claimFile.create({
    data,
    select: {
      id: true,
      fileName: true,
      fileType: true,
      status: true,
    },
  });
}

export async function deletePendingClaimFiles(
  tx: Prisma.TransactionClient,
  ids: string[],
): Promise<void> {
  await tx.pendingClaimFile.deleteMany({ where: { id: { in: ids } } });
}

export async function createClaimHistory(
  tx: Prisma.TransactionClient,
  data: {
    claimId: string;
    fromStatus?: ClaimStatus | null;
    toStatus: ClaimStatus;
    reason?: string;
    notes?: string;
    createdById: string;
  },
): Promise<void> {
  await tx.claimHistory.create({ data });
}

export async function updateClaimById(
  tx: Prisma.TransactionClient,
  claimId: string,
  data: Prisma.ClaimUncheckedUpdateInput,
): Promise<ClaimDetail> {
  return tx.claim.update({
    where: { id: claimId },
    data,
    select: CLAIM_DETAIL_SELECT,
  });
}

export async function getClaimStatus(
  tx: Prisma.TransactionClient,
  claimId: string,
): Promise<{ id: string; status: ClaimStatus } | null> {
  return tx.claim.findUnique({
    where: { id: claimId },
    select: { id: true, status: true },
  });
}
