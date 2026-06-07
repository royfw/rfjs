# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**rfjs** is a Turborepo monorepo that serves as a template collection for the `start-ts-by` CLI (npm package). It contains production-ready TypeScript project templates for various use cases — apps, libraries, CLIs, docs sites, ORM wrappers, and full monorepo scaffolds.

The repo has three content types:
1. **Apps** (`apps/`) — runnable demo applications (api, web, orm-app)
2. **Packages/Libs** (`packages/`, `libs/`) — shared libraries published to npm
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
pnpm dev                  # start all dev servers
pnpm test                 # run all tests
pnpm lint                 # lint all packages
pnpm typecheck            # type check all packages
pnpm format               # prettier write
pnpm commit               # commitizen (conventional commits)
```

### Per-package commands

Each package/app has its own `package.json` with tasks. Common patterns:
- `pnpm --filter <pkg-name> <command>` — run a command in a specific package
- `pnpm -F api dev` — start the api app dev server
- `pnpm -F @rfjs/pg-toolkit test` — test a specific library

### Testing

Tests use **Vitest** across the monorepo. Each package has its own `vitest.config.mts` (unit) and `vitest.config.e2e.mts` (E2E).

```bash
pnpm test                 # run all tests via turbo
pnpm -F <pkg> vitest:run  # run unit tests for a package
pnpm -F <pkg> vitest:e2e:run  # run E2E tests for a package
pnpm -F <pkg> vitest      # interactive watch mode
```

## Repository Structure

```
apps/                     # Demo applications
  api/                    # Fastify REST API (esbuild)
  orm-app/                # ORM integration demo (tsdown) — consumes all 4 ORM libs
  web/                    # Next.js web app (turbopack)

packages/                 # Shared internal packages + publishable libs
  eslint-config/          # Shared ESLint config (@repo/eslint-config, private)
  typescript-config/      # Shared tsconfig (@repo/typescript-config, private)
  ui/                     # Shared React component library (@repo/ui, private)
  data-filter/            # Data filtering with JSONPath — npm (@rfjs/data-filter)
  data-transform/         # Data type transformation utilities — npm (@rfjs/data-transform)
  jsonb-query/            # PostgreSQL JSONB query builder — npm (@rfjs/jsonb-query)
  jwt/                    # JWT sign/verify/decode helper — npm (@rfjs/jwt)
  mongo-query/            # MongoDB query builder — npm (@rfjs/mongo-query)
  object-utils/           # Object manipulation utilities — npm (@rfjs/object-utils)
  pg-toolkit/             # PostgreSQL utilities — npm (@rfjs/pg-toolkit)
  retry/                  # Retry helper with configurable delay — npm (@rfjs/retry)
  tpl-toolkit/            # Shared config factories for project templates — npm (@rfjs/tpl-toolkit)

libs/                     # ORM wrapper libraries (private, consumed by orm-app)
  orm-drizzle/            # Drizzle ORM wrapper
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

## Template Architecture

Each template in `templates/` is a **standalone project** with its own `package.json`, `node_modules`, and build config. They are NOT part of the pnpm workspace. Templates are registered in `templates/registry.json` and consumed by the `start-ts-by` CLI.

When modifying a template, work inside the template's directory directly (e.g., `templates/apps/fastify-gql-tsdown/`). Use `pnpm install` and `pnpm dev/test/build` within that directory.

### Template build tools
- **esbuild**: `app-esbuild`, `fastify-esbuild`, `koa-esbuild`, `lib-esbuild`
- **tsdown**: `app-tsdown`, `fastify-tsdown`, `fastify-gql-tsdown`, `lib-tsdown`, `bin-tsdown`
- **Rollup**: `lib-rollup`
- **Rolldown**: `lib-rolldown`

## API App Architecture

The `apps/api/` follows a layered Fastify architecture:
- `src/delivery/` — HTTP layer (routes, modules)
- `src/infrastructures/` — Fastify app setup, plugin registration, server bootstrap
- `src/helpers/` — Fastify route helpers, pino transport config
- `src/utils/` — Shared utilities

## CI/CD

CI/CD is split by responsibility: **GitHub Actions owns versioning + npm publish**, **GitLab CI owns only Kubernetes deploy**. The repo lives on GitHub; `.github/workflows/trigger-gitlab-pipeline.yml` mirrors `main`, `release/*`, and `deploy/*` to the GitLab project, but only **triggers** the GitLab pipeline for `deploy/*` (mirror-only on `main` and `release/*`, which have no GitLab jobs).

- **Release branches (GitHub Actions)**: merging a PR into `release/stable` or `release/alpha|beta|rc` runs `cd-version-release.yml` / `cd-version-release-prerelease.yml`, which call `royfw/rf-devops/.github/workflows/_changesets-version-channel-turbo.yml` to run changeset versioning, push the bump back to the release branch, and open a PR back to `main`. (rf-devops is being migrated into `github-toolkit`; the caller will repoint once ported.)
- **Publish (GitHub Actions)**: `cd-publish-npmjs.yml` is a manual `workflow_dispatch` (Actions tab → Run workflow). It checks out the versioned branch (default `publish/npmjs`) and runs plain `changeset publish` — which publishes every public package whose version isn't yet on npm and skips private ones. (GitLab's toolkit publish guards on `changeset status`, which wrongly reports "no releases" once versioning has consumed the changesets — so publish lives on GitHub instead. `@rfjs/jsonb-query` is held back via `"private": true`, the only thing `changeset publish` honors.)
- **Deploy branch (GitLab)**: `deploy/dev` runs build + Kubernetes deploy (`detect_project` / `trigger_project`). `deploy/prod` is not wired yet, and per-service Helm overlays under `.deploy/env/royfw-dev/helm/` are still pending (apps build to Harbor but `[skip-deploy]` until overlays exist).

See `GITLAB_CI.md` for the full CI variable, environment, and flow reference.

## Versioning and Changesets

- Uses **Changesets** for version management (`pnpm changeset:add` to create a changeset)
- Not in pre-release mode (no `.changeset/pre.json`); `release/stable` produces stable versions. Prerelease channels are entered per-branch by the `release/alpha|beta|rc` versioning workflow.
- `@rfjs/jsonb-query` is held back from publish via the changeset `ignore` list in `.changeset/config.json` until its Phase 2 (object/array) support lands.
- Changelog: `@changesets/cli/changelog`
- Release workflow: `pnpm changeset:add` → commit to `main` → PR `main → release/*` and merge (GitHub Actions versions, opens a PR back to `main`) → merge the versioned state to `publish/npmjs` (GitLab publishes to npm)

## Git Hooks

- **pre-commit**: runs `turbo run lint-staged test --affected`
- **commit-msg**: runs `commitlint --edit` (conventional commits)
