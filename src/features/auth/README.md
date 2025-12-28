# Auth Module

Session-based authentication with secure HTTP-only cookies, user invitations, and password reset flows.

## Base URL

```
/api/auth
```

## Cookie Configuration

Sessions are managed via HTTP-only cookies:

| Property   | Value                                 |
| ---------- | ------------------------------------- |
| Name       | `session` (configurable via env)      |
| HttpOnly   | `true`                                |
| Secure     | `true` in production                  |
| SameSite   | `lax`                                 |
| Path       | `/`                                   |
| Expiry     | 30 days from login                    |

**Frontend requirement:** Include `credentials: 'include'` in all fetch requests.

```typescript
fetch('/api/auth/me', { credentials: 'include' })
```

---

## Endpoints

### Session Management

#### `POST /login`

Authenticate user and create session.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`

```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "emailVerifiedAt": "2024-01-15T10:30:00.000Z",
    "name": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "role": {
      "id": "role-id",
      "name": "admin",
      "scopeType": "UNLIMITED"
    },
    "permissions": ["users:invite", "claims:read", "claims:write"]
  },
  "expiresAt": "2024-02-15T10:30:00.000Z"
}
```

**Notes:**

- `name` is `null` if user has no linked profile

**Errors:**

| Status | Code           | Cause                        |
| ------ | -------------- | ---------------------------- |
| 400    | VALIDATION_ERROR | Missing/invalid email or password |
| 401    | UNAUTHORIZED   | Invalid credentials or inactive user |

---

#### `POST /logout`

Revoke current session.

**Auth:** Required

**Response:** `204 No Content`

---

#### `POST /logout-all`

Revoke all sessions for the user.

**Auth:** Required

**Response:** `204 No Content`

---

#### `GET /me`

Get current authenticated user.

**Auth:** Required

**Response:** `200 OK`

```json
{
  "id": "clx...",
  "email": "user@example.com",
  "emailVerifiedAt": "2024-01-15T10:30:00.000Z",
  "name": {
    "firstName": "John",
    "lastName": "Doe"
  },
  "role": {
    "id": "role-id",
    "name": "admin",
    "scopeType": "UNLIMITED"
  },
  "permissions": ["users:invite", "claims:read", "claims:write"]
}
```

**Notes:**

- `name` is `null` if user has no linked profile
- `emailVerifiedAt` is `null` if email not verified
- `scopeType`: `UNLIMITED` | `CLIENT` | `SELF`
- Response includes `Cache-Control: no-store`

**Errors:**

| Status | Code         | Cause           |
| ------ | ------------ | --------------- |
| 401    | UNAUTHORIZED | No valid session |

---

### Invitations

Users are created via invitations linked to a profile (Employee, Agent, ClientAdmin, or Affiliate).

#### `POST /invitations`

Create invitation for a profile.

**Auth:** Required
**Permission:** `users:invite`

**Request:**

```json
{
  "roleId": "role-id",
  "employeeId": "employee-id"
}
```

Exactly one profile ID must be provided:

- `employeeId`
- `agentId`
- `clientAdminId`
- `affiliateId`

Optional `email` override (required for affiliates without profile email).

**Response:** `201 Created`

```json
{
  "invitationId": "clx...",
  "expiresAt": "2024-01-22T10:30:00.000Z"
}
```

**Errors:**

| Status | Code             | Cause                              |
| ------ | ---------------- | ---------------------------------- |
| 400    | BAD_REQUEST      | Invalid profile ID combination     |
| 400    | BAD_REQUEST      | Profile inactive or missing email  |
| 404    | NOT_FOUND        | Profile or role not found          |
| 409    | CONFLICT         | Email in use or profile has user   |

---

#### `GET /invitations/:token`

Validate invitation token (preflight check).

**Auth:** Not required

**Response:** `200 OK`

```json
{
  "expiresAt": "2024-01-22T10:30:00.000Z",
  "role": {
    "displayName": "Administrator"
  }
}
```

**Errors:**

| Status | Code      | Cause                              |
| ------ | --------- | ---------------------------------- |
| 404    | NOT_FOUND | Invalid, expired, or used token    |

---

#### `POST /invitations/accept`

Accept invitation and create user account.

**Auth:** Not required

**Request:**

```json
{
  "token": "abc123...",
  "password": "securePassword123"
}
```

**Password requirements:**

- Minimum: 12 characters
- Maximum: 128 characters

**Response:** `200 OK`

```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "emailVerifiedAt": "2024-01-15T10:30:00.000Z",
    "name": {
      "firstName": "Jane",
      "lastName": "Smith"
    },
    "role": {
      "id": "role-id",
      "name": "employee",
      "scopeType": "UNLIMITED"
    },
    "permissions": ["claims:read"]
  },
  "expiresAt": "2024-02-15T10:30:00.000Z"
}
```

Sets session cookie automatically. The `name` comes from the linked profile.

**Errors:**

| Status | Code      | Cause                              |
| ------ | --------- | ---------------------------------- |
| 400    | VALIDATION_ERROR | Password too short/long     |
| 404    | NOT_FOUND | Invalid, expired, or used token    |
| 409    | CONFLICT  | Email already in use               |

---

#### `POST /invitations/:id/resend`

Resend invitation with new token.

**Auth:** Required
**Permission:** `users:invite`

**Response:** `200 OK`

```json
{
  "invitationId": "clx...",
  "expiresAt": "2024-01-22T10:30:00.000Z"
}
```

**Errors:**

| Status | Code      | Cause                    |
| ------ | --------- | ------------------------ |
| 404    | NOT_FOUND | Invitation not found     |
| 409    | CONFLICT  | Already accepted         |

---

### Password Reset

#### `POST /password-reset/request`

Request password reset email.

**Auth:** Not required

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`

