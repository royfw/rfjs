# Node 24.16 Upgrade + Turbo `dev` Scope Implementation Plan

> **For agentic workers:** Mechanical config sweep. Decisions are locked (see below); steps are verification + commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `pnpm dev` failing with "19 persistent tasks > concurrency 10" by scoping the root `dev` task to apps, and bump the pinned Node toolchain version to 24.16 across the workspace and templates.

**Architecture:** Two independent chore changes shipped together — (1) Turborepo `dev` task scoping + a `dev:all` escape hatch, (2) a repo-wide Node version pin bump. No source/logic changes; isolated in worktree `worktree-chore-node24-turbo-dev` to avoid colliding with the parallel apps/api session.

**Tech Stack:** Turborepo 2.6.1, pnpm 10.24.0 workspace, `.nvmrc`, Docker `ARG NODE_VERSION`, GitHub Actions.

---

## Locked Decisions (from brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| Root `pnpm dev` scope | `turbo dev --filter=./apps/*` (4 apps) + add `dev:all` = `turbo dev --concurrency=22` | 19 persistent tasks > default concurrency 10 → turbo refuses to start. Apps-only = 4 persistent, well under 10. web-core/web-ui are source-consumed (transpilePackages) so always live; dist-consumed libs covered by `pnpm dev --filter=web...` on demand. Avoids inotify-watch-limit blowups seen earlier. |
| `dev` task prerequisite | add `dependsOn: ["^build"]` | Ensures dist-consuming libs (`@rfjs/data-filter` etc.) are built before app dev servers start, since apps import their `dist/`. |
| Node version scope | main workspace **+ templates/** | Bump everything; also repairs pre-existing drift (docs templates were 22.12, fastify/turbo 22.21). |
| `engines.node` | **keep `>=18`** (untouched) | `.nvmrc` pins the dev toolchain; `engines` is the minimum-supported floor. Raising published `@rfjs/*` floors to `>=24` is semver-meaningful (would warn Node 18/20 consumers). CLAUDE.md "Node: >=18" stays accurate. |
| Version string | `.nvmrc` → `v24.16.0`; Docker `ARG NODE_VERSION=24.16` (→ `node:24.16-slim`) | Matches existing formats (`v22.21.1` full-patch in nvmrc; `22.21` minor in Docker ARG). |

## File Inventory (74 files, already edited)

- **Turbo dev:** `package.json` (root `dev` + new `dev:all`), `turbo.json` (`dev.dependsOn`)
- **`.nvmrc` → `v24.16.0`:** root + 14 workspace (apps×2, packages×9, libs×4... see git status) + ~20 templates = all `.nvmrc` except node_modules
- **Dockerfile `ARG NODE_VERSION=24.16`:** 35 Dockerfiles (apps/api, apps/orm-app, all templates, all `docker/Dockerfile.turbo*` variants)
- **CI `node-version: 24`:** `.github/workflows/ci-e2e-jsonb-query.yml`, `.github/workflows/cd-publish-npmjs.yml`
- **Untouched on purpose:** all `engines.node` (`>=18`), `CLAUDE.md` (text stays correct), `packageManager` pin

## Verification Steps

- [ ] **Step 1: No stray old version strings remain**

```bash
# Expect zero hits (excluding node_modules)
grep -rn 'NODE_VERSION=22\|node-version: 22' --include=Dockerfile* --include=*.yml . | grep -v node_modules
find . -name .nvmrc | grep -v node_modules | xargs grep -L '^v24.16.0' # expect empty
```
Expected: both empty.

- [ ] **Step 2: turbo `dev` task config is valid**

```bash
pnpm exec turbo dev --filter=./apps/* --dry-run=json | head -40
```
Expected: lists only apps (api, orm-app, web, workbench) dev tasks; no concurrency error.

- [ ] **Step 3: frozen install still clean (no lockfile churn — none expected, no dep changes)**

```bash
pnpm install --frozen-lockfile
```
Expected: success, lockfile unchanged.

- [ ] **Step 4: build all (confirms `dev dependsOn ^build` graph + Node bump don't break build)**

```bash
pnpm build
```
Expected: all apps + packages build.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: bump pinned node to 24.16 and scope turbo dev to apps"
```

## Notes

- `.nvmrc` carries **no trailing newline** (matches existing byte format).
- This branch is isolated from the parallel apps/api session; it does touch `apps/api/.nvmrc` + Dockerfiles, so it must merge before or be rebased against any API-session changes to those files.
- `pnpm dev:all` remains available for the rare "watch every package" case.
