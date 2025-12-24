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
import { ClaimFileStatus, ScopeType } from "@prisma/client";
import { db } from "../../../lib/db.js";
import { createSessionCookie } from "../../auth/__tests__/helpers.js";
import {
  assignAgentToClient,
  cleanupClaimsTestData,
  createAffiliate,
  createAgent,
  createClaim,
  createClient,
  createClaimsTestPrefix,
  createRole,
  createUser,
  ensurePermission,
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

describe("claims files (integration)", () => {
  const prefix = createClaimsTestPrefix("files");

  let app: AppModule["app"];

  let claimReadPermissionId: string;
  let claimEditPermissionId: string;

  let unlimitedRole: { id: string };
  let clientRole: { id: string };
  let selfRole: { id: string };

  let unlimitedUser: { id: string };
  let clientUser: { id: string };
  let selfUser: { id: string };

  let unlimitedCookie: string;
  let clientCookie: string;
  let selfCookie: string;

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

    clientRole = await createRole({
      prefix,
      scopeType: ScopeType.CLIENT,
      permissionIds: [claimReadPermissionId, claimEditPermissionId],
    });

    selfRole = await createRole({
      prefix,
      scopeType: ScopeType.SELF,
      permissionIds: [claimReadPermissionId, claimEditPermissionId],
    });

    unlimitedUser = await createUser({ prefix, roleId: unlimitedRole.id });
    clientUser = await createUser({ prefix, roleId: clientRole.id });
    selfUser = await createUser({ prefix, roleId: selfRole.id });

    const agent = await createAgent({ prefix, userId: clientUser.id });
    client = await createClient(prefix);
    await assignAgentToClient({ agentId: agent.id, clientId: client.id });

    affiliate = await createAffiliate({ prefix, clientId: client.id });
    patient = await createAffiliate({ prefix, clientId: client.id });

    claim = await createClaim({
      prefix,
      clientId: client.id,
      affiliateId: affiliate.id,
      patientId: patient.id,
      createdById: unlimitedUser.id,
    });

    unlimitedCookie = (await createSessionCookie({ userId: unlimitedUser.id }))
      .cookie;
    clientCookie = (await createSessionCookie({ userId: clientUser.id }))
      .cookie;
    selfCookie = (await createSessionCookie({ userId: selfUser.id })).cookie;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupClaimsTestData(prefix);
  });

  describe("POST /api/claims/pending-files/upload-url", () => {
    it("generates upload URL with correct key format", async () => {
      const res = await request(app)
        .post("/api/claims/pending-files/upload-url")
        .set("Cookie", unlimitedCookie)
        .send({
          fileName: `${prefix}-invoice.pdf`,
          fileType: "INVOICE",
          contentType: "application/pdf",
          fileSize: 123,
        });

      expect(res.status).toBe(201);

      const body = res.body as {
        sessionKey: string;
        pendingFileId: string;
        key: string;
        url: string;
      };

      expect(body.sessionKey).toBeTruthy();
      expect(body.pendingFileId).toBeTruthy();
      expect(body.key).toContain(
        `temp/claims/${unlimitedUser.id}/${body.sessionKey}/`,
      );
      expect(body.key).toContain(`${body.pendingFileId}.pdf`);
      expect(body.url).toContain("https://signed-upload.example.com/");
    });

    it("validates content-type matches extension", async () => {
      const res = await request(app)
        .post("/api/claims/pending-files/upload-url")
        .set("Cookie", unlimitedCookie)
        .send({
          fileName: `${prefix}-invoice.pdf`,
          fileType: "INVOICE",
          contentType: "image/png",
          fileSize: 123,
        });

      expect(res.status).toBe(400);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST",
      );
    });

    it("concurrent requests get unique fileKeys", async () => {
      const sessionKey = `sess-${prefix}`;

      const [r1, r2] = await Promise.all([
        request(app)
          .post("/api/claims/pending-files/upload-url")
          .set("Cookie", unlimitedCookie)
          .send({
            sessionKey,
            fileName: `${prefix}-a.pdf`,
            fileType: "INVOICE",
            contentType: "application/pdf",
            fileSize: 111,
          }),
        request(app)
          .post("/api/claims/pending-files/upload-url")
          .set("Cookie", unlimitedCookie)
          .send({
            sessionKey,
            fileName: `${prefix}-b.pdf`,
            fileType: "RECEIPT",
            contentType: "application/pdf",
            fileSize: 222,
          }),
      ]);

      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);

      expect((r1.body as { key: string }).key).not.toBe(
        (r2.body as { key: string }).key,
      );

      const rows: { fileKey: string }[] =
        await db.pendingClaimFile.findMany({
          where: { sessionKey },
          select: { fileKey: true },
        });

      expect(rows.length).toBe(2);
      expect(new Set(rows.map((row) => row.fileKey)).size).toBe(2);
    });
  });

  describe("/:claimId/files - scope", () => {
    it("requires UNLIMITED scope", async () => {
      const res = await request(app)
        .get(`/api/claims/${claim.id}/files`)
        .set("Cookie", clientCookie);

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });

    it("CLIENT/SELF users → 403", async () => {
      const res = await request(app)
        .get(`/api/claims/${claim.id}/files`)
        .set("Cookie", selfCookie);

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN",
      );
    });
  });

  describe("POST /api/claims/:claimId/files/upload-url", () => {
    it("creates file record with PENDING status and enqueues verification job", async () => {
      const res = await request(app)
        .post(`/api/claims/${claim.id}/files/upload-url`)
        .set("Cookie", unlimitedCookie)
        .send({
          fileName: `${prefix}-claimfile.pdf`,
          fileType: "INVOICE",
          contentType: "application/pdf",
          fileSize: 999,
        });

      expect(res.status).toBe(201);

      const body = res.body as { fileId: string; key: string; url: string };
      expect(body.fileId).toBeTruthy();
      expect(body.key).toContain(`clients/${client.id}/claims/${claim.id}/`);

      const file = await db.claimFile.findUnique({
        where: { id: body.fileId },
        select: { status: true, targetKey: true, deletedAt: true },
      });

      expect(file?.status).toBe(ClaimFileStatus.PENDING);
      expect(file?.targetKey).toBeTruthy();
      expect(file?.deletedAt).toBeNull();

      expect(enqueueMock).toHaveBeenCalledWith(
        "claim.fileVerify",
        { fileId: body.fileId },
        expect.objectContaining({ jobId: `claim-file-verify:${body.fileId}` }),
      );
    });
  });

  describe("GET /api/claims/:claimId/files/:fileId/download-url", () => {
    it("returns URL for READY file", async () => {
      const file = await db.claimFile.create({
        data: {
          claimId: claim.id,
          fileType: "INVOICE",
          fileName: `${prefix}-ready.pdf`,
          fileSize: 10,
          contentType: "application/pdf",
          sourceKey: "",
          targetKey: `clients/${client.id}/claims/${claim.id}/${randomUUID()}.pdf`,
          status: "READY",
          createdById: unlimitedUser.id,
        },
        select: { id: true, targetKey: true },
      });

      const res = await request(app)
        .get(`/api/claims/${claim.id}/files/${file.id}/download-url`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(200);
      expect((res.body as { url: string }).url).toContain(
        "https://signed-download.example.com/",
      );
      expect(signedDownloadUrlMock).toHaveBeenCalledWith(file.targetKey);
    });

    it("rejects PENDING file → 400", async () => {
      const file = await db.claimFile.create({
        data: {
          claimId: claim.id,
          fileType: "INVOICE",
          fileName: `${prefix}-pending.pdf`,
          fileSize: 10,
          contentType: "application/pdf",
          sourceKey: "",
          targetKey: `clients/${client.id}/claims/${claim.id}/${randomUUID()}.pdf`,
          status: "PENDING",
          createdById: unlimitedUser.id,
        },
        select: { id: true },
      });

      const res = await request(app)
        .get(`/api/claims/${claim.id}/files/${file.id}/download-url`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(400);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "BAD_REQUEST",
      );
    });

    it("rejects non-existent file → 404", async () => {
      const res = await request(app)
        .get(`/api/claims/${claim.id}/files/does-not-exist/download-url`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(404);
      expect((res.body as { error: { code: string } }).error.code).toBe(
        "NOT_FOUND",
      );
    });
  });

  describe("DELETE /api/claims/:claimId/files/:fileId", () => {
    it("soft deletes file and enqueues delete job", async () => {
      const file = await db.claimFile.create({
        data: {
          claimId: claim.id,
          fileType: "INVOICE",
          fileName: `${prefix}-todelete.pdf`,
          fileSize: 10,
          contentType: "application/pdf",
          sourceKey: "",
          targetKey: `clients/${client.id}/claims/${claim.id}/${randomUUID()}.pdf`,
          status: "READY",
          createdById: unlimitedUser.id,
        },
        select: { id: true, targetKey: true },
      });

      const res = await request(app)
        .delete(`/api/claims/${claim.id}/files/${file.id}`)
        .set("Cookie", unlimitedCookie);

      expect(res.status).toBe(204);

      const updated = await db.claimFile.findUnique({
        where: { id: file.id },
        select: { deletedAt: true },
      });
      expect(updated?.deletedAt).toBeInstanceOf(Date);

      expect(enqueueMock).toHaveBeenCalledWith(
        "claim.fileDelete",
        { fileId: file.id, targetKey: file.targetKey },
        expect.objectContaining({ jobId: `claim-file-delete:${file.id}` }),
      );
    });
  });
});
