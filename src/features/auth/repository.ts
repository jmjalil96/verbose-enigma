import type { Prisma, TokenType } from "@prisma/client";
import { db } from "../../lib/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Domain Errors (for internal control flow, not HTTP responses)
// ─────────────────────────────────────────────────────────────────────────────

export class InvitationAlreadyAcceptedError extends Error {
  constructor() {
    super("Invitation has already been accepted");
    this.name = "InvitationAlreadyAcceptedError";
  }
}

export class ProfileAlreadyLinkedError extends Error {
  constructor() {
    super("Profile is already linked to a user");
    this.name = "ProfileAlreadyLinkedError";
  }
}

export class TokenAlreadyUsedError extends Error {
  constructor() {
    super("Token has already been used");
    this.name = "TokenAlreadyUsedError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User queries
// ─────────────────────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string) {
  return db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      passwordHash: true,
      isActive: true,
      role: {
        select: {
          id: true,
          name: true,
          scopeType: true,
          permissions: {
            select: {
              permission: {
                select: {
                  resource: true,
                  action: true,
                },
              },
            },
          },
        },
      },
      employee: { select: { firstName: true, lastName: true } },
      agent: { select: { firstName: true, lastName: true } },
      clientAdmin: { select: { firstName: true, lastName: true } },
      affiliate: { select: { firstName: true, lastName: true } },
    },
  });
}

export async function isEmailInUse(email: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session queries
// ─────────────────────────────────────────────────────────────────────────────

export async function createSession(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}) {
  return db.session.create({
    data: {
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    },
  });
}

