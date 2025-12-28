import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditAction, ScopeType } from "@prisma/client";
import { db } from "../../../lib/db.js";
import { createSessionCookie } from "../../auth/__tests__/helpers.js";
import {
  cleanupClaimsTestData,
  createAffiliate,
  createClaim,
  createClient,
  createClaimsTestPrefix,
  createRole,
  createUser,
  ensurePermission,
} from "./helpers.js";

type AppModule = typeof import("../../../test/app.js");

describe("claims audit (integration)", () => {
  const prefix = createClaimsTestPrefix("audit");

  let app: AppModule["app"];

  let claimReadPermissionId: string;

  let unlimitedRole: { id: string };
  let clientRole: { id: string };

  let unlimitedUser: { id: string };
  let clientUser: { id: string };

  let unlimitedCookie: string;
  let clientCookie: string;

  let client: { id: string };
  let affiliate: { id: string };
  let patient: { id: string };
  let claim: { id: string };
  let otherClaim: { id: string };

  beforeAll(async () => {
    ({ app } = (await import("../../../test/app.js")));

    claimReadPermissionId = await ensurePermission("claims", "read");

    unlimitedRole = await createRole({
      prefix,
      scopeType: ScopeType.UNLIMITED,
      permissionIds: [claimReadPermissionId],
    });

    clientRole = await createRole({
      prefix,
      scopeType: ScopeType.CLIENT,
      permissionIds: [claimReadPermissionId],
    });

    unlimitedUser = await createUser({ prefix, roleId: unlimitedRole.id });
    clientUser = await createUser({ prefix, roleId: clientRole.id });

    unlimitedCookie = (await createSessionCookie({ userId: unlimitedUser.id }))
      .cookie;
    clientCookie = (await createSessionCookie({ userId: clientUser.id }))
      .cookie;

    client = await createClient(prefix);
    affiliate = await createAffiliate({ prefix, clientId: client.id });
    patient = await createAffiliate({ prefix, clientId: client.id });

    claim = await createClaim({
      prefix,
      clientId: client.id,
      affiliateId: affiliate.id,
      patientId: patient.id,
      createdById: unlimitedUser.id,
    });

    otherClaim = await createClaim({
      prefix,
      clientId: client.id,
      affiliateId: affiliate.id,
      patientId: patient.id,
      createdById: unlimitedUser.id,
    });

    // Seed audit logs deterministically (avoid logAudit fire-and-forget timing)
    const t1 = new Date("2025-01-01T00:00:01.000Z");
    const t2 = new Date("2025-01-01T00:00:02.000Z");
    const t3 = new Date("2025-01-01T00:00:03.000Z");

    await db.auditLog.createMany({
      data: [
        {
          action: AuditAction.CREATE,
          resource: "claim",
          resourceId: claim.id,
          userId: unlimitedUser.id,
          metadata: { claimNumber: 123 },
          createdAt: t1,
        },
        {
          action: AuditAction.CREATE,
          resource: "claimFile",
          resourceId: null,
          userId: unlimitedUser.id,
          metadata: { claimId: claim.id, fileName: `${prefix}-file.pdf` },
          createdAt: t2,
        },
        {
          action: AuditAction.CREATE,
          resource: "claimInvoice",
          resourceId: null,
          userId: unlimitedUser.id,
          metadata: { claimId: claim.id, invoiceNumber: `${prefix}-inv` },
          createdAt: t3,
        },
      ],
    });

    await db.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        resource: "claim",
        resourceId: otherClaim.id,
        userId: unlimitedUser.id,
        metadata: { claimNumber: 999 },
        createdAt: new Date("2025-01-01T00:00:04.000Z"),
      },
    });
  });

  afterAll(async () => {
    // Clean up audit logs explicitly (not covered by prefix-based cleanup)
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { resourceId: { in: [claim.id, otherClaim.id] } },
          { metadata: { path: ["claimId"], equals: claim.id } },
        ],
      },
    });

    await cleanupClaimsTestData(prefix);
  });

  describe("GET /api/claims/:claimId/audit", () => {
    it("requires UNLIMITED scope", async () => {
      const res = await request(app)
        .get(`/api/claims/${claim.id}/audit`)
        .set("Cookie", clientCookie);

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("returns claim + claimFile + claimInvoice events", async () => {
      const res = await request(app)
        .get(`/api/claims/${claim.id}/audit?limit=10`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);

      const data = (res.body as { data: { resource: string }[] }).data;
      const resources = new Set(data.map((l) => l.resource));

      expect(resources.has("claim")).toBe(true);
      expect(resources.has("claimFile")).toBe(true);
      expect(resources.has("claimInvoice")).toBe(true);
    });

    it("does not return events from other claims", async () => {
      const res = await request(app)
        .get(`/api/claims/${claim.id}/audit?limit=10`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);

      const data = (
        res.body as { data: { metadata?: { claimNumber?: number } }[] }
      ).data;
      const hasOther = data.some((l) => l.metadata?.claimNumber === 999);
      expect(hasOther).toBe(false);
    });

    it("pagination works correctly", async () => {
      const first = await request(app)
        .get(`/api/claims/${claim.id}/audit?page=1&limit=2`)
        .set("Cookie", unlimitedCookie);

      expect(first.status).toBe(200);

      const firstBody = first.body as {
        data: { id: string }[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };

      expect(firstBody.data.length).toBe(2);
      expect(firstBody.pagination.page).toBe(1);
      expect(firstBody.pagination.limit).toBe(2);
      expect(firstBody.pagination.total).toBe(3);
      expect(firstBody.pagination.totalPages).toBe(2);

      const second = await request(app)
        .get(`/api/claims/${claim.id}/audit?page=2&limit=2`)
        .set("Cookie", unlimitedCookie);

      expect(second.status).toBe(200);
      const secondBody = second.body as {
        data: { id: string }[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };

      expect(secondBody.data.length).toBe(1);
      expect(secondBody.pagination.page).toBe(2);
      expect(secondBody.pagination.totalPages).toBe(2);
    });
  });
});
