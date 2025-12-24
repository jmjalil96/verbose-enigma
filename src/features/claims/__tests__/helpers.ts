import { randomUUID } from "node:crypto";
import {
  AuditAction,
  ScopeType,
  type ClaimStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "../../../lib/db.js";

export function createClaimsTestPrefix(label: string): string {
  return `claims-${label}-${randomUUID().slice(0, 8)}`;
}

export async function ensurePermission(
  resource: string,
  action: string,
): Promise<string> {
  const permission = await db.permission.upsert({
    where: { resource_action: { resource, action } },
    update: {},
    create: { resource, action },
    select: { id: true },
  });
  return permission.id;
}

export async function createRole(params: {
  prefix: string;
  scopeType: ScopeType;
  permissionIds: string[];
}) {
  return db.role.create({
    data: {
      name: `${params.prefix}-role-${randomUUID().slice(0, 8)}`,
      displayName: "Claims Test Role",
      scopeType: params.scopeType,
      permissions: {
        create: params.permissionIds.map((permissionId) => ({ permissionId })),
      },
    },
    select: { id: true, scopeType: true },
  });
}

export async function createUser(params: {
  prefix: string;
  roleId: string;
  isActive?: boolean;
}) {
  return db.user.create({
    data: {
      email: `${params.prefix}-user-${randomUUID().slice(0, 8)}@example.com`,
      passwordHash: "test-hash",
      roleId: params.roleId,
      isActive: params.isActive ?? true,
    },
    select: { id: true, email: true },
  });
}

export async function createClient(prefix: string) {
  return db.client.create({
    data: {
      name: `${prefix}-client-${randomUUID().slice(0, 8)}`,
      isActive: true,
    },
    select: { id: true, name: true },
  });
}

export async function createAffiliate(params: {
  prefix: string;
  clientId: string;
  userId?: string;
  primaryAffiliateId?: string;
}) {
  return db.affiliate.create({
    data: {
      firstName: `${params.prefix}-affiliate`,
      lastName: randomUUID().slice(0, 8),
      clientId: params.clientId,
      ...(params.userId && { userId: params.userId }),
      ...(params.primaryAffiliateId && {
        primaryAffiliateId: params.primaryAffiliateId,
      }),
      isActive: true,
    },
    select: {
      id: true,
      clientId: true,
      userId: true,
      primaryAffiliateId: true,
    },
  });
}

export async function createAgent(params: { prefix: string; userId: string }) {
  return db.agent.create({
    data: {
      firstName: "Test",
      lastName: "Agent",
      email: `${params.prefix}-agent-${randomUUID().slice(0, 8)}@example.com`,
      userId: params.userId,
      isActive: true,
    },
    select: { id: true, userId: true, email: true },
  });
}

export async function assignAgentToClient(params: {
  agentId: string;
  clientId: string;
}) {
  return db.agentClient.create({
    data: {
      agentId: params.agentId,
      clientId: params.clientId,
    },
    select: { agentId: true, clientId: true },
  });
}

export async function createInsurer(prefix: string) {
  return db.insurer.create({
    data: {
      name: `${prefix}-insurer-${randomUUID().slice(0, 8)}`,
      type: "MEDICINA_PREPAGADA",
      isActive: true,
    },
    select: { id: true, name: true },
  });
}

export async function createPolicy(params: {
  prefix: string;
  clientId: string;
  insurerId: string;
}) {
  const startDate = new Date("2025-01-01");
  const endDate = new Date("2026-01-01");

  return db.policy.create({
    data: {
      policyNumber: `${params.prefix}-policy-${randomUUID().slice(0, 8)}`,
      clientId: params.clientId,
      insurerId: params.insurerId,
      startDate,
      endDate,
    },
    select: { id: true, policyNumber: true, clientId: true },
  });
}

async function nextClaimNumber(): Promise<number> {
  const counter = await db.globalCounter.upsert({
    where: { id: "claim_number" },
    create: { id: "claim_number", value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return counter.value;
}

export async function createClaim(params: {
  prefix: string;
  clientId: string;
  affiliateId: string;
  patientId: string;
  createdById: string;
  status?: ClaimStatus;
  policyId?: string | null;
  careType?: Prisma.ClaimUncheckedCreateInput["careType"];
  diagnosis?: string | null;
  incidentDate?: Date | null;
  amountSubmitted?: Prisma.ClaimUncheckedCreateInput["amountSubmitted"];
  submittedDate?: Date | null;
}) {
  const claimNumber = await nextClaimNumber();

  return db.claim.create({
    data: {
      claimNumber,
      clientId: params.clientId,
      affiliateId: params.affiliateId,
      patientId: params.patientId,
      description: `${params.prefix}-claim-${randomUUID().slice(0, 8)}`,
      createdById: params.createdById,
      status: params.status ?? "DRAFT",
      ...(params.policyId !== undefined && { policyId: params.policyId }),
      ...(params.careType !== undefined && { careType: params.careType }),
      ...(params.diagnosis !== undefined && { diagnosis: params.diagnosis }),
      ...(params.incidentDate !== undefined && {
        incidentDate: params.incidentDate,
      }),
      ...(params.amountSubmitted !== undefined && {
        amountSubmitted: params.amountSubmitted,
      }),
      ...(params.submittedDate !== undefined && {
        submittedDate: params.submittedDate,
      }),
    } satisfies Prisma.ClaimUncheckedCreateInput,
    select: {
      id: true,
      claimNumber: true,
      status: true,
      clientId: true,
      affiliateId: true,
    },
  });
}

export async function createAuditLog(params: {
  action: AuditAction;
  resource: string;
  claimId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}) {
  return db.auditLog.create({
    data: {
      action: params.action,
      resource: params.resource,
      resourceId: params.resource === "claim" ? params.claimId : null,
      ...(params.userId && { user: { connect: { id: params.userId } } }),
      ...(params.metadata && {
        metadata: params.metadata as Prisma.InputJsonObject,
      }),
    },
    select: { id: true },
  });
}

export async function cleanupClaimsTestData(prefix: string): Promise<void> {
  // Identify claims first (used to cleanup audit logs too)
  const claims = await db.claim.findMany({
    where: { description: { startsWith: prefix } },
    select: { id: true },
  });

  for (const { id } of claims) {
    await db.auditLog.deleteMany({ where: { resourceId: id } });
    await db.auditLog.deleteMany({
      where: {
        resource: { in: ["claimFile", "claimInvoice"] },
        metadata: { path: ["claimId"], equals: id },
      },
    });
  }

  // Domain cleanup (FK-safe order)
  await db.pendingClaimFile.deleteMany({
    where: { fileName: { startsWith: prefix } },
  });

  await db.claim.deleteMany({
    where: { description: { startsWith: prefix } },
  });

  await db.claimFile.deleteMany({
    where: { fileName: { startsWith: prefix } },
  });
  await db.claimInvoice.deleteMany({
    where: { invoiceNumber: { startsWith: prefix } },
  });

  await db.policy.deleteMany({
    where: { policyNumber: { startsWith: prefix } },
  });
  await db.insurer.deleteMany({ where: { name: { startsWith: prefix } } });

  await db.affiliate.deleteMany({
    where: { firstName: { startsWith: `${prefix}-affiliate` } },
  });

  await db.agentClient.deleteMany({
    where: { agent: { email: { startsWith: prefix } } },
  });
  await db.agent.deleteMany({ where: { email: { startsWith: prefix } } });

  await db.session.deleteMany({
    where: { user: { email: { startsWith: prefix } } },
  });
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });

  await db.rolePermission.deleteMany({
    where: { role: { name: { startsWith: prefix } } },
  });
  await db.role.deleteMany({ where: { name: { startsWith: prefix } } });

  await db.client.deleteMany({ where: { name: { startsWith: prefix } } });
}
