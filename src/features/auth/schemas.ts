import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

const profileIdFields = [
  "employeeId",
  "agentId",
  "clientAdminId",
  "affiliateId",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

export const loginSchema = {
  body: z.object({
    email: z.email(),
    password: z.string().min(1),
  }),
};

export type LoginBody = z.infer<typeof loginSchema.body>;

// ─────────────────────────────────────────────────────────────────────────────
// Invitations
// ─────────────────────────────────────────────────────────────────────────────

export const createInvitationSchema = {
  body: z
    .object({
      roleId: z.string().min(1),
      employeeId: z.string().min(1).optional(),
      agentId: z.string().min(1).optional(),
      clientAdminId: z.string().min(1).optional(),
      affiliateId: z.string().min(1).optional(),
      email: z.email().optional(),
    })
    .refine(
      (data) => {
        const provided = profileIdFields.filter((f) => data[f] !== undefined);
        return provided.length === 1;
      },
      { message: "Exactly one profile ID must be provided" },
    ),
};

export const acceptInvitationSchema = {
  body: z.object({
    token: z.string().min(1),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  }),
};

export const validateTokenSchema = {
  params: z.object({
    token: z.string().min(1),
  }),
};

export const resendInvitationSchema = {
  params: z.object({
    id: z.string().min(1),
  }),
};

export type CreateInvitationBody = z.infer<typeof createInvitationSchema.body>;
export type AcceptInvitationBody = z.infer<typeof acceptInvitationSchema.body>;
export type ValidateTokenParams = z.infer<typeof validateTokenSchema.params>;
export type ResendInvitationParams = z.infer<typeof resendInvitationSchema.params>;

// ─────────────────────────────────────────────────────────────────────────────
// Password Reset
// ─────────────────────────────────────────────────────────────────────────────

export const requestPasswordResetSchema = {
  body: z.object({
    email: z.email(),
  }),
};

export const validateResetTokenSchema = {
  params: z.object({
    token: z.string().min(1),
  }),
};

export const confirmPasswordResetSchema = {
  body: z.object({
    token: z.string().min(1),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  }),
};

export type RequestPasswordResetBody = z.infer<typeof requestPasswordResetSchema.body>;
export type ValidateResetTokenParams = z.infer<typeof validateResetTokenSchema.params>;
export type ConfirmPasswordResetBody = z.infer<typeof confirmPasswordResetSchema.body>;