export async function revokeSession(sessionId: string) {
  // Idempotent: only revokes if not already revoked
  return db.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function invalidateAllUserSessions(
  userId: string,
  timestamp: Date,
) {
  return db.user.update({
    where: { id: userId },
    data: { sessionsInvalidBefore: timestamp },
  });
}

/**
 * Invalidate all user sessions and revoke current session atomically.
 */
export async function logoutAllTransaction(data: {
  userId: string;
  currentSessionId: string;
}) {
  return db.$transaction(async (tx) => {
    const now = new Date();

    // 1. Invalidate all sessions via timestamp
    await tx.user.update({
      where: { id: data.userId },
      data: { sessionsInvalidBefore: now },
    });

    // 2. Revoke current session explicitly
    await tx.session.updateMany({
      where: { id: data.currentSessionId, revokedAt: null },
      data: { revokedAt: now },
    });

    return { invalidatedAt: now };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Role queries
// ─────────────────────────────────────────────────────────────────────────────

export async function findRoleById(id: string) {
  return db.role.findUnique({
    where: { id },
    select: { id: true, name: true, displayName: true, scopeType: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile queries
// ─────────────────────────────────────────────────────────────────────────────

export async function findEmployeeById(id: string) {
  return db.employee.findUnique({
    where: { id },
    select: { id: true, email: true, userId: true, isActive: true },
  });
}

export async function findAgentById(id: string) {
  return db.agent.findUnique({
    where: { id },
    select: { id: true, email: true, userId: true, isActive: true },
  });
}

export async function findClientAdminById(id: string) {
  return db.clientAdmin.findUnique({
    where: { id },
    select: { id: true, email: true, userId: true, isActive: true },
  });
}

export async function findAffiliateById(id: string) {
  return db.affiliate.findUnique({
    where: { id },
    select: { id: true, email: true, userId: true, isActive: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Invitation queries
// ─────────────────────────────────────────────────────────────────────────────

export async function findInvitationByTokenHash(tokenHash: string) {
  return db.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      roleId: true,
      expiresAt: true,
      acceptedAt: true,
      employeeId: true,
      agentId: true,
      clientAdminId: true,
      affiliateId: true,
      role: {
        select: { id: true, name: true, displayName: true, scopeType: true },
      },
    },
  });
}

export async function findInvitationById(id: string) {
  return db.invitation.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      roleId: true,
      expiresAt: true,
      acceptedAt: true,
      employeeId: true,
      agentId: true,
      clientAdminId: true,
      affiliateId: true,
    },
  });
}

export async function upsertInvitation(data: {
  tokenHash: string;
  email: string;
  roleId: string;
  expiresAt: Date;
  profileType: "employee" | "agent" | "clientAdmin" | "affiliate";
  profileId: string;
  createdById: string;
}) {
  // Build where clause based on profile type
  const getWhereClause = (): Prisma.InvitationWhereUniqueInput => {
    switch (data.profileType) {
      case "employee":
        return { employeeId: data.profileId };
      case "agent":
        return { agentId: data.profileId };
      case "clientAdmin":
        return { clientAdminId: data.profileId };
      case "affiliate":
        return { affiliateId: data.profileId };
    }
  };

  // Build create data based on profile type
  const getCreateData = (): Prisma.InvitationCreateInput => {
    const base = {
      tokenHash: data.tokenHash,
      email: data.email,
      role: { connect: { id: data.roleId } },
      expiresAt: data.expiresAt,
      createdBy: { connect: { id: data.createdById } },
    };

    switch (data.profileType) {
      case "employee":
        return { ...base, employee: { connect: { id: data.profileId } } };
      case "agent":
        return { ...base, agent: { connect: { id: data.profileId } } };
      case "clientAdmin":
        return { ...base, clientAdmin: { connect: { id: data.profileId } } };
      case "affiliate":
        return { ...base, affiliate: { connect: { id: data.profileId } } };
    }
  };

  return db.invitation.upsert({
    where: getWhereClause(),
    create: getCreateData(),
    update: {
      tokenHash: data.tokenHash,
      email: data.email,
      roleId: data.roleId,
      expiresAt: data.expiresAt,
    },
    select: { id: true, expiresAt: true },
  });
}

export async function rotateInvitationToken(
  id: string,
  data: { tokenHash: string; expiresAt: Date },
) {
  // Idempotent: only rotates if not yet accepted
  return db.invitation.updateMany({
    where: { id, acceptedAt: null },
    data: { tokenHash: data.tokenHash, expiresAt: data.expiresAt },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Accept invitation transaction
// Atomic: mark accepted → create user → link profile → create session
// ─────────────────────────────────────────────────────────────────────────────

export async function acceptInvitationTransaction(data: {
  invitationId: string;
  email: string;
  passwordHash: string;
  roleId: string;
  profileType: "employee" | "agent" | "clientAdmin" | "affiliate";
  profileId: string;
  sessionTokenHash: string;
  sessionExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}) {
  return db.$transaction(async (tx) => {
    const now = new Date();

    // 1. Mark invitation accepted (conditional: only if acceptedAt == null)
    const updated = await tx.invitation.updateMany({
      where: { id: data.invitationId, acceptedAt: null },
      data: { acceptedAt: now },
    });

    if (updated.count === 0) {
      throw new InvitationAlreadyAcceptedError();
    }

    // 2. Create user with emailVerifiedAt = now (invite proves email ownership)
    const user = await tx.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
        emailVerifiedAt: now,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            scopeType: true,
            permissions: {
              select: {
                permission: {
                  select: { resource: true, action: true },
                },
              },
            },
          },
        },
      },
    });

    // 3. Link profile to user (conditional: only if userId == null)
    const linkProfile = async (): Promise<{ count: number }> => {
      const where = { id: data.profileId, userId: null };
      const updateData = { userId: user.id };

      switch (data.profileType) {
        case "employee":
          return tx.employee.updateMany({ where, data: updateData });
        case "agent":
          return tx.agent.updateMany({ where, data: updateData });
        case "clientAdmin":
          return tx.clientAdmin.updateMany({ where, data: updateData });
        case "affiliate":
          return tx.affiliate.updateMany({ where, data: updateData });
      }
    };

    const linkResult = await linkProfile();

    if (linkResult.count === 0) {
      throw new ProfileAlreadyLinkedError();
    }

    // 4. Fetch profile name
    const fetchProfileName = async (): Promise<{
      firstName: string;
      lastName: string;
    } | null> => {
      const select = { firstName: true, lastName: true } as const;

      switch (data.profileType) {
        case "employee":
          return tx.employee.findUnique({ where: { id: data.profileId }, select });
        case "agent":
          return tx.agent.findUnique({ where: { id: data.profileId }, select });
        case "clientAdmin":
          return tx.clientAdmin.findUnique({ where: { id: data.profileId }, select });
        case "affiliate":
          return tx.affiliate.findUnique({ where: { id: data.profileId }, select });
      }
    };

    const profile = await fetchProfileName();

    // 5. Create session
    await tx.session.create({
      data: {
        userId: user.id,
        tokenHash: data.sessionTokenHash,
        expiresAt: data.sessionExpiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });

    return {
      user: {
        ...user,
        name: profile ? { firstName: profile.firstName, lastName: profile.lastName } : null,
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification Token queries (password reset, email verification)
// ─────────────────────────────────────────────────────────────────────────────

export async function createVerificationToken(data: {
  userId: string;
  tokenHash: string;
  type: TokenType;
  expiresAt: Date;
}) {
  return db.verificationToken.create({
    data: {
      userId: data.userId,
      tokenHash: data.tokenHash,
      type: data.type,
      expiresAt: data.expiresAt,
    },
    select: { id: true, expiresAt: true },
  });
}

export async function findVerificationToken(tokenHash: string, type: TokenType) {
  return db.verificationToken.findFirst({
    where: { tokenHash, type },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Password Reset transactions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create password reset token atomically.
 * Deletes any existing unused tokens, then creates new one.
 */
export async function createPasswordResetTokenTransaction(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  return db.$transaction(async (tx) => {
    // 1. Delete any existing unused tokens for this user
    await tx.verificationToken.deleteMany({
      where: {
        userId: data.userId,
        type: "PASSWORD_RESET",
        usedAt: null,
      },
    });

    // 2. Create new token
    return tx.verificationToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        type: "PASSWORD_RESET",
        expiresAt: data.expiresAt,
      },
      select: { id: true, expiresAt: true },
    });
  });
}

/**
 * Complete password reset atomically.
 * Marks token used, updates password, invalidates all sessions.
 */

export async function resetPasswordTransaction(data: {
  tokenId: string;
  userId: string;
  passwordHash: string;
}) {
  return db.$transaction(async (tx) => {
    const now = new Date();

    // 1. Mark token used (conditional: only if usedAt == null)
    const updated = await tx.verificationToken.updateMany({
      where: { id: data.tokenId, usedAt: null },
      data: { usedAt: now },
    });

    if (updated.count === 0) {
      throw new TokenAlreadyUsedError();
    }

    // 2. Update password and invalidate all sessions
    await tx.user.update({
      where: { id: data.userId },
      data: {
        passwordHash: data.passwordHash,
        sessionsInvalidBefore: now,
      },
    });
  });
}
