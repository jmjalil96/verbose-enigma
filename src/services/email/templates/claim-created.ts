import type { EmailTemplate } from "./types.js";

export interface ClaimCreatedEmailData {
  claimNumber: number;
  patientName: string;
  description: string;
  claimUrl: string;
}

/**
 * Generate claim created email content.
 */
export function claimCreatedEmail(data: ClaimCreatedEmailData): EmailTemplate {
  const claimNumberStr = String(data.claimNumber);
  return {
    subject: `Claim #${claimNumberStr} Created`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Claim Created</h1>
        <p>Your claim has been successfully created and is now in <strong>Draft</strong> status.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Claim Number</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>#${claimNumberStr}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Patient</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.patientName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Description</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.description}</td>
          </tr>
        </table>
        <p>
          <a href="${data.claimUrl}"
             style="display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px;">
            View Claim
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          You can submit your claim when you're ready. Draft claims will not be processed until submitted.
        </p>
      </div>
    `.trim(),
    text: `
Claim Created

Your claim has been successfully created and is now in Draft status.

Claim Number: #${claimNumberStr}
Patient: ${data.patientName}
Description: ${data.description}

View your claim: ${data.claimUrl}

You can submit your claim when you're ready. Draft claims will not be processed until submitted.
    `.trim(),
  };
}
