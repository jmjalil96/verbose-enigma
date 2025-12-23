import { randomUUID, createHash } from "node:crypto";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { ScopeType, TokenType } from "@prisma/client";
import { db } from "../../../lib/db.js";

// Mock the email provider
const mockSend = vi.fn().mockResolvedValue(undefined);
vi.mock("../provider.js", () => ({
  getEmailProvider: () => ({ send: mockSend }),
}));

// Helper to hash tokens like the handler does
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Unique prefix for this test suite to avoid conflicts
const TEST_PREFIX = `email-handler-${randomUUID().slice(0, 8)}`;

describe("Email Handlers", () => {
  let testRole: { id: string };
  let creatorUser: { id: string }; // User who creates invitations

  beforeAll(async () => {
    // Create isolated test fixtures
    testRole = await db.role.create({
      data: {
        name: `${TEST_PREFIX}-role`,
        displayName: "Email Test Role",
        scopeType: ScopeType.UNLIMITED,
      },
    });

    creatorUser = await db.user.create({
      data: {
        email: `${TEST_PREFIX}-creator@example.com`,
        passwordHash: "test-hash",
        roleId: testRole.id,
      },
    });
  });

  afterAll(async () => {
    // Clean up only our test data
    await db.verificationToken.deleteMany({
      where: { user: { email: { startsWith: TEST_PREFIX } } },
    });
    await db.invitation.deleteMany({
      where: { email: { startsWith: TEST_PREFIX } },
    });
    await db.user.deleteMany({
      where: { email: { startsWith: TEST_PREFIX } },
    });
    await db.role.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendInviteEmail", () => {
    it("throws if invitation not found", async () => {
      const { sendInviteEmail } = await import("../handlers/invite.js");

      await expect(
        sendInviteEmail("non-existent-id", "some-token")
      ).rejects.toThrow("Invitation not found");

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns without sending if invitation already accepted", async () => {
      const invitation = await db.invitation.create({
        data: {
          email: `${TEST_PREFIX}-accepted-${randomUUID()}@example.com`,
          tokenHash: hashToken(`accepted-${randomUUID()}`),
          expiresAt: new Date(Date.now() + 86400000),
          acceptedAt: new Date(), // Already accepted
          role: { connect: { id: testRole.id } },
          createdBy: { connect: { id: creatorUser.id } },
        },
      });

      const { sendInviteEmail } = await import("../handlers/invite.js");

      // Should not throw
      await sendInviteEmail(invitation.id, "accepted-token");

      // Should not send email
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("sends email with correct params for pending invitation", async () => {
      const token = `invite-${randomUUID()}`;
      const invitation = await db.invitation.create({
        data: {
          email: `${TEST_PREFIX}-pending-${randomUUID()}@example.com`,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 86400000),
          role: { connect: { id: testRole.id } },
          createdBy: { connect: { id: creatorUser.id } },
        },
      });

      const { sendInviteEmail } = await import("../handlers/invite.js");

      await sendInviteEmail(invitation.id, token);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: invitation.email,
          subject: expect.stringContaining("Email Test Role"),
          html: expect.stringContaining(token),
          text: expect.stringContaining(token),
        })
      );
    });

    it("builds invite link with APP_URL", async () => {
      const token = `link-${randomUUID()}`;
      const invitation = await db.invitation.create({
        data: {
          email: `${TEST_PREFIX}-link-${randomUUID()}@example.com`,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 86400000),
          role: { connect: { id: testRole.id } },
          createdBy: { connect: { id: creatorUser.id } },
        },
      });

      const { sendInviteEmail } = await import("../handlers/invite.js");

      await sendInviteEmail(invitation.id, token);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(`/invite/${token}`),
          text: expect.stringContaining(`/invite/${token}`),
        })
      );
    });
  });

  describe("sendPasswordResetEmail", () => {
    let testUser: { id: string; email: string };

    beforeEach(async () => {
      testUser = await db.user.create({
        data: {
          email: `${TEST_PREFIX}-reset-${randomUUID()}@example.com`,
          passwordHash: "test-hash",
          roleId: testRole.id,
          isActive: true,
        },
      });
    });

    it("throws if user not found", async () => {
      const { sendPasswordResetEmail } = await import("../handlers/password-reset.js");

      await expect(
        sendPasswordResetEmail("non-existent-id", "some-token")
      ).rejects.toThrow("User not found");

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns without sending if user is inactive", async () => {
      const inactiveUser = await db.user.create({
        data: {
          email: `${TEST_PREFIX}-inactive-${randomUUID()}@example.com`,
          passwordHash: "test-hash",
          roleId: testRole.id,
          isActive: false,
        },
      });

      const { sendPasswordResetEmail } = await import("../handlers/password-reset.js");

      await sendPasswordResetEmail(inactiveUser.id, "some-token");

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns without sending if token was rotated/used", async () => {
      // Create a used token
      const token = `used-${randomUUID()}`;
      await db.verificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash: hashToken(token),
          type: TokenType.PASSWORD_RESET,
          expiresAt: new Date(Date.now() + 3600000),
          usedAt: new Date(), // Already used
        },
      });

      const { sendPasswordResetEmail } = await import("../handlers/password-reset.js");

      await sendPasswordResetEmail(testUser.id, token);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns without sending if token does not exist", async () => {
      const { sendPasswordResetEmail } = await import("../handlers/password-reset.js");

      // Token that was never created
      await sendPasswordResetEmail(testUser.id, "non-existent-token");

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("sends email when token exists and is unused", async () => {
      const token = `valid-${randomUUID()}`;
      await db.verificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash: hashToken(token),
          type: TokenType.PASSWORD_RESET,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      const { sendPasswordResetEmail } = await import("../handlers/password-reset.js");

      await sendPasswordResetEmail(testUser.id, token);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testUser.email,
          subject: expect.stringContaining("password"),
          html: expect.stringContaining(token),
          text: expect.stringContaining(token),
        })
      );
    });

    it("builds reset link with APP_URL", async () => {
      const token = `reset-link-${randomUUID()}`;
      await db.verificationToken.create({
        data: {
          userId: testUser.id,
          tokenHash: hashToken(token),
          type: TokenType.PASSWORD_RESET,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      const { sendPasswordResetEmail } = await import("../handlers/password-reset.js");

      await sendPasswordResetEmail(testUser.id, token);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(`/reset-password/${token}`),
          text: expect.stringContaining(`/reset-password/${token}`),
        })
      );
    });
  });
});