```json
{
  "message": "If an account exists, you will receive an email"
}
```

**Notes:**

- Always returns 200 to prevent email enumeration
- Token expires in 1 hour

---

#### `GET /password-reset/:token`

Validate reset token (preflight check).

**Auth:** Not required

**Response:** `200 OK`

```json
{
  "expiresAt": "2024-01-15T11:30:00.000Z"
}
```

**Errors:**

| Status | Code      | Cause                              |
| ------ | --------- | ---------------------------------- |
| 404    | NOT_FOUND | Invalid, expired, or used token    |

---

#### `POST /password-reset/confirm`

Set new password and invalidate all sessions.

**Auth:** Not required

**Request:**

```json
{
  "token": "abc123...",
  "password": "newSecurePassword123"
}
```

**Response:** `200 OK`

```json
{
  "message": "Password reset successful"
}
```

Clears session cookie.

**Errors:**

| Status | Code             | Cause                         |
| ------ | ---------------- | ----------------------------- |
| 400    | VALIDATION_ERROR | Password too short/long       |
| 404    | NOT_FOUND        | Invalid, expired, or used token |

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials",
    "details": []
  },
  "requestId": "uuid",
  "errorId": "uuid"
}
```

Validation errors include field details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "path": "email", "message": "Invalid email" },
      { "path": "password", "message": "Required" }
    ]
  }
}
```

---

## Frontend Integration

### Initial Load

Check authentication state on app load:

```typescript
async function checkAuth(): Promise<User | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Auth check failed');
  return res.json();
}
```

### Login Flow

```typescript
async function login(email: string, password: string): Promise<User> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error.message);
  }

  const { user } = await res.json();
  return user;
}
```

### Logout Flow

```typescript
async function logout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
```

### Invitation Accept Flow

1. Extract token from URL (e.g., `/invite/:token`)
2. Validate token with `GET /invitations/:token`
3. Show registration form with role info
4. Submit with `POST /invitations/accept`
5. User is automatically logged in

```typescript
async function acceptInvitation(token: string, password: string): Promise<User> {
  const res = await fetch('/api/auth/invitations/accept', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });

  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error.message);
  }

  const { user } = await res.json();
  return user;
}
```

### Password Reset Flow

1. User requests reset via `POST /password-reset/request`
2. User clicks email link (e.g., `/reset-password/:token`)
3. Validate token with `GET /password-reset/:token`
4. Show password form if valid
5. Submit with `POST /password-reset/confirm`
6. Redirect to login

---

## Authorization

After authentication, use the `permissions` array for authorization:

```typescript
function hasPermission(user: User, required: string): boolean {
  return user.permissions.includes(required);
}

// Usage
if (hasPermission(user, 'claims:write')) {
  // Show create claim button
}
```

Common permissions format: `{resource}:{action}`

Examples:

- `users:invite`
- `claims:read`
- `claims:write`
- `documents:edit`

---

## Security Notes

- Passwords hashed with Argon2id
- Session tokens are SHA-256 hashed before storage
- Timing-safe comparison prevents user enumeration on login
- Password reset does not reveal if email exists
- All sessions invalidated on password change
