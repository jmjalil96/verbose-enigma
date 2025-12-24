import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { hashToken } from "../../lib/auth/service.js";
import { env } from "../../lib/env.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../../lib/errors/index.js";
import { enqueue, JobType } from "../../lib/jobs/index.js";
import {
  acceptInvitationTransaction,
  createPasswordResetTokenTransaction,
  createSession,
  findAffiliateById,
  findAgentById,
  findClientAdminById,
  findEmployeeById,
  findInvitationById,
  findInvitationByTokenHash,
  findRoleById,
  findUserByEmail,
  findVerificationToken,
  InvitationAlreadyAcceptedError,
  isEmailInUse,
  ProfileAlreadyLinkedError,
  resetPasswordTransaction,
  rotateInvitationToken,
  TokenAlreadyUsedError,
  upsertInvitation,
} from "./repository.js";
import type { AcceptInvitationBody, CreateInvitationBody } from "./schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_DURATION_DAYS = 30;
const INVITE_TOKEN_BYTES = 32;
const INVITE_DURATION_DAYS = 7;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_DURATION_HOURS = 1;

// Valid argon2 hash for timing-safe dummy verification when user doesn't exist
// Pre-hashed value of "dummy-password-for-timing-safety"
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXlzYWx0Zm9ydGltaW5n$K8ZqPE7JDdCxXLdHJHcJmXB7L9X8B2e1R4b5R3N0Z8Y";

export { DUMMY_HASH, hashToken };

// ─────────────────────────────────────────────────────────────────────────────
// Password utilities
// ─────────────────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token utilities
// ─────────────────────────────────────────────────────────────────────────────

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString("hex");
}

