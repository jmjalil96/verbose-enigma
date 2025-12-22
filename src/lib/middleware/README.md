# Middleware

## Quick start

All middleware is applied automatically via `applyMiddleware(app)` in `app.ts`.

```typescript
import express from "express";
import { applyMiddleware } from "./lib/middleware/index.js";

const app = express();
applyMiddleware(app);
// ... routes
```

## Middleware order

1. `trust proxy` - if `TRUST_PROXY=true` (required behind load balancer)
2. `httpLogger` - request logging, `req.log`, `req.id`
3. `helmet` - security headers
4. `cors` - cross-origin requests
5. `compression` - gzip responses
6. `rateLimiter` - rate limiting per IP
7. `hpp` - HTTP parameter pollution protection
8. `jsonBody` - JSON body parsing
9. `cookies` - cookie parsing
10. `timeout` - request timeout

## Request validation

Use `validate()` to validate `body`, `query`, and `params` with Zod schemas:

```typescript
import { z } from "zod";
import { validate } from "./lib/middleware/index.js";
import { asyncHandler } from "./lib/utils/async-handler.js";

const createUserSchema = {
  body: z.object({
    email: z.string().email(),
    name: z.string().min(1),
  }),
};

app.post(
  "/api/users",
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    // req.body is typed and validated
    const { email, name } = req.body;
    res.status(201).json({ email, name });
  }),
);
```

With params and query:

```typescript
const getUserSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({
    include: z.enum(["profile", "settings"]).optional(),
  }),
};

app.get(
  "/api/users/:id",
  validate(getUserSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { include } = req.query;
    // ...
  }),
);
```

Validation errors return 400 with details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "body.email",
        "message": "Invalid email",
        "code": "invalid_string"
      }
    ]
  },
  "requestId": "...",
  "errorId": "..."
}
```

## Environment variables

| Variable               | Default | Description                                      |
| ---------------------- | ------- | ------------------------------------------------ |
| `TRUST_PROXY`          | `false` | Set `true` if behind load balancer/reverse proxy |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms)                           |
| `RATE_LIMIT_MAX`       | `100`   | Max requests per window per IP                   |
| `CORS_ORIGIN`          | `*`     | Allowed origins (comma-separated or `*`)         |
| `REQUEST_TIMEOUT_MS`   | `30000` | Request timeout (ms)                             |
| `REQUEST_BODY_LIMIT`   | `100kb` | Max JSON body size                               |

## Using individual middleware

If you need to customize or use middleware individually:

```typescript
import {
  helmetMiddleware,
  corsMiddleware,
  rateLimiter,
  hppMiddleware,
  compressionMiddleware,
  cookieMiddleware,
  jsonBodyMiddleware,
  timeoutMiddleware,
  validate,
} from "./lib/middleware/index.js";
```

## Notes

- **Rate limiting**: Returns `429 Too Many Requests` via error handler (consistent format).
- **Timeout**: Returns `408 Request Timeout` if response not sent within `REQUEST_TIMEOUT_MS`.
- **CORS + credentials**: If `CORS_ORIGIN` is not `*`, credentials are enabled automatically.
- **Health checks**: `/api/health`, `/health`, `/ready`, `/live` are excluded from rate limiting.
