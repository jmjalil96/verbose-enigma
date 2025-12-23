import { AuditAction, Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { setSessionCookie, clearSessionCookie } from "../../lib/auth/index.js";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../../lib/errors/index.js";
import { enqueue, JobType } from "../../lib/jobs/index.js";
import {
  acceptInvitationTransaction,
  createPasswordResetTokenTransaction,
  findInvitationById,
  findInvitationByTokenHash,
  findUserByEmail,
  findVerificationToken,
  InvitationAlreadyAcceptedError,
  isEmailInUse,
  logoutAllTransaction,
  ProfileAlreadyLinkedError,
  resetPasswordTransaction,
  revokeSession,
  rotateInvitationToken,
  TokenAlreadyUsedError,
  upsertInvitation,
} from "./repository.js";
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
  buildAcceptResponse,
  buildLoginResponse,
  createUserSession,
  DUMMY_HASH,
  findProfileById,
  generateInviteToken,
  generateResetToken,
  getInviteExpiry,
  getPasswordResetExpiry,
  getProfileType,
  getProfileTypeFromInvitation,
  getSessionExpiry,
  hashPassword,
  hashToken,
  normalizeEmail,
  shouldLogToken,
  validateProfileForInvite,
  validateRoleExists,
  verifyPassword,
} from "./service.js";
import { logAudit } from "../../services/audit/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { password } = req.body as LoginBody;
  const email = normalizeEmail((req.body as LoginBody).email);

  const user = await findUserByEmail(email);

  // Prevent timing attacks: always verify to ensure uniform response time
  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    logAudit(
      {
        action: AuditAction.LOGIN_FAILED,
        resource: "user",
        metadata: { reason: "user_not_found" },
      },
      req,
    );
    next(new UnauthorizedError("Invalid credentials"));
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!user.isActive || !valid) {
    logAudit(
      {
        action: AuditAction.LOGIN_FAILED,
        resource: "user",
        resourceId: user.id,
        metadata: { reason: user.isActive ? "invalid_password" : "user_inactive" },
      },
      req,
    );
    next(new UnauthorizedError("Invalid credentials"));
    return;
  }

  const { token, expiresAt } = await createUserSession(
    user.id,
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
  const { roleId, email } = body;

  // Validate role exists
  await validateRoleExists(roleId);

  // Extract profile type and ID
  const { type, id } = getProfileType(body);

  // Load profile
  const profile = await findProfileById(type, id);
  if (!profile) {
    next(new NotFoundError("Profile not found"));
    return;
  }

  // Validate profile and determine invite email
  const inviteEmail = validateProfileForInvite(profile, type, email);

  // Check email not already in use by existing User
  if (await isEmailInUse(inviteEmail)) {
    next(new ConflictError("Email already in use"));
    return;
  }

  // Generate token
  const token = generateInviteToken();
  const tokenHash = hashToken(token);
  const expiresAt = getInviteExpiry();

  // Upsert invitation (create or rotate)
  const invitation = await upsertInvitation({
    tokenHash,
    email: inviteEmail,
    roleId,
    expiresAt,
    profileType: type,
    profileId: id,
    createdById: user.id,
  });

  logAudit(
    {
      action: AuditAction.INVITATION_SENT,
      resource: "invitation",
      resourceId: invitation.id,
      metadata: { profileType: type, profileId: id },
    },
    req,
  );

  req.log.info(
    { invitationId: invitation.id, profileType: type, profileId: id },
    "Invitation created",
  );

  // Enqueue invite email
  await enqueue(
    JobType.EMAIL_SEND_INVITE,
    { invitationId: invitation.id, token },
    { jobId: `invite-email:${invitation.id}` },
  );

  // Dev-only: log token for testing
  if (shouldLogToken()) {
    req.log.info({ token }, "Invite token (dev only)");
  }

  res.status(201).json({
    invitationId: invitation.id,
    expiresAt: expiresAt.toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate Token (preflight)
// ─────────────────────────────────────────────────────────────────────────────

export async function validateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { token } = req.params as unknown as ValidateTokenParams;
  const tokenHash = hashToken(token);

  const invitation = await findInvitationByTokenHash(tokenHash);

  // Generic error for all failure cases (don't leak "already accepted" info)
  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.expiresAt <= new Date()
  ) {
    next(new NotFoundError("Invalid or expired invitation"));
    return;
  }

  res.json({
    expiresAt: invitation.expiresAt.toISOString(),
    role: {
      displayName: invitation.role.displayName,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Accept Invitation
// ─────────────────────────────────────────────────────────────────────────────

export async function acceptInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { token, password } = req.body as AcceptInvitationBody;
  const tokenHash = hashToken(token);

  const invitation = await findInvitationByTokenHash(tokenHash);

  // Generic error for all failure cases
  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.expiresAt <= new Date()
  ) {
    next(new NotFoundError("Invalid or expired invitation"));
    return;
  }

  // Normalize email from invitation
  const email = normalizeEmail(invitation.email);

  // Check email not taken (pre-transaction guard)
  if (await isEmailInUse(email)) {
    next(new ConflictError("Email already in use"));
    return;
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Extract profile info from invitation
  const { type: profileType, id: profileId } =
    getProfileTypeFromInvitation(invitation);

  // Generate session token
  const sessionToken = generateInviteToken();
  const sessionTokenHash = hashToken(sessionToken);
  const sessionExpiresAt = getSessionExpiry();

  // Execute transaction
  try {
    const { user } = await acceptInvitationTransaction({
      invitationId: invitation.id,
      email,
      passwordHash,
      roleId: invitation.roleId,
      profileType,
      profileId,
      sessionTokenHash,
      sessionExpiresAt,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    setSessionCookie(res, sessionToken, sessionExpiresAt);

    logAudit(
      {
        action: AuditAction.INVITATION_ACCEPTED,
        resource: "invitation",
        resourceId: invitation.id,
        metadata: { userId: user.id },
      },
      req,
    );

    req.log.info(
      { userId: user.id, invitationId: invitation.id },
      "Invitation accepted",
    );

    res.json({
      user: buildAcceptResponse(user),
      expiresAt: sessionExpiresAt.toISOString(),
    });
  } catch (err) {
    // Handle race conditions from transaction
    if (err instanceof InvitationAlreadyAcceptedError) {
      next(new NotFoundError("Invalid or expired invitation"));
      return;
    }
    if (err instanceof ProfileAlreadyLinkedError) {
      next(new ConflictError("Profile already has a user account"));
      return;
    }

    // Prisma unique constraint violation (P2002) on User.email
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      next(new ConflictError("Email already in use"));
      return;
    }

    throw err;
  }
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

  const invitation = await findInvitationById(id);
  if (!invitation) {
    next(new NotFoundError("Invitation not found"));
    return;
  }

  if (invitation.acceptedAt) {
    next(new ConflictError("Invitation already accepted"));
    return;
  }

  // Rotate token
  const token = generateInviteToken();
  const tokenHash = hashToken(token);
  const expiresAt = getInviteExpiry();

  const result = await rotateInvitationToken(id, { tokenHash, expiresAt });

  // Race condition: already accepted between check and update
  if (result.count === 0) {
    next(new ConflictError("Invitation already accepted"));
    return;
  }

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

  // Enqueue invite email (new token = new jobId, no collision with old)
  await enqueue(
    JobType.EMAIL_SEND_INVITE,
    { invitationId: id, token },
    { jobId: `invite-email:${id}:${String(Date.now())}` },
  );

  // Dev-only: log token for testing
  if (shouldLogToken()) {
    req.log.info({ token }, "Invite token (dev only)");
  }

  res.json({
    invitationId: id,
    expiresAt: expiresAt.toISOString(),
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
  const email = normalizeEmail((req.body as RequestPasswordResetBody).email);

  const user = await findUserByEmail(email);

  // Timing-safe: always do dummy work when user not found or inactive
  if (!user?.isActive) {
    // Simulate work to prevent timing attacks
    await hashPassword("dummy-timing-safe-work");
    req.log.info("Password reset requested for unknown/inactive user");
    res.json({ message: "If an account exists, you will receive an email" });
    return;
  }

  // Generate new token and create atomically (deletes old unused tokens first)
  const token = generateResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = getPasswordResetExpiry();

  await createPasswordResetTokenTransaction({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  // Enqueue email (after transaction commits)
  await enqueue(
    JobType.EMAIL_SEND_PASSWORD_RESET,
    { userId: user.id, token },
    { jobId: `password-reset:${user.id}:${String(Date.now())}` },
  );

  // Audit log
  logAudit(
    {
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      resource: "user",
      resourceId: user.id,
    },
    req,
  );

  // Dev-only: log token for testing
  if (shouldLogToken()) {
    req.log.info({ token }, "Password reset token (dev only)");
  }

  req.log.info({ userId: user.id }, "Password reset requested");
  res.json({ message: "If an account exists, you will receive an email" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate Reset Token (preflight)
// ─────────────────────────────────────────────────────────────────────────────

export async function validateResetToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { token } = req.params as unknown as ValidateResetTokenParams;
  const tokenHash = hashToken(token);

  const verificationToken = await findVerificationToken(
    tokenHash,
    "PASSWORD_RESET",
  );

  // Generic error for all failure cases
  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt <= new Date()
  ) {
    next(new NotFoundError("Invalid or expired token"));
    return;
  }

  res.json({
    expiresAt: verificationToken.expiresAt.toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Password Reset
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmPasswordReset(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { token, password } = req.body as ConfirmPasswordResetBody;
  const tokenHash = hashToken(token);

  const verificationToken = await findVerificationToken(
    tokenHash,
    "PASSWORD_RESET",
  );

  // Generic error for all failure cases
  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt <= new Date()
  ) {
    next(new NotFoundError("Invalid or expired token"));
    return;
  }

  // Hash new password
  const passwordHash = await hashPassword(password);

  // Execute transaction: mark token used, update password, invalidate sessions
  try {
    await resetPasswordTransaction({
      tokenId: verificationToken.id,
      userId: verificationToken.userId,
      passwordHash,
    });
  } catch (err) {
    // Handle race condition: token already used
    if (err instanceof TokenAlreadyUsedError) {
      next(new NotFoundError("Invalid or expired token"));
      return;
    }
    throw err;
  }

  // Clear any existing session cookie
  clearSessionCookie(res);

  // Audit log
  logAudit(
    {
      action: AuditAction.PASSWORD_CHANGED,
      resource: "user",
      resourceId: verificationToken.userId,
    },
    req,
  );

  req.log.info({ userId: verificationToken.userId }, "Password reset completed");
  res.json({ message: "Password reset successful" });
}
