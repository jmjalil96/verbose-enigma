import type { EmailTemplate } from "./types.js";

export interface PasswordResetEmailData {
  resetLink: string;
  expiresAt: Date;
}

/**
 * Generate password reset email content.
 */
export function passwordResetEmail(data: PasswordResetEmailData): EmailTemplate {
  const expiresFormatted = data.expiresAt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    subject: "Reset your password",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Password Reset Request</h1>
        <p>We received a request to reset your password.</p>
        <p>
          <a href="${data.resetLink}"
             style="display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          This link expires on ${expiresFormatted}.
        </p>
        <p style="color: #666; font-size: 14px;">
          If you didn't request a password reset, you can safely ignore this email.
          Your password will remain unchanged.
        </p>
      </div>
    `.trim(),
    text: `
Password Reset Request

We received a request to reset your password.

Reset your password: ${data.resetLink}

This link expires on ${expiresFormatted}.

If you didn't request a password reset, you can safely ignore this email.
Your password will remain unchanged.
    `.trim(),
  };
}
