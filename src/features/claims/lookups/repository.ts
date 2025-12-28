import type { Prisma } from "@prisma/client";
import { db } from "../../../lib/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────

const CLIENTS_LIST_SELECT = {
  id: true,
  name: true,
} as const;

export type ClientListItem = Prisma.ClientGetPayload<{
  select: typeof CLIENTS_LIST_SELECT;
}>;

export async function findClients(
  where: Prisma.ClientWhereInput,
): Promise<ClientListItem[]> {
  return db.client.findMany({
    where,
    select: CLIENTS_LIST_SELECT,
    orderBy: { name: "asc" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Affiliates
// ─────────────────────────────────────────────────────────────────────────────

const AFFILIATES_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
} as const;

export type AffiliateListItem = Prisma.AffiliateGetPayload<{
  select: typeof AFFILIATES_LIST_SELECT;
}>;

export async function findAffiliates(
  where: Prisma.AffiliateWhereInput,
  limit: number,
): Promise<AffiliateListItem[]> {
  return db.affiliate.findMany({
    where,
    select: AFFILIATES_LIST_SELECT,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: limit,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Patients
// ─────────────────────────────────────────────────────────────────────────────

const PATIENTS_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  primaryAffiliateId: true,
} as const;

export type PatientListItem = Prisma.AffiliateGetPayload<{
  select: typeof PATIENTS_LIST_SELECT;
}>;

export async function findPatients(
  affiliateId: string,
): Promise<PatientListItem[]> {
  return db.affiliate.findMany({
    where: {
      isActive: true,
      OR: [{ id: affiliateId }, { primaryAffiliateId: affiliateId }],
    },
    select: PATIENTS_LIST_SELECT,
    orderBy: [
      { primaryAffiliateId: { sort: "asc", nulls: "first" } },
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });
}

export async function findAffiliateWithClient(affiliateId: string) {
  return db.affiliate.findUnique({
    where: { id: affiliateId },
    select: { id: true, clientId: true, isActive: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope lookups
// ─────────────────────────────────────────────────────────────────────────────

export async function findUserAffiliate(userId: string) {
  return db.affiliate.findUnique({
    where: { userId },
    select: { id: true, clientId: true },
  });
}

export async function getAgentClientIds(userId: string): Promise<string[]> {
  const agent = await db.agent.findUnique({
    where: { userId },
    select: {
      clients: { select: { clientId: true } },
    },
  });
  return agent?.clients.map((c) => c.clientId) ?? [];
}

export async function getClientAdminClientIds(userId: string): Promise<string[]> {
  const clientAdmin = await db.clientAdmin.findUnique({
    where: { userId },
    select: {
      clients: { select: { clientId: true } },
    },
  });
  return clientAdmin?.clients.map((c) => c.clientId) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Policies
// ─────────────────────────────────────────────────────────────────────────────

const POLICIES_LIST_SELECT = {
  id: true,
  policyNumber: true,
  type: true,
  status: true,
  startDate: true,
  endDate: true,
  insurer: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export type PolicyListItem = Prisma.PolicyGetPayload<{
  select: typeof POLICIES_LIST_SELECT;
}>;

export async function findPolicies(
  clientId: string,
): Promise<PolicyListItem[]> {
  return db.policy.findMany({
    where: { clientId },
    select: POLICIES_LIST_SELECT,
    orderBy: { policyNumber: "asc" },
  });
}
