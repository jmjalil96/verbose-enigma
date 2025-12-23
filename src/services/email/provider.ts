import { env } from "../../lib/env.js";
import type { EmailProvider } from "./types.js";
import { SmtpProvider } from "./providers/smtp.js";
import { ResendProvider } from "./providers/resend.js";

let provider: EmailProvider | null = null;

/**
 * Get email provider based on EMAIL_PROVIDER env var.
 * Lazy singleton - only instantiated on first use.
 */
export function getEmailProvider(): EmailProvider {
  provider ??=
    env.EMAIL_PROVIDER === "resend"
      ? new ResendProvider()
      : new SmtpProvider();
  return provider;
}
