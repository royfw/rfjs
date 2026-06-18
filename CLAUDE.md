# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**rfjs** is a Turborepo monorepo that serves as a template collection for the `start-ts-by` CLI (npm package). It contains production-ready TypeScript project templates for various use cases — apps, libraries, CLIs, docs sites, ORM wrappers, and full monorepo scaffolds.

The repo has three content types:
1. **Apps** (`apps/`) — runnable applications: `api`, `web`, `orm-app`, and `workbench`. Beyond demos, `web` + `workbench` + `api` + `libs/core` + `libs/db` form a real working product — a **dataset explorer** with a visual query builder (see "Workbench Stack" and "Web App" below).
2. **Packages/Libs** (`packages/`, `libs/`) — shared libraries; the publishable ones go to npm under `@rfjs/*`, the rest are private workspace deps.
3. **Templates** (`templates/`) — standalone project templates distributed via `start-ts-by` CLI, registered in `templates/registry.json`

## Environment

- **Node**: >=18 (see `.nvmrc` for current version)
- **Package manager**: pnpm >=10.24.0 (enforced by `preinstall` script and `.npmrc` strict settings)
- **TypeScript**: 5.7+

## Common Commands

All root-level commands delegate to Turborepo. Run from repo root unless noted.

```bash
pnpm install              # install dependencies (use --frozen-lockfile in CI)
pnpm build                # build all apps and packages
pnpm build:packages       # build only @rfjs/* packages
pnpm dev                  # start the app dev servers (apps/*); see note below
pnpm dev -F web           # start only one app/package's dev server
pnpm test                 # run all tests
pnpm lint                 # lint all packages
pnpm typecheck            # type check all packages
pnpm format               # prettier write
pnpm commit               # commitizen (conventional commits)
```

`pnpm dev` runs `scripts/dev.mjs`: with no filter it scopes to the app dev servers (`--filter=./apps/*`) so the ~25 package/lib watchers don't all start at once (that trips the inotify watch limit); pass `-F`/`--filter` and it steps aside so turbo scopes to exactly what you asked (`pnpm dev -F web` → only `web`). All run with `--concurrency=22`. `pnpm dev:all` still starts every package's watcher. Dev ports: `web` → 3000, `workbench` → 3001, `api` → `PORT` (default 3000) — so set `PORT` on `api` when running it alongside `web`; `workbench` reaches `api` via its API base URL (default `http://localhost:3000`).

### Per-package commands

Each package/app has its own `package.json` with tasks. Common patterns:
- `pnpm --filter <pkg-name> <command>` — run a command in a specific package
- `pnpm -F api dev` — start the api app dev server
- `pnpm -F @rfjs/pg-toolkit test` — test a specific library

### Testing

Tests use **Vitest** across the monorepo. Most testable packages have a `vitest.config.mts` (unit); a handful (e.g. `pg-toolkit`, `jsonb-query`, the ORM libs) also have a `vitest.config.e2e.mts` (E2E). The Next.js apps (`web`, `workbench`) run `vitest run` directly.

```bash
pnpm test                 # run all tests via turbo
pnpm -F <pkg> vitest:run  # run unit tests for a package
pnpm -F <pkg> vitest:e2e:run  # run E2E tests for a package
pnpm -F <pkg> vitest      # interactive watch mode
```

## Repository Structure

