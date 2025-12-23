# Audit

Audit logging for tracking user actions and system events.

## Setup

After adding this service, run migrations to create the `audit_logs` table:

```bash
npx prisma migrate dev --name add_audit_logs
npx prisma generate
```

## Quick start

```typescript
// From a feature handler (e.g., src/features/auth/handlers.ts)
import { logAudit } from "../../services/audit/index.js";
import { AuditAction } from "@prisma/client";

// In a request handler - context extracted automatically
logAudit({
  action: AuditAction.CREATE,
  resource: "invitation",
  resourceId: invitation.id,
  metadata: { recipientEmail: invitation.email },
}, req);

// Outside request context - provide details explicitly
logAudit({
  action: AuditAction.LOGIN_FAILED,
  resource: "user",
  metadata: { email, reason: "invalid_password" },
  ipAddress: "1.2.3.4",
});
```

## Structure

```
src/services/audit/
├── index.ts        # Public exports
├── types.ts        # AuditEvent interface
├── service.ts      # logAudit()
└── README.md
```

## API

### `logAudit(event, req?)`

Fire-and-forget audit logging. Never throws or blocks.

| Parameter            | Type          | Description                          |
|----------------------|---------------|--------------------------------------|
| `event.action`       | `AuditAction` | Action type (enum)                   |
| `event.resource`     | `string`      | Resource type ("user", "invitation") |
| `event.resourceId`   | `string?`     | ID of affected resource              |
| `event.metadata`     | `object?`     | Additional context (changes, etc.)   |
| `req`                | `Request?`    | Express request for auto-context     |

When `req` is provided, `userId`, `ipAddress`, `userAgent`, and `requestId`
are extracted automatically.

## Available actions

Use the `AuditAction` enum for type safety and discoverability:

```typescript
import { AuditAction } from "@prisma/client";

logAudit({ action: AuditAction.LOGIN, ... }, req);
```

| Action              | Use case                              |
|---------------------|---------------------------------------|
| `LOGIN`             | Successful login                      |
| `LOGOUT`            | User logout                           |
| `LOGIN_FAILED`      | Failed login attempt                  |
| `PASSWORD_CHANGED`  | Password update                       |
| `CREATE`            | Resource created                      |
| `UPDATE`            | Resource updated                      |
| `DELETE`            | Resource deleted                      |
| `INVITATION_SENT`   | Invitation email sent                 |
| `INVITATION_ACCEPTED`| User accepted invitation             |
| `ROLE_ASSIGNED`     | Role assigned to user                 |

## Example metadata

```typescript
// Login
{ method: "password", sessionId: "..." }

// Update with changes
{ changes: { email: { from: "old@x.com", to: "new@x.com" } } }

// Failed login
{ email: "user@example.com", reason: "invalid_password" }

// Invitation
{ recipientEmail: "...", roleName: "Agent" }
```

**Caution:** `metadata` must be JSON-serializable. Do not include secrets, tokens, or PII unless required for the audit trail.

## Design notes

- **Fire-and-forget**: `logAudit()` never throws. Failures logged to error logger.
- **Immutable**: No update/delete operations on audit logs.
- **Context auto-extraction**: Pass `req` to capture user, IP, user-agent, request ID.
