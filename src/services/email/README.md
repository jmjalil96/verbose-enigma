# Email

Email service with provider abstraction (SMTP for dev, Resend for prod).

## Quick start

Emails are sent via the job queue. The invitation flow already enqueues emails automatically:

```typescript
// In auth handlers (already implemented):
await enqueue(
  JobType.EMAIL_SEND_INVITE,
  { invitationId: invitation.id, token },
  { jobId: `invite-email:${invitation.id}` },
);
```

## Structure

```
src/services/email/
├── handlers/
│   ├── index.ts
│   └── invite.ts       # sendInviteEmail()
├── templates/
│   ├── index.ts
│   ├── types.ts        # EmailTemplate type
│   └── invite.ts       # inviteEmail()
├── providers/
│   ├── smtp.ts         # Nodemailer (dev)
│   └── resend.ts       # Resend SDK (prod)
├── types.ts            # Email, EmailProvider interfaces
├── provider.ts         # Provider factory
├── index.ts
└── README.md
```

## Running locally

Start inbucket (catches all emails in dev):

```bash
npm run db:up  # Starts postgres, redis, and inbucket
```

- **SMTP**: localhost:1025
- **Web UI**: http://localhost:8025

## Adding a new email type

### 1. Create template in `templates/`

```typescript
// templates/welcome.ts
import type { EmailTemplate } from "./types.js";

export interface WelcomeEmailData {
  userName: string;
  loginUrl: string;
}

export function welcomeEmail(data: WelcomeEmailData): EmailTemplate {
  return {
    subject: `Welcome, ${data.userName}!`,
    html: `<p>Welcome! <a href="${data.loginUrl}">Log in here</a></p>`,
    text: `Welcome! Log in here: ${data.loginUrl}`,
  };
}
```

Export from `templates/index.ts`:
```typescript
export { welcomeEmail, type WelcomeEmailData } from "./welcome.js";
```

### 2. Create handler in `handlers/`

```typescript
// handlers/welcome.ts
import { db } from "../../../lib/db.js";
import { env } from "../../../lib/env.js";
import { createModuleLogger } from "../../../lib/logger/index.js";
import { getEmailProvider } from "../provider.js";
import { welcomeEmail } from "../templates/index.js";

const log = createModuleLogger("email");

export async function sendWelcomeEmail(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error(`User not found: ${userId}`);

  const email = welcomeEmail({
    userName: user.name,
    loginUrl: `${env.APP_URL}/login`,
  });

  const provider = getEmailProvider();
  await provider.send({
    to: user.email,
    ...email,
  });

  log.info({ userId, to: user.email }, "Welcome email sent");
}
```

Export from `handlers/index.ts`:
```typescript
export { sendWelcomeEmail } from "./welcome.js";
```

### 3. Add job type (if async)

In `src/lib/jobs/types.ts`:

```typescript
export const JobType = {
  EMAIL_SEND_INVITE: "email.sendInvite",
  EMAIL_SEND_WELCOME: "email.sendWelcome",  // Add this
} as const;

export const jobPayloadSchemas = {
  // ...existing
  [JobType.EMAIL_SEND_WELCOME]: z.object({
    userId: z.string(),
  }),
};
```

In `src/lib/jobs/processors.ts`:

```typescript
[JobType.EMAIL_SEND_WELCOME]: async (job) => {
  const payload = jobPayloadSchemas[JobType.EMAIL_SEND_WELCOME].parse(job.data);
  await sendWelcomeEmail(payload.userId);
},
```

### 4. Enqueue from your handler

```typescript
await enqueue(
  JobType.EMAIL_SEND_WELCOME,
  { userId: user.id },
  { jobId: `welcome-email:${user.id}` },
);
```

## Environment variables

| Variable         | Default                   | Description                 |
| ---------------- | ------------------------- | --------------------------- |
| `EMAIL_PROVIDER` | `smtp`                    | Provider: `smtp` or `resend`|
| `EMAIL_FROM`     | `noreply@example.com`     | Sender address              |
| `SMTP_HOST`      | `localhost`               | SMTP server host            |
| `SMTP_PORT`      | `1025`                    | SMTP server port            |
| `RESEND_API_KEY` | -                         | Resend API key (prod)       |
| `APP_URL`        | `http://localhost:3000`   | Base URL for email links    |

## Provider abstraction

The service automatically picks the provider based on `EMAIL_PROVIDER`:

```typescript
import { getEmailProvider } from "./provider.js";

const provider = getEmailProvider();
await provider.send({
  to: "user@example.com",
  subject: "Hello",
  html: "<p>Hello world</p>",
  text: "Hello world",
});
```

## Logging

All email operations are logged with `createModuleLogger("email")`:

```
[INFO] Invitation email sent { invitationId: "...", to: "..." }
[INFO] Email sent via SMTP { to: "...", subject: "..." }
```

## Notes

- **Job idempotency**: Use deterministic `jobId` to prevent duplicate sends.
- **Token in payload**: The invite token is passed in the job payload to build the link server-side.
- **Resend errors**: If using Resend and `RESEND_API_KEY` is missing, the provider throws on instantiation.
- **Skips accepted**: If an invitation is already accepted when the job runs, the email is skipped (logged as warning).