```
apps/                     # Runnable applications
  api/                    # Fastify REST API (esbuild) — serves the workbench dataset endpoints
  orm-app/                # ORM integration demo (tsdown) — consumes all 4 ORM libs
  web/                    # Next.js web app (port 3000) — package/tool showcase
  workbench/              # Next.js admin app (port 3001) — dataset explorer w/ visual query builder

packages/                 # Shared internal packages + publishable libs
  # --- publishable @rfjs/* (npm) ---
  data-expr/              # Safe JSON expression engine (JSONata wrapper)
  data-filter/            # In-memory filtering & mapping (object/array/elemmatch, computed `=` expressions)
  data-label/             # Compose display label strings from data paths/maps/templates
  data-transform/         # Data type transformation utilities
  jsonb-query/            # PostgreSQL JSONB WHERE/ORDER BY builder (legacy + jsonpath dialects)
  sql-filter/             # Generic boolean filter-group → parameterized SQL, pluggable leaf renderers
  pg-filter/              # Unified PG filter: nests column + jsonb conditions in one tree (uses sql-filter + jsonb-query)
  filter-builder/         # Framework-agnostic canonical filter-tree: edit model, schema inference, reverse parse, compile to engines
  mongo-query/            # MongoDB query builder
  jwt/                    # JWT sign/verify/decode helper
  object-utils/           # Object manipulation utilities
  pg-toolkit/             # PostgreSQL admin utilities (seed history, DB/schema creation)
  retry/                  # Retry helper with configurable delay
  tpl-toolkit/            # Shared config factories for project templates
  # --- private workspace deps ---
  web-core/               # apps/web + workbench tool/package registry + zod schemas (@rfjs/web-core)
  web-ui/                 # Tailwind preset + design tokens + shadcn components for web/workbench (@rfjs/web-ui)
  filter-builder-ui/      # React filter-tree editor over @rfjs/filter-builder (@rfjs/filter-builder-ui)
  eslint-config/, ui/     # empty placeholders (no source, no consumers yet)

libs/                     # Private workspace libs
  core/                   # Workbench business logic — per-module schema/repository/usecase (@rfjs/core)
  db/                     # Workbench Drizzle plumbing — connection, schema, migrations, seed (@rfjs/db)
  orm-drizzle/            # Drizzle ORM wrapper      (these 4 are consumed by orm-app)
  orm-kysely/             # Kysely ORM wrapper
  orm-prisma/             # Prisma ORM wrapper
  orm-typeorm/            # TypeORM wrapper

templates/                # Standalone project templates (start-ts-by CLI)
  apps/                   # App templates: app-esbuild, app-tsdown, fastify-*, koa-esbuild
  bins/                   # CLI templates: bin-tsdown
  libs/                   # Library templates: lib-esbuild, lib-rollup, lib-tsdown, lib-rolldown
  docs/                   # Docs templates: docs-docsify, docs-vitepress
  monorepo/               # Monorepo template: turbo/stack/base
  bullmq/                 # BullMQ templates: bull-api, lib-queue
  orm/                    # ORM templates: orm-drizzle, orm-kysely, orm-prisma, orm-typeorm
  registry.json           # Template registry for start-ts-by CLI
```

## Package Source Layout (`packages/*/src`)

Package `src/` structure is **size-driven, not uniform** — don't force every package into the same shape:

- **Flat** (modules directly under `src/`) for small, single-purpose packages (≤ ~7 source modules). Examples: `data-expr`, `data-label`, `object-utils`, `data-transform`, `mongo-query`, `jwt`, `retry`.
- **Subfolders by responsibility** once a package crosses ~8 source modules *or* has a clear sub-domain. Each subfolder gets a barrel `index.ts`. Examples: `data-filter` (`alias/`, `filter/`, `match/`, `path/`, `types/`), `pg-toolkit` (`pure/` vs side-effecting `admin/`), `jsonb-query` (`dialect/` groups the base contract + `legacy`/`jsonpath` dialects + jsonpath `escape`).

Conventions that hold regardless of shape:
- **Co-locate tests**: `*.spec.ts` next to the source it covers (the vitest glob is `src/**/*.spec.ts`).
- **One barrel per folder**: a subfolder's `index.ts` re-exports its public surface; the package root `src/index.ts` is the only entry in `package.json` `exports` (no deep subpaths) — so internal moves never change the published API.
- **File naming**: PascalCase for class modules (`TextMatch.ts`, `NumericMatch.ts`), camelCase for function/util modules (`matchQuery.ts`, `objectCompare.ts`).

When a package outgrows flat, group by **what changes together** (responsibility/sub-domain), not by technical layer.

## Filter / Query-Builder Package Stack

Several packages compose into one filter pipeline (they are **layered, not redundant**). The shared mental model is a **filter tree** — nested `and`/`or`/`nor`/`not` groups whose leaves are field conditions — that gets *built* in the UI and *compiled* to different execution targets.

Execution engines (low level, each independently usable):
- **`sql-filter`** — the generic core. Walks a `FilterGroup<L>` tree and emits parameterized SQL, delegating each leaf to a pluggable `renderLeaf`. Zero deps. Knows tree/logic, not what a leaf means.
- **`jsonb-query`** — JSONB specialist. Compiles filter metadata into PG `WHERE`/`ORDER BY` over a JSONB column (`legacy` `#>>`+cast dialect or `jsonpath` for PG12+). Zero deps, standalone.
- **`pg-filter`** — composes `sql-filter` + `jsonb-query`. A single tree mixes `target: 'column'` leaves (plain SQL columns) and `target: 'jsonb'` leaves (paths into a JSONB column); `buildPgFilter` emits unified `where`/`orderBy`/`limit`/`offset`/`values`.
- **`data-filter`** — the in-memory engine (not SQL): evaluates the same tree shape against JS objects.

