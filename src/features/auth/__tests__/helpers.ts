import { randomUUID, createHash } from "node:crypto";
import { ScopeType, TokenType, type Prisma } from "@prisma/client";
import { db } from "../../../lib/db.js";
import { env } from "../../../lib/env.js";
import { hashPassword } from "../service.js";

export interface AuthTestContext {
  prefix: string;
  invitePermissionId: string;
}

export function createAuthTestPrefix(label: string): string {
  return `auth-${label}-${randomUUID().slice(0, 8)}`;
}

export async function ensureInvitePermission(): Promise<string> {
  const permission = await db.permission.upsert({
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
    select: { id: true },
  });
  return permission.id;
}

export async function createRole(prefix: string, opts?: { withInvitePerm?: boolean }) {
  const withInvitePerm = opts?.withInvitePerm ?? false;
  const invitePermissionId = withInvitePerm ? await ensureInvitePermission() : null;

  return db.role.create({
    data: {
      name: `${prefix}-role-${randomUUID().slice(0, 8)}`,
      displayName: "Test Role",
      scopeType: ScopeType.UNLIMITED,
      ...(invitePermissionId && {
        permissions: {
          create: {
            permissionId: invitePermissionId,
          },
        },
      }),
    },
    select: { id: true, name: true },
  });
}

export async function createUserWithPassword(params: {
  prefix: string;
  roleId: string;
  password: string;
  isActive?: boolean;
  emailVerifiedAt?: Date | null;
}) {
  const passwordHash = await hashPassword(params.password);

  return db.user.create({
    data: {
      email: `${params.prefix}-user-${randomUUID().slice(0, 8)}@example.com`,
      passwordHash,
      roleId: params.roleId,
      isActive: params.isActive ?? true,
      emailVerifiedAt: params.emailVerifiedAt ?? null,
    },
    select: { id: true, email: true },
  });
}

export async function createEmployeeProfile(params: {
  prefix: string;
  isActive?: boolean;
}) {
  return db.employee.create({
    data: {
      firstName: "Test",
      lastName: "Employee",
      email: `${params.prefix}-employee-${randomUUID().slice(0, 8)}@example.com`,
      isActive: params.isActive ?? true,
    },
    select: { id: true, email: true },
  });
}

export async function createInvitationRecord(params: {
  email: string;
  tokenHash: string;
  expiresAt: Date;
  roleId: string;
  createdById: string;
  employeeId: string;
}) {
  return db.invitation.create({
    data: {
      email: params.email,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
      role: { connect: { id: params.roleId } },
      createdBy: { connect: { id: params.createdById } },
      employee: { connect: { id: params.employeeId } },
    },
    select: { id: true },
  });
}

export async function createPasswordResetToken(params: {
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date | null;
}) {
  const tokenHash = hashToken(params.token);
  return db.verificationToken.create({
    data: {
      userId: params.userId,
      tokenHash,
      type: TokenType.PASSWORD_RESET,
      expiresAt: params.expiresAt,
      usedAt: params.usedAt ?? null,
    },
    select: { id: true, expiresAt: true },
  });
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSessionCookie(params: {
  userId: string;
  token?: string;
  expiresAt?: Date;
  revokedAt?: Date | null;
  createdAt?: Date;
}): Promise<{ token: string; cookie: string }> {
  const token = params.token ?? `sess-${randomUUID()}`;
  const tokenHash = hashToken(token);

  await db.session.create({
    // Use UncheckedCreateInput so we can set userId directly (no nested connect)
    data: {
      userId: params.userId,
      tokenHash,
      expiresAt: params.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: params.revokedAt ?? null,
      ...(params.createdAt && { createdAt: params.createdAt }),
    } satisfies Prisma.SessionUncheckedCreateInput,
  });

  return { token, cookie: `${env.SESSION_COOKIE_NAME}=${token}` };
}

export async function cleanupAuthTestData(prefix: string): Promise<void> {
  // Delete in FK-safe order. We only delete data that uses our prefix.
  await db.session.deleteMany({ where: { user: { email: { startsWith: prefix } } } });
  await db.verificationToken.deleteMany({
    where: { user: { email: { startsWith: prefix } } },
  });
  await db.invitation.deleteMany({
    where: {
      OR: [
        { email: { startsWith: prefix } },
        { createdBy: { email: { startsWith: prefix } } },
      ],
    },
  });
  await db.employee.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.rolePermission.deleteMany({
    where: { role: { name: { startsWith: prefix } } },
  });
  await db.role.deleteMany({ where: { name: { startsWith: prefix } } });
}


