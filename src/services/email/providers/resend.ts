import { Resend } from "resend";
import { env } from "../../../lib/env.js";
import { createModuleLogger } from "../../../lib/logger/index.js";
import type { Email, EmailProvider } from "../types.js";

const log = createModuleLogger("email:resend");

export class ResendProvider implements EmailProvider {
  private client: Resend;

  constructor() {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is required when using Resend provider");
    }
    this.client = new Resend(env.RESEND_API_KEY);
  }

  async send(email: Email): Promise<void> {
    const { error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    log.info({ to: email.to, subject: email.subject }, "Email sent via Resend");
  }
}