Orchestration (high level):
- **`filter-builder`** — framework-agnostic **canonical tree** with stable node IDs (`BuilderGroup`/`BuilderCondition`) for editing. Provides tree-ops (add/remove/update), schema inference from data, **reverse parse** (compiled result → tree), live in-memory match, and a registry of **engines** (`getEngine('pg-filter'|'jsonb'|'data-filter')`) that compile the tree to each target. `treeToFilterGroup` strips IDs to the shared `FilterGroupLike`; `treeToPgFilterGroup` produces a `pg-filter` group.
- **`filter-builder-ui`** — thin React layer over `filter-builder`: `<FilterTreeEditor>` + `useFilterTree()` hook, styled with `@rfjs/web-ui`, labels-as-props. It edits/holds tree state only; compilation/execution stays in `filter-builder`. Consumed via Next.js `transpilePackages` (no build step).

Rule of thumb: **edit** with `filter-builder(-ui)`, **execute** with `pg-filter`/`jsonb-query`/`sql-filter`/`data-filter`. Don't reach into an engine directly from UI code; go through `filter-builder`'s engine registry.

## Template Architecture

Each template in `templates/` is a **standalone project** with its own `package.json`, `node_modules`, and build config. They are NOT part of the pnpm workspace. Templates are registered in `templates/registry.json` and consumed by the `start-ts-by` CLI.

When modifying a template, work inside the template's directory directly (e.g., `templates/apps/fastify-gql-tsdown/`). Use `pnpm install` and `pnpm dev/test/build` within that directory.

### Template build tools
- **esbuild**: `app-esbuild`, `fastify-esbuild`, `koa-esbuild`, `lib-esbuild`
- **tsdown**: `app-tsdown`, `fastify-tsdown`, `fastify-gql-tsdown`, `lib-tsdown`, `bin-tsdown`
- **Rollup**: `lib-rollup`
- **Rolldown**: `lib-rolldown`

## Workbench Stack (workbench → api → core → db)

The dataset explorer is a four-tier stack. **`apps/workbench` is a pure REST client — it never imports `@rfjs/core` or `@rfjs/db`**; all data flows through `apps/api`.

```
apps/workbench (Next.js)  ──fetch──▶  apps/api (Fastify)  ──▶  @rfjs/core  ──▶  @rfjs/db  ──▶  PostgreSQL
  visual query builder        REST: /datasets,            usecase →        Drizzle conn,
  (filter-builder-ui)         /datasets/query            repository       schema, migrate, seed
```

- **`apps/api`** — layered Fastify:
  - `src/delivery/` — HTTP layer (routes, handlers per module, e.g. `dataset/`)
  - `src/infrastructures/` — Fastify app/plugin/server bootstrap; `infrastructures/datasource/` wires `createDb()` → `makeDatasetRepository(db)` → usecases
  - `src/helpers/` — route helpers, pino transport config; `src/utils/` — shared utils
