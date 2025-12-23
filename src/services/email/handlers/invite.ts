import { db } from "../../../lib/db.js";
import { env } from "../../../lib/env.js";
import { createModuleLogger } from "../../../lib/logger/index.js";
import { getEmailProvider } from "../provider.js";
import { inviteEmail } from "../templates/invite.js";

const log = createModuleLogger("email");

/**
 * Send invitation email.
 * Loads invitation data, builds link server-side.
 *
 * @param invitationId - The invitation ID
 * @param token - The raw invite token (needed to build link)
 */
export async function sendInviteEmail(
  invitationId: string,
  token: string,
): Promise<void> {
  const invitation = await db.invitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      role: {
        select: { displayName: true },
      },
    },
  });

  if (!invitation) {
    log.error({ invitationId }, "Invitation not found");
    throw new Error(`Invitation not found: ${invitationId}`);
  }

  if (invitation.acceptedAt) {
    log.warn({ invitationId }, "Invitation already accepted, skipping email");
    return;
  }

  // Build invite link server-side
  const inviteLink = `${env.APP_URL}/invite/${token}`;

  // Render template
  const email = inviteEmail({
    inviteLink,
    roleName: invitation.role.displayName,
    expiresAt: invitation.expiresAt,
  });

  // Send via provider
  const provider = getEmailProvider();
  await provider.send({
    to: invitation.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  log.info({ invitationId, to: invitation.email }, "Invitation email sent");
}
