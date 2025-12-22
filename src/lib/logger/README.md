# Logger

## Quick start

```typescript
import { logger, createModuleLogger } from "./lib/logger/index.js";

logger.info("App starting");

const dbLogger = createModuleLogger("db");
dbLogger.info({ host: "localhost" }, "Connected");
```

## In routes (`req.log`)

Use `req.log` inside request handlers. It's request-scoped and includes `requestId`.

```typescript
import type { Request, Response } from "express";

app.get("/users/:id", (req: Request, res: Response) => {
  req.log.info({ userId: req.params.id }, "Fetching user");
  res.json({ ok: true });
});
```

- `requestId` is also returned to clients via `X-Request-Id`.
- Health endpoints are excluded from auto-logging: `/api/health`, `/health`, `/ready`, `/live`.

## Module loggers (`createModuleLogger`)

Use for code that is not in a request context (startup, jobs, scripts).

```typescript
const serverLogger = createModuleLogger("server");
serverLogger.info({ port: 3000 }, "Listening");
```

## Log levels

Use levels consistently:

- `trace`/`debug`: troubleshooting noise (usually off in prod)
- `info`: meaningful state changes / domain events
- `warn`: client mistakes or recoverable problems
- `error`: request failures, caught exceptions
- `fatal`: process will exit / cannot continue safely

## What to log (practical guidance)

- Prefer **structured fields**: `req.log.info({ userId, orderId }, "Created order")`
- Avoid logging secrets or PII. Do **not** log:
  - passwords, tokens, cookies, authorization headers
  - full request/response bodies by default
- Keep payloads small; log identifiers and counts, not entire objects.

## Environment variables

- `LOG_LEVEL`: `fatal|error|warn|info|debug|trace|silent` (default: `info`)
- `NODE_ENV`: `development|production|test`
  - pretty printing is enabled when `NODE_ENV !== "production"`
