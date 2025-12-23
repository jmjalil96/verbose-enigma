import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../../../lib/env.js";
import { createModuleLogger } from "../../../lib/logger/index.js";
import type { Email, EmailProvider } from "../types.js";

const log = createModuleLogger("email:smtp");

export class SmtpProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
    });
  }

  async send(email: Email): Promise<void> {
    await this.transporter.sendMail({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    log.info({ to: email.to, subject: email.subject }, "Email sent via SMTP");
  }
}
