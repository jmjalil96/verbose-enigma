import { PolicyStatus, ScopeType } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSessionCookie } from "../../auth/__tests__/helpers.js";

type AppModule = typeof import("../../../test/app.js");
import {
  assignAgentToClient,
  cleanupClaimsTestData,
  createAffiliate,
  createAgent,
  createClient,
  createClaimsTestPrefix,
  createInsurer,
  createPolicy,
  createRole,
  createUser,
  ensurePermission,
} from "./helpers.js";

describe("claims lookups (integration)", () => {
  const prefix = createClaimsTestPrefix("lookups");
  let app: AppModule["app"];

  // Permissions
  let claimCreatePermissionId: string;
  let claimEditPermissionId: string;

  // Roles
  let unlimitedRole: { id: string };
  let clientRole: { id: string };
  let selfRole: { id: string };
  let noPermRole: { id: string };

  // Users
  let unlimitedUser: { id: string };
  let clientUser: { id: string };
  let selfUser: { id: string };
  let noPermUser: { id: string };

  // Sessions
  let unlimitedCookie: string;
  let clientCookie: string;
  let selfCookie: string;
  let noPermCookie: string;

  // Clients
  let clientA: { id: string; name: string };
  let clientB: { id: string; name: string };

  // Affiliates
  let mainAffiliate1: { id: string; clientId: string };
  let mainAffiliate2: { id: string; clientId: string };
  let dependent1: { id: string; primaryAffiliateId: string | null };
  let dependent2: { id: string; primaryAffiliateId: string | null };
  let selfAffiliate: { id: string; clientId: string };
  let affiliateInClientB: { id: string; clientId: string };

  // Policies
  let insurer: { id: string; name: string };

  beforeAll(async () => {
    ({ app } = await import("../../../test/app.js"));

    // Permissions
    claimCreatePermissionId = await ensurePermission("claims", "create");
    claimEditPermissionId = await ensurePermission("claims", "edit");

    // Roles
    unlimitedRole = await createRole({
      prefix,
      scopeType: ScopeType.UNLIMITED,
      permissionIds: [claimCreatePermissionId, claimEditPermissionId],
    });
    clientRole = await createRole({
      prefix,
      scopeType: ScopeType.CLIENT,
      permissionIds: [claimCreatePermissionId],
    });
    selfRole = await createRole({
      prefix,
      scopeType: ScopeType.SELF,
      permissionIds: [claimCreatePermissionId],
    });
    noPermRole = await createRole({
      prefix,
      scopeType: ScopeType.UNLIMITED,
      permissionIds: [],
    });

    // Users
    unlimitedUser = await createUser({ prefix, roleId: unlimitedRole.id });
    clientUser = await createUser({ prefix, roleId: clientRole.id });
    selfUser = await createUser({ prefix, roleId: selfRole.id });
    noPermUser = await createUser({ prefix, roleId: noPermRole.id });

    // Sessions
    unlimitedCookie = (await createSessionCookie({ userId: unlimitedUser.id }))
      .cookie;
    clientCookie = (await createSessionCookie({ userId: clientUser.id }))
      .cookie;
    selfCookie = (await createSessionCookie({ userId: selfUser.id })).cookie;
    noPermCookie = (await createSessionCookie({ userId: noPermUser.id }))
      .cookie;

    // Clients
    clientA = await createClient(prefix);
    clientB = await createClient(prefix);

    // Agent assignment for CLIENT scope user
    const agent = await createAgent({ prefix, userId: clientUser.id });
    await assignAgentToClient({ agentId: agent.id, clientId: clientA.id });

    // Affiliates in clientA
    mainAffiliate1 = await createAffiliate({ prefix, clientId: clientA.id });
    mainAffiliate2 = await createAffiliate({ prefix, clientId: clientA.id });
    dependent1 = await createAffiliate({
      prefix,
      clientId: clientA.id,
      primaryAffiliateId: mainAffiliate1.id,
    });
    dependent2 = await createAffiliate({
      prefix,
      clientId: clientA.id,
      primaryAffiliateId: mainAffiliate1.id,
    });

    // Self user's affiliate
    selfAffiliate = await createAffiliate({
      prefix,
      clientId: clientA.id,
      userId: selfUser.id,
    });

    // Affiliate in clientB
    affiliateInClientB = await createAffiliate({
      prefix,
      clientId: clientB.id,
    });

    // Insurers + Policies (created for policies lookup test)
    insurer = await createInsurer(prefix);
    await createPolicy({
      prefix,
      clientId: clientA.id,
      insurerId: insurer.id,
      status: PolicyStatus.ACTIVE,
    });
    await createPolicy({
      prefix,
      clientId: clientA.id,
      insurerId: insurer.id,
      status: PolicyStatus.PENDING,
    });
    await createPolicy({
      prefix,
      clientId: clientA.id,
      insurerId: insurer.id,
      status: PolicyStatus.CANCELLED,
    });
  });

  afterAll(async () => {
    await cleanupClaimsTestData(prefix);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/claims/lookups/clients
  // ───────────────────────────────────────────────────────────────────────────

  describe("GET /api/claims/lookups/clients", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/claims/lookups/clients");
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks claims:create permission", async () => {
      const res = await request(app)
        .get("/api/claims/lookups/clients")
        .set("Cookie", noPermCookie);

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("UNLIMITED user sees all active clients", async () => {
      const res = await request(app)
        .get("/api/claims/lookups/clients")
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      const body = res.body as { data: { id: string; name: string }[] };
      const ids = new Set(body.data.map((c) => c.id));
      expect(ids.has(clientA.id)).toBe(true);
      expect(ids.has(clientB.id)).toBe(true);
    });

    it("CLIENT user sees only assigned clients", async () => {
      const res = await request(app)
        .get("/api/claims/lookups/clients")
        .set("Cookie", clientCookie);

      expect(res.status).toBe(200);
      const body = res.body as { data: { id: string; name: string }[] };
      const ids = new Set(body.data.map((c) => c.id));
      expect(ids.has(clientA.id)).toBe(true);
      expect(ids.has(clientB.id)).toBe(false);
    });

    it("SELF user sees only their affiliate's client", async () => {
      const res = await request(app)
        .get("/api/claims/lookups/clients")
        .set("Cookie", selfCookie);

      expect(res.status).toBe(200);
      const body = res.body as { data: { id: string; name: string }[] };
      const ids = new Set(body.data.map((c) => c.id));
      expect(ids.has(clientA.id)).toBe(true);
      expect(ids.has(clientB.id)).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/claims/lookups/affiliates
  // ───────────────────────────────────────────────────────────────────────────

  describe("GET /api/claims/lookups/affiliates", () => {
    it("returns 400 when clientId is missing", async () => {
      const res = await request(app)
        .get("/api/claims/lookups/affiliates")
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(400);
    });

    it("UNLIMITED user can access any client's affiliates", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/affiliates?clientId=${clientA.id}`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      const body = res.body as {
        data: { id: string; firstName: string; lastName: string }[];
      };
      expect(body.data.length).toBeGreaterThan(0);
    });

    it("CLIENT user can access assigned client's affiliates", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/affiliates?clientId=${clientA.id}`)
        .set("Cookie", clientCookie);

      expect(res.status).toBe(200);
    });

    it("CLIENT user cannot access unassigned client's affiliates", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/affiliates?clientId=${clientB.id}`)
        .set("Cookie", clientCookie);

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("SELF user can access their own client's affiliates", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/affiliates?clientId=${clientA.id}`)
        .set("Cookie", selfCookie);

      expect(res.status).toBe(200);
    });

    it("SELF user cannot access other client's affiliates", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/affiliates?clientId=${clientB.id}`)
        .set("Cookie", selfCookie);

      expect(res.status).toBe(403);
    });

    it("returns only main affiliates (not dependents)", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/affiliates?clientId=${clientA.id}`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      const body = res.body as { data: { id: string }[] };
      const ids = new Set(body.data.map((a) => a.id));

      // Main affiliates should be present
      expect(ids.has(mainAffiliate1.id)).toBe(true);
      expect(ids.has(mainAffiliate2.id)).toBe(true);
      expect(ids.has(selfAffiliate.id)).toBe(true);

      // Dependents should NOT be present
      expect(ids.has(dependent1.id)).toBe(false);
      expect(ids.has(dependent2.id)).toBe(false);
    });

    it("respects limit parameter", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/affiliates?clientId=${clientA.id}&limit=1`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      const body = res.body as { data: { id: string }[] };
      expect(body.data.length).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/claims/lookups/patients
  // ───────────────────────────────────────────────────────────────────────────

  describe("GET /api/claims/lookups/patients", () => {
    it("returns 400 when affiliateId is missing", async () => {
      const res = await request(app)
        .get("/api/claims/lookups/patients")
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(400);
    });

    it("returns 404 for invalid affiliateId", async () => {
      const res = await request(app)
        .get("/api/claims/lookups/patients?affiliateId=invalid-id")
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(404);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "NOT_FOUND",
      );
    });

    it("UNLIMITED user can access any affiliate's patients", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/patients?affiliateId=${mainAffiliate1.id}`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      const body = res.body as {
        data: { id: string; primaryAffiliateId: string | null }[];
      };

      // Should include main affiliate + dependents
      const ids = new Set(body.data.map((p) => p.id));
      expect(ids.has(mainAffiliate1.id)).toBe(true);
      expect(ids.has(dependent1.id)).toBe(true);
      expect(ids.has(dependent2.id)).toBe(true);
    });

    it("CLIENT user can access affiliate in assigned client", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/patients?affiliateId=${mainAffiliate1.id}`)
        .set("Cookie", clientCookie);

      expect(res.status).toBe(200);
    });

    it("CLIENT user cannot access affiliate in other client", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/patients?affiliateId=${affiliateInClientB.id}`)
        .set("Cookie", clientCookie);

      expect(res.status).toBe(403);
    });

    it("returns main affiliate first (nulls first ordering)", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/patients?affiliateId=${mainAffiliate1.id}`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      const body = res.body as {
        data: { id: string; primaryAffiliateId: string | null }[];
      };

      // First item should be the main affiliate (null primaryAffiliateId)
      expect(body.data.length).toBeGreaterThan(0);
      const firstPatient = body.data[0];
      expect(firstPatient).toBeDefined();
      expect(firstPatient?.primaryAffiliateId).toBeNull();
      expect(firstPatient?.id).toBe(mainAffiliate1.id);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/claims/lookups/policies
  // ───────────────────────────────────────────────────────────────────────────

  describe("GET /api/claims/lookups/policies", () => {
    it("returns 400 when clientId is missing", async () => {
      const res = await request(app)
        .get("/api/claims/lookups/policies")
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(400);
    });

    it("returns 403 for CLIENT scope user", async () => {
      // Create a user with CLIENT scope + claims:edit
      const clientEditRole = await createRole({
        prefix,
        scopeType: ScopeType.CLIENT,
        permissionIds: [claimEditPermissionId],
      });
      const clientEditUser = await createUser({
        prefix,
        roleId: clientEditRole.id,
      });
      const clientEditCookie = (
        await createSessionCookie({ userId: clientEditUser.id })
      ).cookie;

      const res = await request(app)
        .get(`/api/claims/lookups/policies?clientId=${clientA.id}`)
        .set("Cookie", clientEditCookie);

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("returns 403 for SELF scope user", async () => {
      // Create a user with SELF scope + claims:edit
      const selfEditRole = await createRole({
        prefix,
        scopeType: ScopeType.SELF,
        permissionIds: [claimEditPermissionId],
      });
      const selfEditUser = await createUser({
        prefix,
        roleId: selfEditRole.id,
      });
      const selfEditCookie = (
        await createSessionCookie({ userId: selfEditUser.id })
      ).cookie;

      const res = await request(app)
        .get(`/api/claims/lookups/policies?clientId=${clientA.id}`)
        .set("Cookie", selfEditCookie);

      expect(res.status).toBe(403);
    });

    it("UNLIMITED user can access policies", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/policies?clientId=${clientA.id}`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      const body = res.body as {
        data: {
          id: string;
          policyNumber: string;
          status: string;
          insurer: { id: string; name: string };
        }[];
      };

      expect(body.data.length).toBeGreaterThanOrEqual(3);

      // Verify response shape includes insurer
      const firstPolicy = body.data[0];
      expect(firstPolicy).toBeDefined();
      expect(firstPolicy?.insurer).toBeDefined();
      expect(firstPolicy?.insurer.id).toBeDefined();
      expect(firstPolicy?.insurer.name).toBeDefined();
    });

    it("returns all policies regardless of status", async () => {
      const res = await request(app)
        .get(`/api/claims/lookups/policies?clientId=${clientA.id}`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      const body = res.body as { data: { id: string; status: string }[] };
      const statuses = new Set(body.data.map((p) => p.status));

      expect(statuses.has("ACTIVE")).toBe(true);
      expect(statuses.has("PENDING")).toBe(true);
      expect(statuses.has("CANCELLED")).toBe(true);
    });
  });
});
