/**
 * Email message structure.
 */
export interface Email {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email provider interface.
 * Implemented by SMTP and Resend providers.
 */
export interface EmailProvider {
  send(email: Email): Promise<void>;
}
