# api

Fastify REST API (bundled with esbuild). It serves the `apps/workbench` dataset
endpoints, wiring `@rfjs/core` use cases over `@rfjs/db` (PostgreSQL).

## Architecture

Layered Fastify app:

- `src/delivery/` — HTTP layer (routes + handlers per module, e.g. `dataset/`)
- `src/infrastructures/` — app/plugin/server bootstrap; `datasource/` wires
  `createDb()` → `makeDatasetRepository(db)` → use cases
- `src/helpers/` — route helpers, pino transport config
- `src/utils/` — shared utilities

See the root [`CLAUDE.md`](../../CLAUDE.md) ("Workbench Stack") for the full
`workbench → api → @rfjs/core → @rfjs/db` data flow.

## Develop

Run from the repo root with a package filter (or omit `-F api` inside this dir):

```bash
pnpm -F api dev        # watch build (esbuild) + typecheck
pnpm -F api build      # production bundle to ./dist
pnpm -F api test       # unit tests (vitest)
pnpm -F api test:e2e   # e2e tests
pnpm -F api lint
```

`PORT` defaults to `3000`; set it when running alongside `web` (also 3000).
The dataset endpoints need a PostgreSQL connection — provide `DATABASE_URL`
(see `src/configs.ts`).
