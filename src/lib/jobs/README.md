# Jobs

Background job processing with BullMQ and Redis.

## Quick start

```typescript
import { enqueue } from "./lib/jobs/index.js";

// Enqueue a job from an endpoint
await enqueue("email.sendInvite", { invitationId, toEmail }, {
  jobId: `invite-email:${invitationId}`, // Deterministic ID for idempotency
});
```

Run the worker in a separate process:

```bash
npm run worker:dev  # Development (with hot reload)
npm run worker      # Production (requires npm run build first)
```

## Adding a new job type

### 1. Define the job type and payload schema

In `types.ts`:

```typescript
export const JobType = {
  EMAIL_SEND_INVITE: "email.sendInvite",
  EMAIL_SEND_PASSWORD_RESET: "email.sendPasswordReset",
} as const;

export const jobPayloadSchemas = {
  [JobType.EMAIL_SEND_INVITE]: z.object({
    invitationId: z.string().uuid(),
    toEmail: z.string().email(),
  }),
  [JobType.EMAIL_SEND_PASSWORD_RESET]: z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
  }),
} as const satisfies Record<string, z.ZodType>;
```

### 2. Add the processor

In `processors.ts`:

```typescript
import { JobType, jobPayloadSchemas } from "./types.js";

export const processors: Record<string, (job: Job) => Promise<void>> = {
  [JobType.EMAIL_SEND_INVITE]: async (job) => {
    const payload = jobPayloadSchemas[JobType.EMAIL_SEND_INVITE].parse(job.data);
    // Send invite email...
  },

  [JobType.EMAIL_SEND_PASSWORD_RESET]: async (job) => {
    const payload = jobPayloadSchemas[JobType.EMAIL_SEND_PASSWORD_RESET].parse(job.data);
    // Send password reset email...
  },
};
```

### 3. Enqueue from your endpoint or service

```typescript
import { enqueue, JobType } from "./lib/jobs/index.js";

// In a handler
await enqueue(JobType.EMAIL_SEND_INVITE, {
  invitationId: invitation.id,
  toEmail: invitation.email,
}, {
  jobId: `invite-email:${invitation.id}`,
});
```

## Idempotency with `jobId`

Use deterministic job IDs to prevent duplicate jobs:

```typescript
// Good: Same invitation = same jobId = job only runs once
await enqueue("email.sendInvite", payload, {
  jobId: `invite-email:${invitationId}`,
});

// If the job already exists, BullMQ rejects the duplicate
```

Use cases:
- Retry logic in endpoints (user clicks "resend" multiple times)
- Webhook handlers that may receive duplicates
- Any operation that should only happen once per entity

### Re-triggerable operations

For operations that should run each time they're requested (e.g., resending invitations, password reset requests), include a timestamp in the jobId:

```typescript
// Each request creates a new job (user can resend multiple times)
await enqueue("email.sendInvite", payload, {
  jobId: `invite-email:${invitationId}:${Date.now()}`,
});

// Password reset - each request should send a new email
await enqueue("email.sendPasswordReset", payload, {
  jobId: `password-reset:${userId}:${Date.now()}`,
});
```

This ensures each user action triggers a new job while still providing traceability via the entity ID prefix.

## Delayed jobs

Schedule a job to run later:

```typescript
await enqueue("email.sendReminder", payload, {
  delay: 24 * 60 * 60 * 1000, // 24 hours
});
```

## Job options (defaults)

| Option             | Default                           | Description                        |
| ------------------ | --------------------------------- | ---------------------------------- |
| `attempts`         | `3`                               | Max retry attempts                 |
| `backoff`          | `{ type: "exponential", delay: 1000 }` | Retry delay strategy          |
| `removeOnComplete` | `{ count: 1000 }`                 | Keep last 1000 completed jobs      |
| `removeOnFail`     | `false`                           | Keep failed jobs for inspection    |

## Structuring job handlers (services pattern)

For complex jobs, keep processors thin and delegate to services:

```typescript
// processors.ts
import { emailService } from "../services/email.js";

export const processors = {
  [JobType.EMAIL_SEND_INVITE]: async (job) => {
    const payload = jobPayloadSchemas[JobType.EMAIL_SEND_INVITE].parse(job.data);
    await emailService.sendInviteEmail(payload.invitationId, payload.toEmail);
  },
};
```

```typescript
// services/email.ts
export const emailService = {
  async sendInviteEmail(invitationId: string, toEmail: string) {
    const invitation = await db.invitation.findUnique({ where: { id: invitationId } });
    if (!invitation) throw new Error("Invitation not found");

    await sendgrid.send({
      to: toEmail,
      template: "invite",
      data: { link: buildInviteLink(invitation.token) },
    });
  },
};
```

## Error handling

- **Transient errors** (network, rate limits): Job retries automatically (3 attempts, exponential backoff).
- **Permanent errors** (validation, not found): Throw immediately; job fails and is kept for inspection.

```typescript
export const processors = {
  [JobType.EMAIL_SEND_INVITE]: async (job) => {
    const payload = jobPayloadSchemas[JobType.EMAIL_SEND_INVITE].parse(job.data);

    const invitation = await db.invitation.findUnique({ where: { id: payload.invitationId } });
    if (!invitation) {
      // Permanent failure - don't retry
      throw new Error(`Invitation ${payload.invitationId} not found`);
    }

    // This may throw transient errors (network) - will retry
    await emailProvider.send({ to: payload.toEmail, ... });
  },
};
```

## Logging

Jobs are logged automatically:

```
[INFO] Processing job { jobName: "email.sendInvite", jobId: "invite-email:abc", attempt: 1 }
[INFO] Job completed { jobName: "email.sendInvite", jobId: "invite-email:abc" }
[ERROR] Job failed { jobName: "email.sendInvite", jobId: "invite-email:abc", attemptsMade: 3, err: ... }
```

For additional logging inside processors:

```typescript
import { createModuleLogger } from "../logger/index.js";

const log = createModuleLogger("jobs:email");

export const processors = {
  [JobType.EMAIL_SEND_INVITE]: async (job) => {
    log.info({ jobId: job.id, invitationId: job.data.invitationId }, "Sending invite email");
    // ...
  },
};
```

## Environment variables

| Variable    | Default                   | Description        |
| ----------- | ------------------------- | ------------------ |
| `REDIS_URL` | `redis://localhost:6379`  | Redis connection   |

## Running the worker

```bash
# Development (hot reload)
npm run worker:dev

# Production
npm run build
npm run worker
```

The worker:
- Processes up to 5 jobs concurrently
- Handles SIGTERM/SIGINT gracefully (waits for in-flight jobs)
- Logs all job lifecycle events

## Architecture notes

- **Lazy connection**: The API server only connects to Redis when `enqueue()` is called.
- **Separate process**: Worker runs independently via `src/worker.ts`.
- **One queue**: All job types go through the `jobs` queue, differentiated by name.
- **Graceful shutdown**: Both server and worker close Redis connections on termination.
