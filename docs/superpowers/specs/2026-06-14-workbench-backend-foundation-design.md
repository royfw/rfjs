# Workbench Backend Foundation — Design

**Date:** 2026-06-14
**Status:** Approved (brainstorming complete; pending writing-plans)
**Scope:** A copyable, production-grade backend foundation for `apps/workbench`, with `@rfjs/*` packages applied, proven end-to-end by one vertical slice (datasets CRUD).

## Purpose & Positioning

The workbench backend is a **hybrid**: the skeleton (layering, repository, auth seams)
is production-grade and open-source-showcase-able, while concrete domain tables start
with demo seed data and get replaced when product logic is privatised. The goal is a
**clean foundation that can be copied** — not a finished product, not a throwaway demo.

This aligns with the repo's open-source/layering strategy: generic, copyable patterns
live here (public-friendly); domain/product specifics stay thin and swappable.

## Architecture

Two axes, kept distinct:

- **Horizontal layers** (responsibility): `delivery → usecase → repository → db`.
- **Vertical slices** (feature/bounded context): `dataset`, `user`, … — each slice owns
  its layers as folders, so a feature change touches one place, not four packages.

```
apps/workbench/      Pure frontend (Next.js). Calls apps/api over HTTP. Never touches DB.
        │ HTTP
        ▼
apps/api/            Fastify thin shell (continues from existing layered app).
                     Handlers: parse request → call libs/core usecase → respond.
        │ import
        ▼
libs/core/           "Clean copyable foundation" — pure TS, no framework, no lambda binding.
  dataset/             ← vertical slice (module = bounded context)
    schema.ts          zod contract = the initial "domain"
    repository.ts      makeDatasetRepository(db) → { findById, list, insert, ... }
    usecase/
      create-dataset.ts  makeCreateDataset({ repo }) → (input) => ...
      list-datasets.ts
    index.ts           barrel; the module's only public surface
  index.ts             package barrel
        │ import (tables + connection)
        ▼
libs/db/             Drizzle plumbing. Scaffolded fresh from the start-ts-by
                     orm-drizzle template (the existing demo libs/orm-drizzle is left untouched).
  src/schema/datasets/  table definitions
  src/db.ts             connection
  drizzle/ scripts/     migrations + seed (own lifecycle)
```

A future `apps/serverless/` (Lambda thin shell) will import the **same** `libs/core`
usecases — that reuse is the payoff of pushing logic down out of the HTTP framework.

## Style & Layer Discipline (YAGNI)

- **Light functional**: repositories and usecases are factory functions with explicit
  dependency injection (deps passed as arguments). No classes, no DI container, no
  decorators. Not pure FP/monads — "functions + plain data + explicit dependencies".
  Chosen for Drizzle fit, serverless cold-start, tree-shaking, testability, and
  AI-agent legibility (no hidden DI magic).
- **Starting layers are only three**: `schema` + `repository` + `usecase`.
- **Deferred until earned**:
  - `domain/` (rich entities/value-objects) — the zod `schema.ts` *is* the domain until
    real invariants/behaviour appear; then promote to a `domain/` folder. No empty classes.
  - `services/` — a generic "services" bucket becomes a junk drawer. When external systems
    are integrated, add a **named adapter** (`storage.ts`, `mailer.ts`) instead.

## ORM Decision

**Drizzle** is the primary ORM in `libs/db`, scaffolded from the start-ts-by
`orm/orm-drizzle` template. Rationale:

- TypeScript-first; types inferred at compile time with **no codegen step** — edits stay
  type-safe immediately (the most AI-agent-friendly property).
- No engine binary → best serverless cold-start (relevant to a future `apps/serverless`).
- Schema/migration/seed built in; the repo's `orm-drizzle` wrapper is already the most
  complete of the four ORM demos.
- Same Postgres camp as `@rfjs/jsonb-query` and `@rfjs/pg-toolkit`.

The repository layer keeps the ORM behind a door: `usecase` never sees Drizzle types,
so the choice stays swappable. We implement **one** ORM in `libs/core` (not four) — the
existing `orm-*` wrappers remain standalone demos in `orm-app`.

## `@rfjs/*` Package Application (the original request)

