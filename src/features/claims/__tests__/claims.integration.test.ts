import { randomUUID } from "node:crypto";
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
import { CareType, ClaimStatus, ScopeType } from "@prisma/client";
import { db } from "../../../lib/db.js";
import { createSessionCookie } from "../../auth/__tests__/helpers.js";
import {
  cleanupClaimsTestData,
  createAffiliate,
  createAgent,
  createClaim,
  createClient,
  createClaimsTestPrefix,
  createPolicy,
  createRole,
  createUser,
  ensurePermission,
  assignAgentToClient,
  createInsurer,
} from "./helpers.js";

const { enqueueMock, signedUploadUrlMock, signedDownloadUrlMock } = vi.hoisted(
  () => ({
    enqueueMock: vi.fn().mockResolvedValue({ id: "job" }),
    signedUploadUrlMock: vi.fn(
      (key: string, options: { contentType?: string }) =>
        Promise.resolve({
          key,
          url: `https://signed-upload.example.com/${encodeURIComponent(key)}`,
          headers: {
            "Content-Type": options.contentType ?? "application/octet-stream",
          },
        }),
    ),
    signedDownloadUrlMock: vi.fn((key: string) =>
      Promise.resolve(
        `https://signed-download.example.com/${encodeURIComponent(key)}`,
      ),
    ),
  }),
);

vi.mock("../../../lib/jobs/index.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../../lib/jobs/index.js")
  >("../../../lib/jobs/index.js");
  return { ...actual, enqueue: enqueueMock };
});

vi.mock("../../../services/storage/index.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../../services/storage/index.js")
  >("../../../services/storage/index.js");
  return {
    ...actual,
    getSignedUploadUrl: signedUploadUrlMock,
    getSignedDownloadUrl: signedDownloadUrlMock,
  };
});

type AppModule = typeof import("../../../test/app.js");

