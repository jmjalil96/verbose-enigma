import { randomUUID } from "node:crypto";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { AuditAction, ScopeType } from "@prisma/client";
import { db } from "../../../lib/db.js";
import { logAudit } from "../service.js";
import type { Request } from "express";

// Unique prefix for this test suite to avoid conflicts with other tests
const TEST_PREFIX = `audit-${randomUUID().slice(0, 8)}`;

describe("Audit Service", () => {
  let testRole: { id: string };
  let testUser: { id: string };

  beforeAll(async () => {
    // Create shared role for all tests (scoped to this test file)
    testRole = await db.role.create({
      data: {
        name: `${TEST_PREFIX}-role`,
        displayName: "Audit Test Role",
        scopeType: ScopeType.UNLIMITED,
      },
    });
  });

  afterAll(async () => {
    // Clean up only our scoped test data
    await db.auditLog.deleteMany({
      where: { user: { email: { startsWith: TEST_PREFIX } } },
    });
    await db.auditLog.deleteMany({
      where: { resource: { in: ["session", "user", "auth", "test", "order"] } },
    });
    await db.user.deleteMany({
      where: { email: { startsWith: TEST_PREFIX } },
    });
    await db.role.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
  });

  beforeEach(async () => {
    // Create fresh user for each test
    testUser = await db.user.create({
      data: {
        email: `${TEST_PREFIX}-user-${randomUUID()}@example.com`,
        passwordHash: "test-hash",
        roleId: testRole.id,
      },
    });
  });

  describe("logAudit", () => {
    it("should persist audit log with all fields", async () => {
      logAudit({
        action: AuditAction.LOGIN,
        resource: "session",
        resourceId: "sess-123",
        userId: testUser.id,
        ipAddress: "192.168.1.1",
        userAgent: "Test Agent",
        requestId: "req-abc",
        metadata: { browser: "chrome" },
      });

      await expect
        .poll(() => db.auditLog.findFirst({ where: { resourceId: "sess-123" } }), {
          timeout: 5000,
        })
        .not.toBeNull();

      const log = await db.auditLog.findFirst({
        where: { resourceId: "sess-123" },
      });

      expect(log).toMatchObject({
        action: AuditAction.LOGIN,
        resource: "session",
        resourceId: "sess-123",
        userId: testUser.id,
        ipAddress: "192.168.1.1",
        userAgent: "Test Agent",
        requestId: "req-abc",
        metadata: { browser: "chrome" },
      });
    });

    it("should extract context from request when not in event", async () => {
      const mockReq = {
        user: { id: testUser.id },
        ip: "10.0.0.1",
        id: "req-from-request",
        get: (header: string) =>
          header === "user-agent" ? "Request UA" : undefined,
      } as unknown as Request;

      logAudit(
        {
          action: AuditAction.LOGOUT,
          resource: "session",
          resourceId: "sess-456",
        },
        mockReq
      );

      await expect
        .poll(() => db.auditLog.findFirst({ where: { resourceId: "sess-456" } }), {
          timeout: 5000,
        })
        .not.toBeNull();

      const log = await db.auditLog.findFirst({
        where: { resourceId: "sess-456" },
      });

      expect(log).toMatchObject({
        userId: testUser.id,
        ipAddress: "10.0.0.1",
        userAgent: "Request UA",
        requestId: "req-from-request",
      });
    });

    it("should prefer event values over request values", async () => {
      const mockReq = {
        user: { id: "wrong-user" },
        ip: "1.1.1.1",
        id: "wrong-request",
        get: () => "Wrong UA",
      } as unknown as Request;

      logAudit(
        {
          action: AuditAction.CREATE,
          resource: "user",
          resourceId: "user-789",
          userId: testUser.id,
          ipAddress: "2.2.2.2",
          userAgent: "Correct UA",
          requestId: "correct-request",
        },
        mockReq
      );

      await expect
        .poll(() => db.auditLog.findFirst({ where: { resourceId: "user-789" } }), {
          timeout: 5000,
        })
        .not.toBeNull();

      const log = await db.auditLog.findFirst({
        where: { resourceId: "user-789" },
      });

      expect(log?.userId).toBe(testUser.id);
      expect(log?.ipAddress).toBe("2.2.2.2");
      expect(log?.userAgent).toBe("Correct UA");
      expect(log?.requestId).toBe("correct-request");
    });

    it("should handle anonymous actions (no user)", async () => {
      logAudit({
        action: AuditAction.LOGIN_FAILED,
        resource: "auth",
        resourceId: "attempt-001",
        ipAddress: "192.168.1.100",
      });

      await expect
        .poll(
          () => db.auditLog.findFirst({ where: { resourceId: "attempt-001" } }),
          { timeout: 5000 }
        )
        .not.toBeNull();

      const log = await db.auditLog.findFirst({
        where: { resourceId: "attempt-001" },
      });

      expect(log?.userId).toBeNull();
      expect(log?.action).toBe(AuditAction.LOGIN_FAILED);
    });

    it("should not throw on database errors", async () => {
      // Invalid FK - should not throw
      expect(() => {
        logAudit({
          action: AuditAction.LOGIN,
          resource: "session",
          userId: "non-existent-user-id",
        });
      }).not.toThrow();

      // Give time for async failure to be logged
      await new Promise((r) => setTimeout(r, 200));
    });

    it("should handle all AuditAction enum values", async () => {
      const actions = Object.values(AuditAction);

      for (const action of actions) {
        logAudit({
          action,
          resource: "test",
          resourceId: `action-${action}`,
        });
      }

      await expect
        .poll(() => db.auditLog.count({ where: { resource: "test" } }), {
          timeout: 5000,
        })
        .toBe(actions.length);
    });

    it("should store complex metadata as JSON", async () => {
      const metadata = {
        oldValue: { status: "pending" },
        newValue: { status: "approved" },
        changedFields: ["status", "updatedAt"],
        nested: { deep: { value: 123 } },
      };

      logAudit({
        action: AuditAction.UPDATE,
        resource: "order",
        resourceId: "order-555",
        metadata,
      });

      await expect
        .poll(
          () => db.auditLog.findFirst({ where: { resourceId: "order-555" } }),
          { timeout: 5000 }
        )
        .not.toBeNull();

      const log = await db.auditLog.findFirst({
        where: { resourceId: "order-555" },
      });

      expect(log?.metadata).toEqual(metadata);
    });

    it("should set userId to null when user is deleted (onDelete: SetNull)", async () => {
      // Create a separate user for this test
      const tempUser = await db.user.create({
        data: {
          email: `${TEST_PREFIX}-temp-${randomUUID()}@example.com`,
          passwordHash: "test-hash",
          roleId: testRole.id,
        },
      });

      logAudit({
        action: AuditAction.LOGIN,
        resource: "session",
        resourceId: "sess-temp",
        userId: tempUser.id,
      });

      // Wait for audit log to be created
      await expect
        .poll(
          () => db.auditLog.findFirst({ where: { resourceId: "sess-temp" } }),
          { timeout: 5000 }
        )
        .not.toBeNull();

      // Verify userId is set
      const logBefore = await db.auditLog.findFirst({
        where: { resourceId: "sess-temp" },
      });
      expect(logBefore?.userId).toBe(tempUser.id);

      // Delete the user
      await db.user.delete({ where: { id: tempUser.id } });

      // Verify audit log still exists with userId = null
      const logAfter = await db.auditLog.findFirst({
        where: { resourceId: "sess-temp" },
      });
      expect(logAfter).not.toBeNull();
      expect(logAfter?.userId).toBeNull();
      expect(logAfter?.action).toBe(AuditAction.LOGIN);
    });
  });
});
