import type { EmailTemplate } from "./types.js";

export interface InviteEmailData {
  inviteLink: string;
  roleName: string;
  expiresAt: Date;
}

/**
 * Generate invite email content.
 */
export function inviteEmail(data: InviteEmailData): EmailTemplate {
  const expiresFormatted = data.expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    subject: `You're invited to join as ${data.roleName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>You're Invited</h1>
        <p>You've been invited to join as <strong>${data.roleName}</strong>.</p>
        <p>
          <a href="${data.inviteLink}"
             style="display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px;">
            Accept Invitation
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          This invitation expires on ${expiresFormatted}.
        </p>
        <p style="color: #666; font-size: 14px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `.trim(),
    text: `
You're Invited

You've been invited to join as ${data.roleName}.

Accept your invitation: ${data.inviteLink}

This invitation expires on ${expiresFormatted}.

If you didn't expect this invitation, you can safely ignore this email.
    `.trim(),
  };
}