| Package | Where | Use |
|---|---|---|
| `@rfjs/pg-toolkit` | `libs/db` scripts | check-and-create-db/schema, seed history |
| `@rfjs/jsonb-query` | `libs/core/dataset` repository | build filter queries over a jsonb column on datasets |
| `@rfjs/data-filter` / `@rfjs/data-transform` | `libs/core` usecase or workbench | result shaping / type conversion |
| `@rfjs/retry` | `libs/db` connection, `apps/api` outbound | retry with delay |
| `@rfjs/jwt` | `apps/api` middleware (Phase 6) | auth — deferred |
| `@rfjs/web-core` | `apps/workbench` | tool/package registry (already used) |

## First Vertical Slice: datasets CRUD

End-to-end proof that the skeleton spans every layer. Build order (also the plan spine):

1. **`libs/db`** — scaffold from the orm-drizzle template; add `datasets` table,
   migration, and demo seed.
2. **`libs/core/dataset`** — zod `schema.ts`; `repository.ts` (over `libs/db`);
   `list` / `create` / `get` usecases.
3. **`apps/api`** — a `delivery/http/dataset/` module (routes + handler) calling the
   usecases, wired into swagger.
4. **`apps/workbench`** — datasets page changes from "coming soon" to fetching the list
   from `apps/api`.
5. **Verify** — an E2E test running a create → list round-trip.

### datasets table (initial, demo-seeded)

Minimal columns to prove the slice; refined during planning if needed:

- `id` (uuid, pk)
- `name` (text, not null)
- `description` (text, nullable)
- `data` (jsonb) — payload; the `@rfjs/jsonb-query` filter target
- `createdAt` / `updatedAt` (timestamptz)

## Future: Workflow / Story Module (roadmap, not this iteration)

A likely next direction is a **workflow/story** capability — chaining workbench tools
(parse → flatten → filter → convert, etc.) into a named, repeatable pipeline. Recorded
here so the foundation stays compatible with it.

**Where it lives — two boundaries kept distinct:**

- A workflow is **business logic**, so its home is a **`libs/core` slice**
  (`libs/core/workflow/`), *not* a separate app. A workflow is a **higher-order usecase**
  that composes other tools/usecases.
- A separate app is justified only by a **deployment boundary** (independent scaling,
  different runtime e.g. serverless, separate team/cadence) — never by "it has its own
  business logic". Putting logic in an app would break the runtime-agnostic principle
  this whole design rests on.

Sketch (when built):

```
libs/core/workflow/
  schema.ts            zod for a workflow definition (ordered steps)
  usecase/
    run-workflow.ts    compose: parse → flatten → filter → convert (call tool usecases)
    save-workflow.ts
```

exposed via `apps/api` `delivery/http/workflow/`; a future `apps/serverless` would reuse
the same usecases.

**Open question (decide before building it):** does a workflow even need a backend?
Many workbench tools are pure `@rfjs` functions that run in the browser — if a "story" is
only a chain of pure tools, it is a **client-side workflow** (composed in the workbench
frontend) and needs no API. A backend earns its place only when workflows must be
**persisted / shared / replayed**, or touch **server-side resources** (DB, secrets,
external APIs). This decision is deferred; it determines client-side vs `libs/core` + API.

## Deployment / Serverless Stance

Default runtime is **Fastify (`apps/api`) on k8s**. Serverless is **not built now**;
because logic is runtime-agnostic, a `apps/serverless` Lambda shell can be added later
when an event-driven/bursty workload appears. Self-hosted serverless on k8s
(Knative / OpenFaaS / Fission) is technically possible but operationally heavy —
evaluated separately only if such workloads materialise.

## Error Handling

- **Validation** at the usecase boundary via zod (`schema.parse`), surfacing typed errors.
- **Repository** errors stay DB-specific inside the repository; the repository translates
  them to domain-meaningful results/errors so usecases never branch on Drizzle internals.
- `apps/api` maps usecase/domain errors to HTTP status via the existing Fastify
  route-helper + `@fastify/sensible`.

## Testing

- **Unit**: usecases tested with a fake repository (light-functional DI makes this trivial).
- **Repository**: integration-tested against real Postgres (Docker), consistent with the
  jsonb-query real-PG E2E discipline already established in the repo.
- **Slice E2E**: create → list round-trip through `apps/api`.

## Out of Scope (this iteration)

- Auth / users module (`@rfjs/jwt`) — Phase 6.
- `apps/serverless` — deferred.
- `domain/` and `services/` layers — added only when earned.
- Additional modules beyond `dataset`.
- **Workflow / story module** — recorded as roadmap above; its backend-or-not decision is
  deferred. Not built this iteration.
