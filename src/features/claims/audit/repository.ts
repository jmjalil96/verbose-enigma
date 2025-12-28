import { db } from "../../../lib/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Claim lookup
// ─────────────────────────────────────────────────────────────────────────────

export async function getClaimForAuditOps(claimId: string) {
  return db.claim.findUnique({
    where: { id: claimId },
    select: { id: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit logs
// ─────────────────────────────────────────────────────────────────────────────

export interface GetClaimAuditLogsParams {
  offset: number;
  limit: number;
}

export async function getClaimAuditLogs(
  claimId: string,
  { offset, limit }: GetClaimAuditLogsParams,
) {
  return db.auditLog.findMany({
    where: {
      OR: [
        { resource: "claim", resourceId: claimId },
        {
          resource: { in: ["claimFile", "claimInvoice"] },
          metadata: { path: ["claimId"], equals: claimId },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    select: {
      id: true,
      action: true,
      resource: true,
      metadata: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });
}

export async function countClaimAuditLogs(claimId: string) {
  return db.auditLog.count({
    where: {
      OR: [
        { resource: "claim", resourceId: claimId },
        {
          resource: { in: ["claimFile", "claimInvoice"] },
          metadata: { path: ["claimId"], equals: claimId },
        },
      ],
    },
  });
}
