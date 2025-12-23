# Tests

## Prerequisites

- Postgres running (via `docker compose`)

## Quick start

1. Start Postgres (and any other services you want):

```bash
docker compose up -d postgres
```

2. Create and sync the test database (idempotent):

```bash
npm run test:setup
```

3. Run tests:

```bash
npm test
```

## Notes

- Tests load `.env.test` via `src/test/setup.ts`.
- Vitest runs sequentially (`concurrent: false`) to avoid DB conflicts.


