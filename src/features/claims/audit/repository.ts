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
  cursor?: string;
  limit: number;
}

export async function getClaimAuditLogs(
  claimId: string,
  { cursor, limit }: GetClaimAuditLogsParams,
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
    take: limit + 1, // Fetch one extra to detect hasMore
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor item itself
    }),
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
