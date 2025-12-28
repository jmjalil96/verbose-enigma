import { AuditAction } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { setSessionCookie, clearSessionCookie } from "../../lib/auth/index.js";
import { UnauthorizedError } from "../../lib/errors/index.js";
import { logoutAllTransaction, revokeSession } from "./repository.js";
import type {
  AcceptInvitationBody,
  ConfirmPasswordResetBody,
  CreateInvitationBody,
  LoginBody,
  RequestPasswordResetBody,
  ResendInvitationParams,
  ValidateResetTokenParams,
  ValidateTokenParams,
} from "./schemas.js";
import {
  acceptInvitationUseCase,
  buildAcceptResponse,
  buildLoginResponse,
  confirmPasswordResetUseCase,
  createInvitationUseCase,
  loginUseCase,
  requestPasswordResetUseCase,
  resendInvitationUseCase,
  shouldLogToken,
  validateInvitationUseCase,
  validateResetTokenUseCase,
} from "./service.js";
import { logAudit } from "../../services/audit/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

export async function login(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const { email, password } = req.body as LoginBody;

  try {
    const { token, expiresAt, user } = await loginUseCase(
      email,
      password,
      req.ip,
      req.get("user-agent"),
    );

    setSessionCookie(res, token, expiresAt);

    logAudit(
      {
        action: AuditAction.LOGIN,
        resource: "user",
        resourceId: user.id,
      },
      req,
    );

    req.log.info({ userId: user.id }, "User logged in");

    res.json({
      user: buildLoginResponse(user),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    // Audit failed login attempts
    logAudit(
      {
        action: AuditAction.LOGIN_FAILED,
        resource: "user",
        metadata: { reason: "invalid_credentials" },
      },
      req,
    );
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  await revokeSession(user.session.id);
  clearSessionCookie(res);

  logAudit(
    {
      action: AuditAction.LOGOUT,
      resource: "user",
      resourceId: user.id,
    },
    req,
  );

  req.log.info({ userId: user.id }, "User logged out");
  res.status(204).end();
}

export async function logoutAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { invalidatedAt } = await logoutAllTransaction({
    userId: user.id,
    currentSessionId: user.session.id,
  });

  clearSessionCookie(res);

  logAudit(
    {
      action: AuditAction.LOGOUT,
      resource: "user",
      resourceId: user.id,
      metadata: { allSessions: true },
    },
    req,
  );

  req.log.info(
    { userId: user.id, invalidatedAt: invalidatedAt.toISOString() },
    "User logged out all sessions",
  );
  res.status(204).end();
}

// ─────────────────────────────────────────────────────────────────────────────
// Current User
// ─────────────────────────────────────────────────────────────────────────────

export function me(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  res.set("Cache-Control", "no-store");
  res.json({
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt
      ? user.emailVerifiedAt.toISOString()
      : null,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Invitation
// ─────────────────────────────────────────────────────────────────────────────

export async function createInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const body = req.body as CreateInvitationBody;

  const result = await createInvitationUseCase(user.id, body);

  logAudit(
    {
      action: AuditAction.INVITATION_SENT,
      resource: "invitation",
      resourceId: result.invitationId,
      metadata: { profileType: result.profileType, profileId: result.profileId },
    },
    req,
  );

  req.log.info(
    { invitationId: result.invitationId, profileType: result.profileType, profileId: result.profileId },
    "Invitation created",
  );

  if (shouldLogToken()) {
    req.log.info({ token: result.token }, "Invite token (dev only)");
  }

  res.status(201).json({
    invitationId: result.invitationId,
    expiresAt: result.expiresAt.toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate Token (preflight)
// ─────────────────────────────────────────────────────────────────────────────

export async function validateToken(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const { token } = req.params as unknown as ValidateTokenParams;

  const result = await validateInvitationUseCase(token);

  res.json({
    expiresAt: result.expiresAt.toISOString(),
    role: result.role,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Accept Invitation
// ─────────────────────────────────────────────────────────────────────────────

export async function acceptInvitation(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const body = req.body as AcceptInvitationBody;

  const result = await acceptInvitationUseCase(
    body,
    req.ip,
    req.get("user-agent"),
  );

  setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);

  logAudit(
    {
      action: AuditAction.INVITATION_ACCEPTED,
      resource: "invitation",
      resourceId: result.invitationId,
      metadata: { userId: result.user.id },
    },
    req,
  );

  req.log.info(
    { userId: result.user.id, invitationId: result.invitationId },
    "Invitation accepted",
  );

  res.json({
    user: buildAcceptResponse(result.user),
    expiresAt: result.sessionExpiresAt.toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Resend Invitation
// ─────────────────────────────────────────────────────────────────────────────

export async function resendInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const { id } = req.params as unknown as ResendInvitationParams;

  const result = await resendInvitationUseCase(id);

  logAudit(
    {
      action: AuditAction.INVITATION_SENT,
      resource: "invitation",
      resourceId: id,
      metadata: { resent: true },
    },
    req,
  );

  req.log.info({ invitationId: id }, "Invitation resent");

  if (shouldLogToken()) {
    req.log.info({ token: result.token }, "Invite token (dev only)");
  }

  res.json({
    invitationId: result.invitationId,
    expiresAt: result.expiresAt.toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Password Reset
// ─────────────────────────────────────────────────────────────────────────────

export async function requestPasswordReset(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const { email } = req.body as RequestPasswordResetBody;

  const result = await requestPasswordResetUseCase(email);

  if (result.userId) {
    logAudit(
      {
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        resource: "user",
        resourceId: result.userId,
      },
      req,
    );

    if (shouldLogToken() && result.token) {
      req.log.info({ token: result.token }, "Password reset token (dev only)");
    }

    req.log.info({ userId: result.userId }, "Password reset requested");
  } else {
    req.log.info("Password reset requested for unknown/inactive user");
  }

  res.json({ message: "If an account exists, you will receive an email" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate Reset Token (preflight)
// ─────────────────────────────────────────────────────────────────────────────

export async function validateResetToken(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const { token } = req.params as unknown as ValidateResetTokenParams;

  const result = await validateResetTokenUseCase(token);

  res.json({
    expiresAt: result.expiresAt.toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Password Reset
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmPasswordReset(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const { token, password } = req.body as ConfirmPasswordResetBody;

  const result = await confirmPasswordResetUseCase(token, password);

  clearSessionCookie(res);

  logAudit(
    {
      action: AuditAction.PASSWORD_CHANGED,
      resource: "user",
      resourceId: result.userId,
    },
    req,
  );

  req.log.info({ userId: result.userId }, "Password reset completed");
  res.json({ message: "Password reset successful" });
}