describe("claims module (integration)", () => {
  const prefix = createClaimsTestPrefix("integration");

  let app: AppModule["app"];

  let claimReadPermissionId: string;
  let claimCreatePermissionId: string;
  let claimEditPermissionId: string;

  let clientA: { id: string };
  let clientB: { id: string };

  let unlimitedRole: { id: string };
  let clientRole: { id: string };
  let selfRole: { id: string };
  let clientEditRole: { id: string };
  let selfEditRole: { id: string };

  let unlimitedUser: { id: string };
  let clientUser: { id: string };
  let selfUser: { id: string };
  let clientEditUser: { id: string };
  let selfEditUser: { id: string };

  let unlimitedCookie: string;
  let clientCookie: string;
  let selfCookie: string;
  let clientEditCookie: string;
  let selfEditCookie: string;

  let selfAffiliate: { id: string; clientId: string };
  let otherAffiliateInClientA: { id: string; clientId: string };
  let dependentPatientForSelf: { id: string; clientId: string };
  let affiliateInClientB: { id: string; clientId: string };
  let patientInClientB: { id: string; clientId: string };

  let claimSelf: { id: string };
  let claimOtherAffiliate: { id: string };
  let claimOtherClient: { id: string };

  beforeAll(async () => {
    vi.resetModules();
    ({ app } = (await import("../../../test/app.js")));

    claimReadPermissionId = await ensurePermission("claims", "read");
    claimCreatePermissionId = await ensurePermission("claims", "create");
    claimEditPermissionId = await ensurePermission("claims", "edit");

    clientA = await createClient(prefix);
    clientB = await createClient(prefix);

    unlimitedRole = await createRole({
      prefix,
      scopeType: ScopeType.UNLIMITED,
      permissionIds: [
        claimReadPermissionId,
        claimCreatePermissionId,
        claimEditPermissionId,
      ],
    });

    clientRole = await createRole({
      prefix,
      scopeType: ScopeType.CLIENT,
      permissionIds: [claimReadPermissionId, claimCreatePermissionId],
    });

    selfRole = await createRole({
      prefix,
      scopeType: ScopeType.SELF,
      permissionIds: [claimReadPermissionId, claimCreatePermissionId],
    });

    // Roles used to verify requireScope("UNLIMITED") is enforced
    clientEditRole = await createRole({
      prefix,
      scopeType: ScopeType.CLIENT,
      permissionIds: [claimEditPermissionId],
    });

    selfEditRole = await createRole({
      prefix,
      scopeType: ScopeType.SELF,
      permissionIds: [claimEditPermissionId],
    });

    unlimitedUser = await createUser({ prefix, roleId: unlimitedRole.id });
    clientUser = await createUser({ prefix, roleId: clientRole.id });
    selfUser = await createUser({ prefix, roleId: selfRole.id });
    clientEditUser = await createUser({ prefix, roleId: clientEditRole.id });
    selfEditUser = await createUser({ prefix, roleId: selfEditRole.id });

    // Profiles / scope wiring
    const agent = await createAgent({ prefix, userId: clientUser.id });
    await assignAgentToClient({ agentId: agent.id, clientId: clientA.id });

    const agentEdit = await createAgent({ prefix, userId: clientEditUser.id });
    await assignAgentToClient({ agentId: agentEdit.id, clientId: clientA.id });

    selfAffiliate = await createAffiliate({
      prefix,
      clientId: clientA.id,
      userId: selfUser.id,
    });

    otherAffiliateInClientA = await createAffiliate({
      prefix,
      clientId: clientA.id,
    });

    dependentPatientForSelf = await createAffiliate({
      prefix,
      clientId: clientA.id,
      primaryAffiliateId: selfAffiliate.id,
    });

    affiliateInClientB = await createAffiliate({
      prefix,
      clientId: clientB.id,
    });
    patientInClientB = await createAffiliate({ prefix, clientId: clientB.id });

    // Seed claims (created by unlimited user, not subject to SELF-create constraints)
    claimSelf = await createClaim({
      prefix,
      clientId: clientA.id,
      affiliateId: selfAffiliate.id,
      patientId: otherAffiliateInClientA.id,
      createdById: unlimitedUser.id,
    });

    claimOtherAffiliate = await createClaim({
      prefix,
      clientId: clientA.id,
      affiliateId: otherAffiliateInClientA.id,
      patientId: otherAffiliateInClientA.id,
      createdById: unlimitedUser.id,
    });

    claimOtherClient = await createClaim({
      prefix,
      clientId: clientB.id,
      affiliateId: affiliateInClientB.id,
      patientId: patientInClientB.id,
      createdById: unlimitedUser.id,
    });

    unlimitedCookie = (await createSessionCookie({ userId: unlimitedUser.id }))
      .cookie;
    clientCookie = (await createSessionCookie({ userId: clientUser.id }))
      .cookie;
    selfCookie = (await createSessionCookie({ userId: selfUser.id })).cookie;
    clientEditCookie = (
      await createSessionCookie({ userId: clientEditUser.id })
    ).cookie;
    selfEditCookie = (await createSessionCookie({ userId: selfEditUser.id }))
      .cookie;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupClaimsTestData(prefix);
  });

  describe("GET /api/claims - scope filtering", () => {
    it("SELF user sees only their own claims", async () => {
      const res = await request(app)
        .get("/api/claims")
        .set("Cookie", selfCookie);

      expect(res.status).toBe(200);
      expect((res.body as { data: unknown[] }).data.length).toBeGreaterThan(0);

      const data = (res.body as { data: { affiliate: { id: string } }[] })
        .data;
      expect(new Set(data.map((c) => c.affiliate.id))).toEqual(
        new Set([selfAffiliate.id]),
      );
    });

    it("SELF user with ?affiliateId=other → 403", async () => {
      const res = await request(app)
        .get(`/api/claims?affiliateId=${otherAffiliateInClientA.id}`)
        .set("Cookie", selfCookie);

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("SELF user with ?affiliateId=self → succeeds", async () => {
      const res = await request(app)
        .get(`/api/claims?affiliateId=${selfAffiliate.id}`)
        .set("Cookie", selfCookie);

      expect(res.status).toBe(200);
      const data = (res.body as { data: { affiliate: { id: string } }[] })
        .data;
      expect(new Set(data.map((c) => c.affiliate.id))).toEqual(
        new Set([selfAffiliate.id]),
      );
    });

    it("CLIENT user sees only claims in assigned clients", async () => {
      const res = await request(app)
        .get("/api/claims")
        .set("Cookie", clientCookie);

      expect(res.status).toBe(200);
      const data = (res.body as { data: { client: { id: string } }[] })
        .data;
      expect(new Set(data.map((c) => c.client.id))).toEqual(
        new Set([clientA.id]),
      );
    });

    it("CLIENT user with ?clientId=unassigned → 403", async () => {
      const res = await request(app)
        .get(`/api/claims?clientId=${clientB.id}`)
        .set("Cookie", clientCookie);

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("UNLIMITED user sees all claims", async () => {
      const res = await request(app)
        .get("/api/claims")
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      const data = (res.body as { data: { id: string }[] }).data;
      const ids = new Set(data.map((c) => c.id));
      expect(ids.has(claimSelf.id)).toBe(true);
      expect(ids.has(claimOtherAffiliate.id)).toBe(true);
      expect(ids.has(claimOtherClient.id)).toBe(true);
    });

    it("UNLIMITED user can filter by any affiliateId", async () => {
      const res = await request(app)
        .get(`/api/claims?affiliateId=${otherAffiliateInClientA.id}`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      const data = (res.body as { data: { affiliate: { id: string } }[] })
        .data;
      expect(new Set(data.map((c) => c.affiliate.id))).toEqual(
        new Set([otherAffiliateInClientA.id]),
      );
    });
  });

  describe("GET /api/claims/:id - scope enforcement", () => {
    it("SELF user can view their own claim", async () => {
      const res = await request(app)
        .get(`/api/claims/${claimSelf.id}`)
        .set("Cookie", selfCookie);

      expect(res.status).toBe(200);
      expect((res.body as { id: string }).id).toBe(claimSelf.id);
    });

    it("SELF user cannot view other affiliate's claim → 404", async () => {
      const res = await request(app)
        .get(`/api/claims/${claimOtherAffiliate.id}`)
        .set("Cookie", selfCookie);

      expect(res.status).toBe(404);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "NOT_FOUND",
      );
    });

    it("CLIENT user can view claim in assigned client", async () => {
      const res = await request(app)
        .get(`/api/claims/${claimOtherAffiliate.id}`)
        .set("Cookie", clientCookie);

      expect(res.status).toBe(200);
      expect((res.body as { id: string }).id).toBe(claimOtherAffiliate.id);
    });

    it("CLIENT user cannot view claim in other client → 404", async () => {
      const res = await request(app)
        .get(`/api/claims/${claimOtherClient.id}`)
        .set("Cookie", clientCookie);

      expect(res.status).toBe(404);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "NOT_FOUND",
      );
    });
  });

  describe("PATCH /api/claims/:id - scope enforcement", () => {
    it("requires UNLIMITED scope → 403 for CLIENT user", async () => {
      const res = await request(app)
        .patch(`/api/claims/${claimSelf.id}`)
        .set("Cookie", clientEditCookie)
        .send({ description: `${prefix}-patched-${randomUUID().slice(0, 8)}` });

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("requires UNLIMITED scope → 403 for SELF user", async () => {
      const res = await request(app)
        .patch(`/api/claims/${claimSelf.id}`)
        .set("Cookie", selfEditCookie)
        .send({ description: `${prefix}-patched-${randomUUID().slice(0, 8)}` });

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("UNLIMITED user can update any claim", async () => {
      const newDescription = `${prefix}-patched-${randomUUID().slice(0, 8)}`;

      const res = await request(app)
        .patch(`/api/claims/${claimOtherAffiliate.id}`)
        .set("Cookie", unlimitedCookie)
        .send({ description: newDescription });

      expect(res.status).toBe(200);
      expect((res.body as { description: string }).description).toBe(
        newDescription,
      );

      const history = await db.claimHistory.findMany({
        where: { claimId: claimOtherAffiliate.id },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { toStatus: true, notes: true },
      });
      expect(history.length).toBe(1);
      expect(history[0]?.toStatus).toBe(ClaimStatus.DRAFT);
    });
  });

  describe("POST /api/claims/:id/transition - scope enforcement", () => {
    it("requires UNLIMITED scope → 403 for CLIENT user", async () => {
      const res = await request(app)
        .post(`/api/claims/${claimSelf.id}/transition`)
        .set("Cookie", clientEditCookie)
        .send({ toStatus: "IN_REVIEW" });

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("requires UNLIMITED scope → 403 for SELF user", async () => {
      const res = await request(app)
        .post(`/api/claims/${claimSelf.id}/transition`)
        .set("Cookie", selfEditCookie)
        .send({ toStatus: "IN_REVIEW" });

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });
  });

  describe("POST /api/claims", () => {
    it("creates claim with valid data", async () => {
      const res = await request(app)
        .post("/api/claims")
        .set("Cookie", unlimitedCookie)
        .send({
          clientId: clientA.id,
          affiliateId: otherAffiliateInClientA.id,
          patientId: otherAffiliateInClientA.id,
          description: `${prefix}-create-claim`,
        });

      expect(res.status).toBe(201);
      expect((res.body as { status: ClaimStatus }).status).toBe(
        ClaimStatus.DRAFT,
      );

      expect(enqueueMock).toHaveBeenCalled();
    });

    it("creates claim with pending files attached", async () => {
      const pendingFileNameA = `${prefix}-pending-a.pdf`;
      const pendingFileNameB = `${prefix}-pending-b.pdf`;

      const pendingA = await request(app)
        .post("/api/claims/pending-files/upload-url")
        .set("Cookie", unlimitedCookie)
        .send({
          fileName: pendingFileNameA,
          fileType: "INVOICE",
          contentType: "application/pdf",
          fileSize: 123,
        });

      expect(pendingA.status).toBe(201);

      const sessionKey = (pendingA.body as { sessionKey: string }).sessionKey;

      const pendingB = await request(app)
        .post("/api/claims/pending-files/upload-url")
        .set("Cookie", unlimitedCookie)
        .send({
          sessionKey,
          fileName: pendingFileNameB,
          fileType: "RECEIPT",
          contentType: "application/pdf",
          fileSize: 456,
        });

      expect(pendingB.status).toBe(201);

      const res = await request(app)
        .post("/api/claims")
        .set("Cookie", unlimitedCookie)
        .send({
          clientId: clientA.id,
          affiliateId: otherAffiliateInClientA.id,
          patientId: otherAffiliateInClientA.id,
          description: `${prefix}-create-claim-files`,
          sessionKey,
        });

      expect(res.status).toBe(201);

      const body = res.body as {
        id: string;
        files: { id: string; status: string }[];
      };
      expect(body.files.length).toBe(2);
      expect(new Set(body.files.map((f) => f.status))).toEqual(
        new Set(["PENDING"]),
      );

      // Pending rows should be deleted after claim creation
      const remainingPending = await db.pendingClaimFile.count({
        where: { fileName: { startsWith: prefix } },
      });
      expect(remainingPending).toBe(0);

      const jobs = enqueueMock.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(jobs.includes("claim.filesMigrate")).toBe(true);
      expect(jobs.includes("email.claimCreated")).toBe(true);
    });

    it("SELF user can only create for their own affiliate", async () => {
      const res = await request(app)
        .post("/api/claims")
        .set("Cookie", selfCookie)
        .send({
          clientId: clientA.id,
          affiliateId: selfAffiliate.id,
          patientId: dependentPatientForSelf.id,
          description: `${prefix}-self-create`,
        });

      expect(res.status).toBe(201);
    });

    it("SELF user creating for other affiliate → 403", async () => {
      const res = await request(app)
        .post("/api/claims")
        .set("Cookie", selfCookie)
        .send({
          clientId: clientA.id,
          affiliateId: otherAffiliateInClientA.id,
          patientId: otherAffiliateInClientA.id,
          description: `${prefix}-self-forbidden`,
        });

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("CLIENT user can create for assigned client", async () => {
      const res = await request(app)
        .post("/api/claims")
        .set("Cookie", clientCookie)
        .send({
          clientId: clientA.id,
          affiliateId: otherAffiliateInClientA.id,
          patientId: otherAffiliateInClientA.id,
          description: `${prefix}-client-create`,
        });

      expect(res.status).toBe(201);
    });

    it("validates affiliate belongs to client", async () => {
      const res = await request(app)
        .post("/api/claims")
        .set("Cookie", unlimitedCookie)
        .send({
          clientId: clientA.id,
          affiliateId: affiliateInClientB.id,
          patientId: otherAffiliateInClientA.id,
          description: `${prefix}-bad-affiliate`,
        });

      expect(res.status).toBe(400);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST",
      );
    });

    it("validates patient belongs to client", async () => {
      const res = await request(app)
        .post("/api/claims")
        .set("Cookie", unlimitedCookie)
        .send({
          clientId: clientA.id,
          affiliateId: otherAffiliateInClientA.id,
          patientId: patientInClientB.id,
          description: `${prefix}-bad-patient`,
        });

      expect(res.status).toBe(400);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST",
      );
    });

    it("enqueues EMAIL_CLAIM_CREATED job", async () => {
      await request(app)
        .post("/api/claims")
        .set("Cookie", unlimitedCookie)
        .send({
          clientId: clientA.id,
          affiliateId: otherAffiliateInClientA.id,
          patientId: otherAffiliateInClientA.id,
          description: `${prefix}-email-job`,
        });

      expect(enqueueMock).toHaveBeenCalledWith(
        "email.claimCreated",
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          claimId: expect.any(String),
          affiliateId: otherAffiliateInClientA.id,
        }),
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          jobId: expect.stringMatching(/^claim-created-email:/),
        }),
      );
    });
  });

  describe("transition / patch business rules (integration)", () => {
    it("valid transition succeeds and creates ClaimHistory record", async () => {
      const insurer = await createInsurer(prefix);
      const policy = await createPolicy({
        prefix,
        clientId: clientA.id,
        insurerId: insurer.id,
      });

      const claim = await createClaim({
        prefix,
        clientId: clientA.id,
        affiliateId: otherAffiliateInClientA.id,
        patientId: otherAffiliateInClientA.id,
        createdById: unlimitedUser.id,
        status: ClaimStatus.DRAFT,
      });

      const patchRes = await request(app)
        .patch(`/api/claims/${claim.id}`)
        .set("Cookie", unlimitedCookie)
        .send({
          policyId: policy.id,
          careType: CareType.AMBULATORY,
          diagnosis: `${prefix}-diagnosis`,
          incidentDate: "2025-01-02",
        });

      expect(patchRes.status).toBe(200);

      const transitionRes = await request(app)
        .post(`/api/claims/${claim.id}/transition`)
        .set("Cookie", unlimitedCookie)
        .send({ toStatus: "IN_REVIEW" });

      expect(transitionRes.status).toBe(200);
      expect((transitionRes.body as { status: ClaimStatus }).status).toBe(
        ClaimStatus.IN_REVIEW,
      );

      const history = await db.claimHistory.findMany({
        where: { claimId: claim.id, toStatus: ClaimStatus.IN_REVIEW },
        select: { id: true },
      });
      expect(history.length).toBe(1);
    });

    it("invalid transition → 400", async () => {
      const claim = await createClaim({
        prefix,
        clientId: clientA.id,
        affiliateId: otherAffiliateInClientA.id,
        patientId: otherAffiliateInClientA.id,
        createdById: unlimitedUser.id,
        status: ClaimStatus.DRAFT,
      });

      const res = await request(app)
        .post(`/api/claims/${claim.id}/transition`)
        .set("Cookie", unlimitedCookie)
        .send({ toStatus: "SUBMITTED" });

      expect(res.status).toBe(400);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST",
      );
    });

    it("missing required reason → 400", async () => {
      const insurer = await createInsurer(prefix);
      const policy = await createPolicy({
        prefix,
        clientId: clientA.id,
        insurerId: insurer.id,
      });

      const claim = await createClaim({
        prefix,
        clientId: clientA.id,
        affiliateId: otherAffiliateInClientA.id,
        patientId: otherAffiliateInClientA.id,
        createdById: unlimitedUser.id,
        status: ClaimStatus.IN_REVIEW,
        policyId: policy.id,
        careType: CareType.AMBULATORY,
        diagnosis: `${prefix}-diagnosis`,
        incidentDate: new Date("2025-01-02"),
      });

      const res = await request(app)
        .post(`/api/claims/${claim.id}/transition`)
        .set("Cookie", unlimitedCookie)
        .send({ toStatus: "RETURNED" });

      expect(res.status).toBe(400);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST",
      );
    });

    it("cannot edit non-editable fields in current status → 400", async () => {
      const claim = await createClaim({
        prefix,
        clientId: clientA.id,
        affiliateId: otherAffiliateInClientA.id,
        patientId: otherAffiliateInClientA.id,
        createdById: unlimitedUser.id,
        status: ClaimStatus.DRAFT,
      });

      const res = await request(app)
        .patch(`/api/claims/${claim.id}`)
        .set("Cookie", unlimitedCookie)
        .send({ amountApproved: "10.00" });

      expect(res.status).toBe(400);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST",
      );
    });

    it("cannot edit claim in terminal status → 400", async () => {
      const claim = await createClaim({
        prefix,
        clientId: clientA.id,
        affiliateId: otherAffiliateInClientA.id,
        patientId: otherAffiliateInClientA.id,
        createdById: unlimitedUser.id,
        status: ClaimStatus.CANCELLED,
      });

      const res = await request(app)
        .patch(`/api/claims/${claim.id}`)
        .set("Cookie", unlimitedCookie)
        .send({ description: `${prefix}-x` });

      expect(res.status).toBe(400);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST",
      );
    });
  });
});
