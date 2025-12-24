import { db } from "../../../lib/db.js";
import { env } from "../../../lib/env.js";
import { createModuleLogger } from "../../../lib/logger/index.js";
import { getEmailProvider } from "../provider.js";
import { claimCreatedEmail } from "../templates/claim-created.js";

const log = createModuleLogger("email");

/**
 * Send claim created email.
 * Loads claim and affiliate data, builds link server-side.
 *
 * @param claimId - The claim ID
 * @param affiliateId - The affiliate ID (email recipient)
 */
export async function sendClaimCreatedEmail(
  claimId: string,
  affiliateId: string,
): Promise<void> {
  // Load claim with patient info
  const claim = await db.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      claimNumber: true,
      description: true,
      patient: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!claim) {
    log.error({ claimId }, "Claim not found");
    throw new Error(`Claim not found: ${claimId}`);
  }

  // Load affiliate email
  const affiliate = await db.affiliate.findUnique({
    where: { id: affiliateId },
    select: { email: true },
  });

  if (!affiliate?.email) {
    log.warn({ claimId, affiliateId }, "Affiliate has no email, skipping notification");
    return;
  }

  // Build claim URL
  const claimUrl = `${env.APP_URL}/claims/${claim.id}`;

  // Render template
  const patientName = `${claim.patient.firstName} ${claim.patient.lastName}`;
  const email = claimCreatedEmail({
    claimNumber: claim.claimNumber,
    patientName,
    description: claim.description,
    claimUrl,
  });

  // Send via provider
  const provider = getEmailProvider();
  await provider.send({
    to: affiliate.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  log.info(
    { claimId, claimNumber: claim.claimNumber, to: affiliate.email },
    "Claim created email sent",
  );
}
