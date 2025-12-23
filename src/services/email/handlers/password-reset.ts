import { createHash } from "node:crypto";
import { db } from "../../../lib/db.js";
import { env } from "../../../lib/env.js";
import { createModuleLogger } from "../../../lib/logger/index.js";
import { getEmailProvider } from "../provider.js";
import { passwordResetEmail } from "../templates/password-reset.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const log = createModuleLogger("email");

/**
 * Send password reset email.
 * Loads user data, builds link server-side.
 *
 * @param userId - The user ID requesting password reset
 * @param token - The raw reset token (needed to build link)
 */
export async function sendPasswordResetEmail(
  userId: string,
  token: string,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      isActive: true,
    },
  });

  if (!user) {
    log.error({ userId }, "User not found for password reset email");
    throw new Error(`User not found: ${userId}`);
  }

  if (!user.isActive) {
    log.warn({ userId }, "User inactive, skipping password reset email");
    return;
  }

  // Validate the specific token exists and hasn't been used/rotated
  const tokenHash = hashToken(token);
  const verificationToken = await db.verificationToken.findFirst({
    where: {
      tokenHash,
      type: "PASSWORD_RESET",
      usedAt: null,
    },
    select: { expiresAt: true },
  });

  if (!verificationToken) {
    // Token was rotated or used before job processed - skip silently
    log.warn({ userId }, "Password reset token no longer valid, skipping email");
    return;
  }

  // Build reset link server-side
  const resetLink = `${env.APP_URL}/reset-password/${token}`;

  // Render template
  const email = passwordResetEmail({
    resetLink,
    expiresAt: verificationToken.expiresAt,
  });

  // Send via provider
  const provider = getEmailProvider();
  await provider.send({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  log.info({ userId, to: user.email }, "Password reset email sent");
}
