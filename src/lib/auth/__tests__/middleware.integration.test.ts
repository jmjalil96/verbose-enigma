import { randomUUID, createHash } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { ScopeType } from "@prisma/client";
import { app } from "../../../test/app.js";
import { db } from "../../db.js";

// Unique prefix for this test suite
const TEST_PREFIX = `auth-mw-${randomUUID().slice(0, 8)}`;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

describe("Auth Middleware", () => {
  let testRole: { id: string };
  let testRoleWithPerms: { id: string };
  let testUser: { id: string; email: string };
  let testPermission: { id: string };

  beforeAll(async () => {
    // Create role without permissions
    testRole = await db.role.create({
      data: {
        name: `${TEST_PREFIX}-role`,
        displayName: "Auth Test Role",
        scopeType: ScopeType.UNLIMITED,
      },
    });

    // Create a permission for testing
    // Use upsert to avoid collisions with other suites that rely on the same permission
    testPermission = await db.permission.upsert({
      where: {
        resource_action: {
          resource: "users",
          action: "invite",
        },
      },
      update: {},
      create: {
        resource: "users",
        action: "invite",
      },
    });

    // Create role with permissions
    testRoleWithPerms = await db.role.create({
      data: {
        name: `${TEST_PREFIX}-role-perms`,
        displayName: "Auth Test Role With Perms",
        scopeType: ScopeType.UNLIMITED,
        permissions: {
          create: {
            permissionId: testPermission.id,
          },
        },
      },
    });

    // Create test user
    testUser = await db.user.create({
      data: {
        email: `${TEST_PREFIX}-user@example.com`,
        passwordHash: "test-hash",
        roleId: testRole.id,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    // Clean up in correct order
    await db.session.deleteMany({
      where: { user: { email: { startsWith: TEST_PREFIX } } },
    });
    await db.user.deleteMany({
      where: { email: { startsWith: TEST_PREFIX } },
    });
    await db.rolePermission.deleteMany({
      where: { role: { name: { startsWith: TEST_PREFIX } } },
    });
    await db.role.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    // Note: do not delete shared permissions; other suites may rely on them.
  });

  beforeEach(async () => {
    // Clean sessions between tests
    await db.session.deleteMany({
      where: { user: { email: { startsWith: TEST_PREFIX } } },
    });
  });

  describe("requireAuth", () => {
    it("returns 401 when no cookie provided", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
      expect((res.body as { error: { message: string } }).error.message).toBe("Authentication required");
    });

    it("returns 401 and clears cookie for invalid session token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", "session=invalid-token-that-does-not-exist");

      expect(res.status).toBe(401);
      expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");

      // Check cookie is cleared
      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(
        cookies.some(
          (c: string) =>
            c.includes("session=") &&
            (c.includes("Expires=Thu, 01 Jan 1970") || c.includes("Max-Age=0"))
        )
      ).toBe(true);
    });

    it("returns 401 for expired session", async () => {
      const token = `expired-${randomUUID()}`;
      await db.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: testUser.id,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `session=${token}`);

      expect(res.status).toBe(401);
      expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 for revoked session", async () => {
      const token = `revoked-${randomUUID()}`;
      await db.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 3600000), // Valid for 1 hour
          revokedAt: new Date(), // But revoked now
        },
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `session=${token}`);

      expect(res.status).toBe(401);
      expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 for inactive user", async () => {
      // Create inactive user
      const inactiveUser = await db.user.create({
        data: {
          email: `${TEST_PREFIX}-inactive@example.com`,
          passwordHash: "test-hash",
          roleId: testRole.id,
          isActive: false,
        },
      });

      const token = `inactive-${randomUUID()}`;
      await db.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: inactiveUser.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `session=${token}`);

      expect(res.status).toBe(401);
      expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
    });

    it("returns 200 with user data for valid session", async () => {
      const token = `valid-${randomUUID()}`;
      await db.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 3600000), // Valid for 1 hour
        },
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `session=${token}`);

      expect(res.status).toBe(200);
      expect((res.body as { id: string }).id).toBe(testUser.id);
      expect((res.body as { email: string }).email).toBe(testUser.email);
    });
  });

  describe("requirePermissions", () => {
    it("returns 403 when user lacks required permission", async () => {
      // User with testRole (no permissions)
      const token = `noperm-${randomUUID()}`;
      await db.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: testUser.id, // testUser has testRole with no permissions
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Try to create invitation (requires users:invite permission)
      const res = await request(app)
        .post("/api/auth/invitations")
        .set("Cookie", `session=${token}`)
        .send({ roleId: testRole.id, employeeId: "emp-123" });

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe("FORBIDDEN");
    });

    it("returns 200 when user has required permission", async () => {
      // Create user with permissions
      const userWithPerms = await db.user.create({
        data: {
          email: `${TEST_PREFIX}-withperms@example.com`,
          passwordHash: "test-hash",
          roleId: testRoleWithPerms.id,
          isActive: true,
        },
      });

      const token = `withperm-${randomUUID()}`;
      await db.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: userWithPerms.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Try to create invitation - should pass auth/perms check
      // Note: this might fail for other reasons (missing profile),
      // but we're testing that it's NOT a 401 or 403
      const res = await request(app)
        .post("/api/auth/invitations")
        .set("Cookie", `session=${token}`)
        .send({ roleId: testRole.id, employeeId: "emp-123" });

      // Should not be auth/permission error
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe("requireScope", () => {
    let claimsReadPermission: { id: string };
    let clientScopeRole: { id: string };
    let unlimitedScopeRoleWithClaimsRead: { id: string };

    beforeAll(async () => {
      // Create claims:read permission
      claimsReadPermission = await db.permission.upsert({
        where: {
          resource_action: {
            resource: "claims",
            action: "read",
          },
        },
        update: {},
        create: {
          resource: "claims",
          action: "read",
        },
      });

      // Create role with CLIENT scope and claims:read permission
      clientScopeRole = await db.role.create({
        data: {
          name: `${TEST_PREFIX}-client-scope`,
          displayName: "Client Scope Role",
          scopeType: ScopeType.CLIENT,
          permissions: {
            create: {
              permissionId: claimsReadPermission.id,
            },
          },
        },
      });

      // Create role with UNLIMITED scope and claims:read permission
      unlimitedScopeRoleWithClaimsRead = await db.role.create({
        data: {
          name: `${TEST_PREFIX}-unlimited-claims`,
          displayName: "Unlimited Scope With Claims Read",
          scopeType: ScopeType.UNLIMITED,
          permissions: {
            create: {
              permissionId: claimsReadPermission.id,
            },
          },
        },
      });
    });

    it("returns 403 when user scope is not UNLIMITED", async () => {
      // Create user with CLIENT scope
      const clientScopeUser = await db.user.create({
        data: {
          email: `${TEST_PREFIX}-client-scope@example.com`,
          passwordHash: "test-hash",
          roleId: clientScopeRole.id,
          isActive: true,
        },
      });

      const token = `client-scope-${randomUUID()}`;
      await db.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: clientScopeUser.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Try to list claim files (requires UNLIMITED scope)
      const res = await request(app)
        .get("/api/claims/test-claim-id/files")
        .set("Cookie", `session=${token}`);

      expect(res.status).toBe(403);
      expect((res.body as { error: { code: string } }).error.code).toBe("FORBIDDEN");
    });

    it("allows access when user has UNLIMITED scope", async () => {
      // Create user with UNLIMITED scope and claims:read permission
      const unlimitedUser = await db.user.create({
        data: {
          email: `${TEST_PREFIX}-unlimited-scope@example.com`,
          passwordHash: "test-hash",
          roleId: unlimitedScopeRoleWithClaimsRead.id,
          isActive: true,
        },
      });

      const token = `unlimited-scope-${randomUUID()}`;
      await db.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: unlimitedUser.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Try to list claim files
      // Should pass auth, permission, and scope checks
      // Will fail with 404 (claim not found) which is expected
      const res = await request(app)
        .get("/api/claims/test-claim-id/files")
        .set("Cookie", `session=${token}`);

      // Should not be auth/permission/scope error
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