export function generateResetToken(): string {
  return randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Expiry utilities
// ─────────────────────────────────────────────────────────────────────────────

export function getSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export function getInviteExpiry(): Date {
  return new Date(Date.now() + INVITE_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export function getPasswordResetExpiry(): Date {
  return new Date(Date.now() + PASSWORD_RESET_DURATION_HOURS * 60 * 60 * 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Email utilities
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Session management
// ─────────────────────────────────────────────────────────────────────────────

export async function createUserSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = getSessionExpiry();

  await createSession({
    userId,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return { token, expiresAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile type utilities
// ─────────────────────────────────────────────────────────────────────────────

export type ProfileType = "employee" | "agent" | "clientAdmin" | "affiliate";

export function getProfileType(body: CreateInvitationBody): {
  type: ProfileType;
  id: string;
} {
  if (body.employeeId) return { type: "employee", id: body.employeeId };
  if (body.agentId) return { type: "agent", id: body.agentId };
  if (body.clientAdminId) return { type: "clientAdmin", id: body.clientAdminId };
  if (body.affiliateId) return { type: "affiliate", id: body.affiliateId };
  throw new BadRequestError("Exactly one profile ID must be provided");
}

export function getProfileTypeFromInvitation(invitation: {
  employeeId: string | null;
  agentId: string | null;
  clientAdminId: string | null;
  affiliateId: string | null;
}): { type: ProfileType; id: string } {
  if (invitation.employeeId)
    return { type: "employee", id: invitation.employeeId };
  if (invitation.agentId) return { type: "agent", id: invitation.agentId };
  if (invitation.clientAdminId)
    return { type: "clientAdmin", id: invitation.clientAdminId };
  if (invitation.affiliateId)
    return { type: "affiliate", id: invitation.affiliateId };
  throw new Error("Invitation has no profile linked");
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile lookup
// ─────────────────────────────────────────────────────────────────────────────

export async function findProfileById(
  type: ProfileType,
  id: string,
): Promise<{
  id: string;
  email: string | null;
  userId: string | null;
  isActive: boolean;
} | null> {
  switch (type) {
    case "employee":
      return findEmployeeById(id);
    case "agent":
      return findAgentById(id);
    case "clientAdmin":
      return findClientAdminById(id);
    case "affiliate":
      return findAffiliateById(id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation utilities
// ─────────────────────────────────────────────────────────────────────────────

export function validateProfileForInvite(
  profile: { userId: string | null; isActive: boolean; email: string | null },
  profileType: ProfileType,
  providedEmail?: string,
): string {
  // Profile must not already be linked to a user
  if (profile.userId !== null) {
    throw new ConflictError("Profile already has a user account");
  }

  // Profile must be active
  if (!profile.isActive) {
    throw new BadRequestError("Profile is not active");
  }

  // Determine invite email
  if (profileType === "affiliate") {
    // Affiliate: use provided email or profile email
    const email = providedEmail ?? profile.email;
    if (!email) {
      throw new BadRequestError(
        "Email required for affiliate without profile email",
      );
    }
    return normalizeEmail(email);
  } else {
    // Employee/Agent/ClientAdmin: must have profile email
    if (!profile.email) {
      throw new BadRequestError("Profile does not have an email");
    }
    // If email provided, it must match profile email
    if (
      providedEmail &&
      normalizeEmail(providedEmail) !== normalizeEmail(profile.email)
    ) {
      throw new BadRequestError("Provided email does not match profile email");
    }
    return normalizeEmail(profile.email);
  }
}

export async function validateRoleExists(roleId: string): Promise<void> {
  const role = await findRoleById(roleId);
  if (!role) {
    throw new NotFoundError("Role not found");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Response builders
// ─────────────────────────────────────────────────────────────────────────────

type UserWithRole = NonNullable<Awaited<ReturnType<typeof findUserByEmail>>>;

export function buildLoginResponse(user: UserWithRole) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    role: {
      id: user.role.id,
      name: user.role.name,
      scopeType: user.role.scopeType,
    },
    permissions: user.role.permissions.map(
      (rp: { permission: { resource: string; action: string } }) =>
        `${rp.permission.resource}:${rp.permission.action}`,
    ),
  };
}

interface AcceptedUser {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  role: {
    id: string;
    name: string;
    scopeType: string;
    permissions: { permission: { resource: string; action: string } }[];
  };
}

export function buildAcceptResponse(user: AcceptedUser) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    role: {
      id: user.role.id,
      name: user.role.name,
      scopeType: user.role.scopeType,
    },
    permissions: user.role.permissions.map(
      (rp) => `${rp.permission.resource}:${rp.permission.action}`,
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Security utilities
// ─────────────────────────────────────────────────────────────────────────────

export function shouldLogToken(): boolean {
  return env.NODE_ENV !== "production";
}

// ─────────────────────────────────────────────────────────────────────────────
// Use Cases
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: UserWithRole;
}

export async function loginUseCase(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<LoginResult> {
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByEmail(normalizedEmail);

  // Timing-safe: always verify even if user not found
  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    throw new UnauthorizedError("Invalid credentials");
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!user.isActive || !valid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const { token, expiresAt } = await createUserSession(
    user.id,
    ipAddress,
    userAgent,
  );

  return { token, expiresAt, user };
}

export interface ValidateInvitationResult {
  expiresAt: Date;
  role: { displayName: string };
}

export async function validateInvitationUseCase(
  token: string,
): Promise<ValidateInvitationResult> {
  const tokenHash = hashToken(token);
  const invitation = await findInvitationByTokenHash(tokenHash);

  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.expiresAt <= new Date()
  ) {
    throw new NotFoundError("Invalid or expired invitation");
  }

  return {
    expiresAt: invitation.expiresAt,
    role: { displayName: invitation.role.displayName },
  };
}

export interface AcceptInvitationResult {
  sessionToken: string;
  sessionExpiresAt: Date;
  user: {
    id: string;
    email: string;
    emailVerifiedAt: Date | null;
    role: {
      id: string;
      name: string;
      scopeType: string;
      permissions: { permission: { resource: string; action: string } }[];
    };
  };
  invitationId: string;
}

export async function acceptInvitationUseCase(
  body: AcceptInvitationBody,
  ipAddress?: string,
  userAgent?: string,
): Promise<AcceptInvitationResult> {
  const tokenHash = hashToken(body.token);
  const invitation = await findInvitationByTokenHash(tokenHash);

  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.expiresAt <= new Date()
  ) {
    throw new NotFoundError("Invalid or expired invitation");
  }

  const email = normalizeEmail(invitation.email);

  // Pre-transaction email check
  if (await isEmailInUse(email)) {
    throw new ConflictError("Email already in use");
  }

  const passwordHash = await hashPassword(body.password);
  const { type: profileType, id: profileId } =
    getProfileTypeFromInvitation(invitation);

  const sessionToken = generateInviteToken();
  const sessionTokenHash = hashToken(sessionToken);
  const sessionExpiresAt = getSessionExpiry();

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
      ipAddress,
      userAgent,
    });

    return {
      sessionToken,
      sessionExpiresAt,
      user,
      invitationId: invitation.id,
    };
  } catch (err) {
    if (err instanceof InvitationAlreadyAcceptedError) {
      throw new NotFoundError("Invalid or expired invitation");
    }
    if (err instanceof ProfileAlreadyLinkedError) {
      throw new ConflictError("Profile already has a user account");
    }
    throw err;
  }
}

export interface CreateInvitationResult {
  invitationId: string;
  token: string;
  expiresAt: Date;
  profileType: ProfileType;
  profileId: string;
}

export async function createInvitationUseCase(
  creatorId: string,
  body: CreateInvitationBody,
): Promise<CreateInvitationResult> {
  const { roleId, email } = body;

  await validateRoleExists(roleId);

  const { type, id } = getProfileType(body);
  const profile = await findProfileById(type, id);

  if (!profile) {
    throw new NotFoundError("Profile not found");
  }

  const inviteEmail = validateProfileForInvite(profile, type, email);

  if (await isEmailInUse(inviteEmail)) {
    throw new ConflictError("Email already in use");
  }

  const token = generateInviteToken();
  const tokenHash = hashToken(token);
  const expiresAt = getInviteExpiry();

  const invitation = await upsertInvitation({
    tokenHash,
    email: inviteEmail,
    roleId,
    expiresAt,
    profileType: type,
    profileId: id,
    createdById: creatorId,
  });

  await enqueue(
    JobType.EMAIL_SEND_INVITE,
    { invitationId: invitation.id, token },
    { jobId: `invite-email:${invitation.id}` },
  );

  return {
    invitationId: invitation.id,
    token,
    expiresAt,
    profileType: type,
    profileId: id,
  };
}

export interface ResendInvitationResult {
  invitationId: string;
  token: string;
  expiresAt: Date;
}

export async function resendInvitationUseCase(
  invitationId: string,
): Promise<ResendInvitationResult> {
  const invitation = await findInvitationById(invitationId);

  if (!invitation) {
    throw new NotFoundError("Invitation not found");
  }

  if (invitation.acceptedAt) {
    throw new ConflictError("Invitation already accepted");
  }

  const token = generateInviteToken();
  const tokenHash = hashToken(token);
  const expiresAt = getInviteExpiry();

  const result = await rotateInvitationToken(invitationId, {
    tokenHash,
    expiresAt,
  });

  // Race condition: already accepted between check and update
  if (result.count === 0) {
    throw new ConflictError("Invitation already accepted");
  }

  await enqueue(
    JobType.EMAIL_SEND_INVITE,
    { invitationId, token },
    { jobId: `invite-email:${invitationId}:${String(Date.now())}` },
  );

  return { invitationId, token, expiresAt };
}

export interface RequestPasswordResetResult {
  userId?: string;
  token?: string;
}

export async function requestPasswordResetUseCase(
  email: string,
): Promise<RequestPasswordResetResult> {
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByEmail(normalizedEmail);

  // Timing-safe: always do work when user not found or inactive
  if (!user?.isActive) {
    await hashPassword("dummy-timing-safe-work");
    return {};
  }

  const token = generateResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = getPasswordResetExpiry();

  await createPasswordResetTokenTransaction({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  await enqueue(
    JobType.EMAIL_SEND_PASSWORD_RESET,
    { userId: user.id, token },
    { jobId: `password-reset:${user.id}:${String(Date.now())}` },
  );

  return { userId: user.id, token };
}

export interface ValidateResetTokenResult {
  expiresAt: Date;
}

export async function validateResetTokenUseCase(
  token: string,
): Promise<ValidateResetTokenResult> {
  const tokenHash = hashToken(token);
  const verificationToken = await findVerificationToken(
    tokenHash,
    "PASSWORD_RESET",
  );

  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt <= new Date()
  ) {
    throw new NotFoundError("Invalid or expired token");
  }

  return { expiresAt: verificationToken.expiresAt };
}

export interface ConfirmPasswordResetResult {
  userId: string;
}

export async function confirmPasswordResetUseCase(
  token: string,
  newPassword: string,
): Promise<ConfirmPasswordResetResult> {
  const tokenHash = hashToken(token);
  const verificationToken = await findVerificationToken(
    tokenHash,
    "PASSWORD_RESET",
  );

  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt <= new Date()
  ) {
    throw new NotFoundError("Invalid or expired token");
  }

  const passwordHash = await hashPassword(newPassword);

  try {
    await resetPasswordTransaction({
      tokenId: verificationToken.id,
      userId: verificationToken.userId,
      passwordHash,
    });
  } catch (err) {
    if (err instanceof TokenAlreadyUsedError) {
      throw new NotFoundError("Invalid or expired token");
    }
    throw err;
  }

  return { userId: verificationToken.userId };
}
