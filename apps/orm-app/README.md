# orm-app

ORM integration demo (bundled with tsdown). It consumes all four ORM wrapper
libs — `@rfjs/orm-drizzle`, `@rfjs/orm-kysely`, `@rfjs/orm-prisma`, and
`@rfjs/orm-typeorm` — to exercise their shared `migrateToLatest` /
`seedToLatest` API against a common database.

## Develop

Run from the repo root with a package filter (or omit `-F orm-app` inside this dir):

```bash
pnpm -F orm-app dev        # watch build (tsdown) + typecheck
pnpm -F orm-app build      # production bundle to ./dist
pnpm -F orm-app test       # unit tests (vitest)
pnpm -F orm-app lint
```

### Migrations

Each ORM has its own migrate entrypoint under `src/scripts/`:

```bash
pnpm -F orm-app migrate:drizzle
pnpm -F orm-app migrate:kysely
pnpm -F orm-app migrate:typeorm
pnpm -F orm-app migrate:prisma
```

See each ORM wrapper's own README under `libs/orm-*` for the underlying flow.