- **`libs/core` (`@rfjs/core`)** — business logic, **one folder per module** (currently `dataset`) following **schema → repository → usecase**:
  - `schema.ts` (Zod domain + input schemas), `query-schema.ts` (validates pg-filter trees + sort)
  - `repository.ts` — interface + `make<X>Repository(db)` factory; complex `query()` builds SQL via `@rfjs/pg-filter` and runs raw `db.$client.query()` (faster than Drizzle's builder for arbitrary filter trees), then maps rows → domain
  - `usecase/*.ts` — curried `(deps:{repo}) => (input) => Promise<…>`, validating at the boundary. **No DB access here** — it's injected via the repo.
- **`libs/db` (`@rfjs/db`)** — Drizzle plumbing for PostgreSQL: `createDb(connStr, schema?, useClient?)`, table defs under `src/schema/<module>/table.ts` (datasets use a `jsonb` `data` column), and `src/scripts/` for migrate/seed/`check-and-create-db|schema`. Migrations generated with `pnpm -F @rfjs/db generate` into `./drizzle/`.

**Adding a module** (e.g. `reports`): table + migration in `@rfjs/db` → `schema/repository/usecase` folder in `@rfjs/core` → instantiate repo+usecases in `api/.../datasource` and add handlers/routes → (optionally) a `workbench` page that fetches the new endpoints.

## Web App Architecture (`apps/web`, `apps/workbench`)

Both Next.js apps are **registry-driven**. `@rfjs/web-core` holds the single source of truth: `toolRegistry` (feature "tools", each with `id`/`category`/`surface`/`status`/`relatedPackages`) and `packageRegistry` (the `@rfjs/*` catalog), all Zod-validated. Nav and routing are derived from these registries — there's no hardcoded menu.

- **`apps/web`** — public showcase. Each tool lives in `src/tools/<tool>/` as a self-contained module: `index.ts` (a `ToolModule` descriptor), `ui.tsx` (`"use client"`), pure logic file, `messages.ts` (i18n), and co-located `*.spec.ts`. Tools mount dynamically by slug. A tool's `surface` is `web` (sidebar/package-tree driven) or `workbench` (standalone).
- **`apps/workbench`** — admin surface: `[locale]` routing (next-intl, en + zh-TW), a `(shell)` layout (sidebar/topbar/command-menu, Zustand stores), PWA manifest/icons, and the `dataset-explorer` (composes `filter-builder-ui` + `pg-filter`).
- **UI/config packages**: `@rfjs/web-ui` is the shared design system (Tailwind preset + tokens + shadcn/Radix components) consumed by both apps; `@rfjs/filter-builder-ui` is the editor component. Private `@rfjs/*` UI packages are pulled in via Next.js **`transpilePackages`** (dev-time, no build/publish step). `packages/eslint-config` and `packages/ui` are empty placeholders — eslint config is currently app-local.

## CI/CD

CI/CD is split by responsibility: **GitHub Actions owns versioning + npm publish**, **GitLab CI owns only Kubernetes deploy**. The repo lives on GitHub; `.github/workflows/trigger-gitlab-pipeline.yml` mirrors `main`, `release/*`, and `deploy/*` to the GitLab project, but only **triggers** the GitLab pipeline for `deploy/*` (mirror-only on `main` and `release/*`, which have no GitLab jobs).

- **Release branches (GitHub Actions)**: merging a PR into `release/stable` or `release/alpha|beta|rc` runs `cd-version-release.yml` / `cd-version-release-prerelease.yml`, which call `royfw/rf-devops/.github/workflows/_changesets-version-channel-turbo.yml` to run changeset versioning, push the bump back to the release branch, and open a PR back to `main`. (rf-devops is being migrated into `github-toolkit`; the caller will repoint once ported.)
- **Publish (GitHub Actions)**: `cd-publish-npmjs.yml` is a manual `workflow_dispatch` (Actions tab → Run workflow). It checks out the versioned branch (default `publish/npmjs`) and runs plain `changeset publish` — which publishes every public package whose version isn't yet on npm and skips private ones. (GitLab's toolkit publish guards on `changeset status`, which wrongly reports "no releases" once versioning has consumed the changesets — so publish lives on GitHub instead. To hold a package back from publish, set `"private": true` — the only thing `changeset publish` honors.)
- **Deploy branch (GitLab)**: `deploy/dev` runs build + Kubernetes deploy (`detect_project` / `trigger_project`). `deploy/prod` is not wired yet, and per-service Helm overlays under `.deploy/env/royfw-dev/helm/` are still pending (apps build to Harbor but `[skip-deploy]` until overlays exist).

See `GITLAB_CI.md` for the full CI variable, environment, and flow reference.

## Versioning and Changesets

- Uses **Changesets** for version management (`pnpm changeset:add` to create a changeset)
- Not in pre-release mode (no `.changeset/pre.json`); `release/stable` produces stable versions. Prerelease channels are entered per-branch by the `release/alpha|beta|rc` versioning workflow.
- The changeset `ignore` list in `.changeset/config.json` is currently empty. To hold a package back from a release, add it there (or set `"private": true`).
- Changelog: `@changesets/cli/changelog`
- Release workflow: `pnpm changeset:add` → commit to `main` → PR `main → release/*` and merge (GitHub Actions versions, opens a PR back to `main`) → merge the versioned state to `publish/npmjs` → run the `cd-publish-npmjs.yml` workflow (GitHub Actions publishes to npm)

## Git Hooks

- **pre-commit**: runs `turbo run lint-staged test --affected`
- **commit-msg**: runs `commitlint --edit` (conventional commits)
