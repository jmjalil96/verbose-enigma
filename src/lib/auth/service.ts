import { createHash } from "node:crypto";
import type { SessionUser } from "./types.js";
import type { findSessionByTokenHash } from "./repository.js";

type SessionWithUser = NonNullable<Awaited<ReturnType<typeof findSessionByTokenHash>>>;

const LAST_ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validateSession(
  session: SessionWithUser,
): { valid: true } | { valid: false; reason: string } {
  const now = new Date();

  if (session.expiresAt <= now) {
    return { valid: false, reason: "Session expired" };
  }

  if (session.revokedAt !== null) {
    return { valid: false, reason: "Session revoked" };
  }

  const { user } = session;

  if (!user.isActive) {
    return { valid: false, reason: "User inactive" };
  }

  if (
    user.sessionsInvalidBefore !== null &&
    session.createdAt <= user.sessionsInvalidBefore
  ) {
    return { valid: false, reason: "Session invalidated" };
  }

  return { valid: true };
}

export function buildSessionUser(session: SessionWithUser): SessionUser {
  const { user } = session;
  const { role } = user;

  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    role: {
      id: role.id,
      name: role.name,
      scopeType: role.scopeType,
    },
    permissions: role.permissions.map(
      (rp: { permission: { resource: string; action: string } }) =>
        `${rp.permission.resource}:${rp.permission.action}`,
    ),
    session: {
      id: session.id,
    },
  };
}

export function shouldUpdateLastActive(session: SessionWithUser): boolean {
  const elapsed = Date.now() - session.lastActiveAt.getTime();
  return elapsed > LAST_ACTIVE_THRESHOLD_MS;
}
