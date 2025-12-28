import type { Prisma } from "@prisma/client";
import type { SessionUser } from "../../../lib/auth/types.js";
import { ForbiddenError, NotFoundError } from "../../../lib/errors/index.js";
import {
  type AffiliateListItem,
  type ClientListItem,
  type PatientListItem,
  type PolicyListItem,
  findAffiliates,
  findAffiliateWithClient,
  findClients,
  findPatients,
  findPolicies,
  findUserAffiliate,
  getAgentClientIds,
  getClientAdminClientIds,
} from "./repository.js";
import type {
  ListAffiliatesQuery,
  ListPatientsQuery,
  ListPoliciesQuery,
} from "./schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────

export async function listClientsUseCase(
  user: SessionUser,
): Promise<ClientListItem[]> {
  const where = await buildClientsWhereClause(user);
  return findClients(where);
}

async function buildClientsWhereClause(
  user: SessionUser,
): Promise<{ isActive: true; id?: { in: string[] } }> {
  const base = { isActive: true as const };

  if (user.role.scopeType === "UNLIMITED") {
    return base;
  }

  if (user.role.scopeType === "CLIENT") {
    const [agentIds, adminIds] = await Promise.all([
      getAgentClientIds(user.id),
      getClientAdminClientIds(user.id),
    ]);
    const clientIds = [...new Set([...agentIds, ...adminIds])];
    if (clientIds.length === 0) {
      return { ...base, id: { in: [] } };
    }
    return { ...base, id: { in: clientIds } };
  }

  // SELF scope
  const affiliate = await findUserAffiliate(user.id);
  if (!affiliate) {
    throw new ForbiddenError("No affiliate profile found");
  }
  return { ...base, id: { in: [affiliate.clientId] } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Affiliates
// ─────────────────────────────────────────────────────────────────────────────

export async function listAffiliatesUseCase(
  user: SessionUser,
  query: ListAffiliatesQuery,
): Promise<AffiliateListItem[]> {
  await verifyClientAccess(user, query.clientId);

  const where = buildAffiliatesWhereClause(query);
  return findAffiliates(where, query.limit);
}

async function verifyClientAccess(
  user: SessionUser,
  clientId: string,
): Promise<void> {
  if (user.role.scopeType === "UNLIMITED") {
    return;
  }

  if (user.role.scopeType === "CLIENT") {
    const [agentIds, adminIds] = await Promise.all([
      getAgentClientIds(user.id),
      getClientAdminClientIds(user.id),
    ]);
    const clientIds = [...new Set([...agentIds, ...adminIds])];
    if (!clientIds.includes(clientId)) {
      throw new ForbiddenError("Not authorized for this client");
    }
    return;
  }

  // SELF scope
  const affiliate = await findUserAffiliate(user.id);
  if (affiliate?.clientId !== clientId) {
    throw new ForbiddenError("Not authorized for this client");
  }
}

function buildAffiliatesWhereClause(
  query: ListAffiliatesQuery,
): Prisma.AffiliateWhereInput {
  const where: Prisma.AffiliateWhereInput = {
    clientId: query.clientId,
    isActive: true,
    primaryAffiliateId: null,
  };

  if (query.q) {
    where.OR = [
      { firstName: { contains: query.q, mode: "insensitive" } },
      { lastName: { contains: query.q, mode: "insensitive" } },
    ];
  }

  return where;
}

// ─────────────────────────────────────────────────────────────────────────────
// Patients
// ─────────────────────────────────────────────────────────────────────────────

export async function listPatientsUseCase(
  user: SessionUser,
  query: ListPatientsQuery,
): Promise<PatientListItem[]> {
  const affiliate = await findAffiliateWithClient(query.affiliateId);
  if (!affiliate?.isActive) {
    throw new NotFoundError("Affiliate not found");
  }

  await verifyClientAccess(user, affiliate.clientId);

  return findPatients(query.affiliateId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Policies
// ─────────────────────────────────────────────────────────────────────────────

export async function listPoliciesUseCase(
  user: SessionUser,
  query: ListPoliciesQuery,
): Promise<PolicyListItem[]> {
  if (user.role.scopeType !== "UNLIMITED") {
    throw new ForbiddenError("Not authorized to view policies");
  }

  return findPolicies(query.clientId);
}
