# Error handling

## Quick start

Throw typed errors from handlers; the global middleware will:

1. log once with `req.log.error({ err, errorId, ... })`
2. respond with a consistent JSON shape including `requestId` + `errorId`

```typescript
import { NotFoundError, ValidationError } from "./lib/errors/index.js";
import { asyncHandler } from "./lib/utils/async-handler.js";

app.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const user = await getUser(req.params.id);
    if (!user) throw new NotFoundError("User not found");
    res.json(user);
  }),
);
```

## Available errors

| Class                  | HTTP | `error.code`        |
| ---------------------- | ---- | ------------------- |
| `BadRequestError`      | 400  | `BAD_REQUEST`       |
| `ValidationError`      | 400  | `VALIDATION_ERROR`  |
| `UnauthorizedError`    | 401  | `UNAUTHORIZED`      |
| `ForbiddenError`       | 403  | `FORBIDDEN`         |
| `NotFoundError`        | 404  | `NOT_FOUND`         |
| `RequestTimeoutError`  | 408  | `REQUEST_TIMEOUT`   |
| `ConflictError`        | 409  | `CONFLICT`          |
| `TooManyRequestsError` | 429  | `TOO_MANY_REQUESTS` |
| `InternalError`        | 500  | `INTERNAL_ERROR`    |

## Async routes (`asyncHandler`)

Use `asyncHandler` for any async route so promise rejections reach the error middleware.

```typescript
app.post(
  "/widgets",
  asyncHandler(async (req, res) => {
    const widget = await createWidget(req.body);
    res.status(201).json(widget);
  }),
);
```

## Validation errors (with details)

`ValidationError` supports `details`:

```typescript
throw new ValidationError("Invalid request body", [
  { field: "email", message: "Invalid email format" },
]);
```

## Response format

**Operational (expected) error:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [{ "field": "email", "message": "Invalid email format" }]
  },
  "requestId": "abc-123",
  "errorId": "def-456"
}
```

**Non-operational (unexpected) error:**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  },
  "requestId": "abc-123",
  "errorId": "def-456"
}
```

**Notes:**

- Responses are **production-safe always** (no stack trace in JSON).
- `requestId` is the same value returned in `X-Request-Id`.
- Debug details (stack/cause/extra context) are in logs, correlated by `requestId` + `errorId`.
