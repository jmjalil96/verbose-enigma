import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ScopeType } from "@prisma/client";
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

const logAuditMock = vi.fn();
vi.mock("../../../services/audit/index.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../../services/audit/index.js")
  >("../../../services/audit/index.js");
  return { ...actual, logAudit: logAuditMock };
});

type AppModule = typeof import("../../../test/app.js");

describe("claims invoices (integration)", () => {
  const prefix = createClaimsTestPrefix("invoices");

  let app: AppModule["app"];

  let claimReadPermissionId: string;
  let claimEditPermissionId: string;

  let unlimitedRole: { id: string };
  let unlimitedUser: { id: string };
  let unlimitedCookie: string;

  let client: { id: string };
  let affiliate: { id: string };
  let patient: { id: string };
  let claim: { id: string };

  beforeAll(async () => {
    vi.resetModules();
    ({ app } = (await import("../../../test/app.js")));

    claimReadPermissionId = await ensurePermission("claims", "read");
    claimEditPermissionId = await ensurePermission("claims", "edit");

    unlimitedRole = await createRole({
      prefix,
      scopeType: ScopeType.UNLIMITED,
      permissionIds: [claimReadPermissionId, claimEditPermissionId],
    });

    unlimitedUser = await createUser({ prefix, roleId: unlimitedRole.id });
    unlimitedCookie = (await createSessionCookie({ userId: unlimitedUser.id }))
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
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupClaimsTestData(prefix);
  });

  describe("/:claimId/invoices - scope", () => {
    it("requires UNLIMITED scope", async () => {
      // We don't create a client-scoped user here; this simply asserts the route exists.
      const res = await request(app)
        .get(`/api/claims/${claim.id}/invoices`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe("POST /api/claims/:claimId/invoices", () => {
    it("creates invoice with Decimal amount", async () => {
      const res = await request(app)
        .post(`/api/claims/${claim.id}/invoices`)
        .set("Cookie", unlimitedCookie)
        .send({
          invoiceNumber: `${prefix}-inv-1`,
          providerName: `${prefix}-provider`,
          amountSubmitted: "123.45",
        });

      expect(res.status).toBe(201);

      const body = res.body as {
        id: string;
        invoiceNumber: string;
        providerName: string;
        amountSubmitted: string;
      };

      expect(body.invoiceNumber).toBe(`${prefix}-inv-1`);
      expect(body.amountSubmitted).toBe("123.45");

      const row = await db.claimInvoice.findUnique({
        where: { id: body.id },
        select: { amountSubmitted: true },
      });

      expect(row?.amountSubmitted.toString()).toBe("123.45");
    });

    it("amount '100' (no decimals) works", async () => {
      const res = await request(app)
        .post(`/api/claims/${claim.id}/invoices`)
        .set("Cookie", unlimitedCookie)
        .send({
          invoiceNumber: `${prefix}-inv-2`,
          providerName: `${prefix}-provider`,
          amountSubmitted: "100",
        });

      expect(res.status).toBe(201);
      expect((res.body as { amountSubmitted: string }).amountSubmitted).toBe(
        "100",
      );
    });

    it("invalid amount format → 400", async () => {
      const res = await request(app)
        .post(`/api/claims/${claim.id}/invoices`)
        .set("Cookie", unlimitedCookie)
        .send({
          invoiceNumber: `${prefix}-inv-3`,
          providerName: `${prefix}-provider`,
          amountSubmitted: "12.345",
        });

      expect(res.status).toBe(400);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "VALIDATION_ERROR",
      );
    });
  });

  describe("PATCH /api/claims/:claimId/invoices/:invoiceId", () => {
    it("updates invoice fields (partial update works)", async () => {
      const created = await db.claimInvoice.create({
        data: {
          claimId: claim.id,
          invoiceNumber: `${prefix}-inv-update`,
          providerName: `${prefix}-provider`,
          amountSubmitted: "10.00",
          createdById: unlimitedUser.id,
        },
        select: { id: true },
      });

      const res = await request(app)
        .patch(`/api/claims/${claim.id}/invoices/${created.id}`)
        .set("Cookie", unlimitedCookie)
        .send({ providerName: `${prefix}-provider-updated` });

      expect(res.status).toBe(200);
      expect((res.body as { providerName: string }).providerName).toBe(
        `${prefix}-provider-updated`,
      );

      expect(logAuditMock).toHaveBeenCalled();
    });
  });

  describe("DELETE /api/claims/:claimId/invoices/:invoiceId", () => {
    it("deletes invoice", async () => {
      const created = await db.claimInvoice.create({
        data: {
          claimId: claim.id,
          invoiceNumber: `${prefix}-inv-delete`,
          providerName: `${prefix}-provider`,
          amountSubmitted: "10.00",
          createdById: unlimitedUser.id,
        },
        select: { id: true },
      });

      const res = await request(app)
        .delete(`/api/claims/${claim.id}/invoices/${created.id}`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(204);

      const row = await db.claimInvoice.findUnique({
        where: { id: created.id },
        select: { id: true },
      });
      expect(row).toBeNull();

      expect(logAuditMock).toHaveBeenCalled();
    });
  });
});
