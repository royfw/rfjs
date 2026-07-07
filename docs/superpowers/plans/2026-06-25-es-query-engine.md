# filter-builder `es-query` Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register `@rfjs/es-query` as a `filter-builder` engine so the canonical filter-tree compiles to an Elasticsearch / OpenSearch query, joining the existing `jsonb` / `data-filter` / `pg-filter` / `sql-filter` / `mongo` engines.

**Architecture:** A new `engines/es-query.ts` mirrors `engines/mongo.ts`: declare per-`dataType` operator specs and a `compile(group, ctx)` that maps the canonical `FilterGroupLike` → `EsFilterMetadata` and runs `buildEsQuery`. Add `"es-query"` to the `EngineId` union and the registry.

**Tech Stack:** TypeScript 5.7, Vitest, `@rfjs/es-query` (new workspace dep), `@rfjs/data-transform` (existing dep, for `DataType`).

## Global Constraints

- **Package:** `@rfjs/filter-builder` (already publishable). Add `@rfjs/es-query` as `workspace:*` dependency.
- **Canonical operator vocabulary** (from `engines/arity.ts` + `engines/mongo.ts`): `eq neq gt gte lt lte range terms nin contains startswith endswith isnull isnotnull` (plus object/array variants). Canonical `dataType`: `string numeric date boolean object array`. Canonical `logic`: `and or nor not`.
- **No third-party runtime deps added.** Tests: Vitest, `globals: true`. Commit per green step.
- The es-query engine must support `not` (es-query maps `not`→`must_not`; unlike mongo it does NOT throw on `not`).

---

## File Structure

```
packages/filter-builder/
  package.json                      # + @rfjs/es-query dependency
  src/engines/types.ts              # EngineId += "es-query"
  src/engines/es-query.ts           # NEW engine
  src/engines/es-query.spec.ts      # NEW
  src/engines/index.ts              # register in ENGINES + ENGINE_IDS
  src/engines/index.spec.ts         # (extend if present, else covered by es-query.spec)
  .changeset/es-query-engine.md     # NEW
```

---

### Task 1: The `es-query` engine module

**Files:**
- Modify: `packages/filter-builder/package.json` (add dependency)
- Modify: `packages/filter-builder/src/engines/types.ts` (EngineId union)
- Create: `packages/filter-builder/src/engines/es-query.ts`
- Test: `packages/filter-builder/src/engines/es-query.spec.ts`

**Interfaces:**
- Consumes: `buildEsQuery`, `EsConditionType`, `EsFieldCondition`, `EsFilterMetadata` from `@rfjs/es-query`; `DataType` from `@rfjs/data-transform`; `FilterConditionLike`/`FilterGroupLike` from `../compile`; `arityOf`, `Engine`, `OperatorSpec`, `CompileContext` from `./{arity,types}`.
- Produces: `export const esQueryEngine: Engine` with `id: "es-query"`.

- [ ] **Step 1: Add the dependency**

In `packages/filter-builder/package.json`, add to `dependencies` (keep alphabetical-ish with the others):
```json
    "@rfjs/es-query": "workspace:*",
```
Then run (from repo root): `pnpm install` and `pnpm -F @rfjs/es-query build` (ensure dep types exist).

- [ ] **Step 2: Extend the `EngineId` union**

In `packages/filter-builder/src/engines/types.ts`, change:
```ts
export type EngineId = "jsonb" | "data-filter" | "pg-filter" | "sql-filter" | "mongo";
```
to:
```ts
export type EngineId = "jsonb" | "data-filter" | "pg-filter" | "sql-filter" | "mongo" | "es-query";
```

- [ ] **Step 3: Write the failing test**

Create `packages/filter-builder/src/engines/es-query.spec.ts`:
```ts
import { describe, it, expect } from "vitest";
import { esQueryEngine } from "./es-query";
import type { FilterGroupLike } from "../compile";
import type { CompileContext } from "./types";

const ctx: CompileContext = { fields: [] };

describe("esQueryEngine", () => {
  it("declares operators per data type", () => {
    const stringOps = esQueryEngine.operators("string").map((s) => s.op);
    expect(stringOps).toContain("contains");
    expect(stringOps).not.toContain("gt");
    const numOps = esQueryEngine.operators("numeric").map((s) => s.op);
    expect(numOps).toContain("gt");
    expect(numOps).toContain("range");
  });

  it("compiles an and-group to a bool/must query", () => {
    const group: FilterGroupLike = {
      logic: "and",
      filters: [
        { field: "status", dataType: "string", operator: "eq", value: "open" },
        { field: "age", dataType: "numeric", operator: "gt", value: 18 },
      ],
    };
    const out = esQueryEngine.compile(group, ctx);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(JSON.parse(out.primary)).toEqual({
        bool: { must: [{ term: { status: "open" } }, { range: { age: { gt: 18 } } }] },
      });
    }
  });

  it("maps canonical operators (range→between, terms→in, isnotnull→exists)", () => {
    const group: FilterGroupLike = {
      logic: "or",
      filters: [
        { field: "score", dataType: "numeric", operator: "range", value: [1, 10] },
        { field: "tag", dataType: "string", operator: "terms", value: ["a", "b"] },
        { field: "email", dataType: "string", operator: "isnotnull" },
      ],
    };
    const out = esQueryEngine.compile(group, ctx);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(JSON.parse(out.primary)).toEqual({
        bool: {
          should: [
            { range: { score: { gte: 1, lte: 10 } } },
            { terms: { tag: ["a", "b"] } },
            { exists: { field: "email" } },
          ],
          minimum_should_match: 1,
        },
      });
    }
  });

  it("supports not groups", () => {
    const group: FilterGroupLike = {
      logic: "not",
      filters: [{ field: "status", dataType: "string", operator: "eq", value: "archived" }],
    };
    const out = esQueryEngine.compile(group, ctx);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(JSON.parse(out.primary)).toEqual({
        bool: { must_not: [{ term: { status: "archived" } }] },
      });
    }
  });

  it("returns an error for an unsupported operator", () => {
    const group: FilterGroupLike = {
      logic: "and",
      filters: [{ field: "tags", dataType: "array", operator: "hasallkeys", value: ["x"] }],
    };
    const out = esQueryEngine.compile(group, ctx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("esUnsupportedOp");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm -F @rfjs/filter-builder vitest:run es-query`
Expected: FAIL — cannot find module `./es-query`.

- [ ] **Step 5: Write `engines/es-query.ts`**

```ts
import {
  buildEsQuery,
  type EsConditionType,
  type EsFieldCondition,
  type EsFilterMetadata,
} from "@rfjs/es-query";
import type { DataType, ValueType } from "@rfjs/data-transform";

import type { FilterConditionLike, FilterGroupLike } from "../compile";
import { arityOf } from "./arity";
import type { CompileContext, Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
const STRING_OPS = ["eq", "neq", "contains", "startswith", "endswith", "terms", "nin", ...NULL_OPS];
const COMPARABLE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "range", "terms", "nin", ...NULL_OPS];
const BOOLEAN_OPS = ["eq", "neq", ...NULL_OPS];
const OBJECT_OPS = ["eq", "neq", ...NULL_OPS];
const ARRAY_OPS = ["eq", "terms", "nin", ...NULL_OPS];

function scalarOps(dataType: string): string[] {
  if (dataType === "string") return STRING_OPS;
  if (dataType === "boolean") return BOOLEAN_OPS;
  return COMPARABLE_OPS; // numeric / date
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({ op, arity: arityOf(op) }));
}

function toEsDataType(dataType: string): DataType {
  if (dataType === "numeric") return "number";
  if (dataType === "date") return "date";
  if (dataType === "boolean") return "boolean";
  if (dataType === "string") return "string";
  return "any"; // object / array
}

// Canonical builder operator -> es-query condition.
const OP_MAP: Record<string, EsConditionType> = {
  eq: "eq",
  neq: "neq",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
  range: "between",
  terms: "in",
  nin: "notIn",
  contains: "contains",
  startswith: "startsWith",
  endswith: "endsWith",
  isnull: "isNull",
  isnotnull: "exists",
};

function toEsCondition(leaf: FilterConditionLike): EsFieldCondition {
  const condition = OP_MAP[leaf.operator];
  if (!condition) throw new Error("esUnsupportedOp:" + leaf.operator);
  return {
    field: leaf.field,
    condition,
    dataType: toEsDataType(leaf.dataType),
    value: leaf.value as ValueType | ValueType[],
  };
}

function toEsGroup(group: FilterGroupLike): EsFilterMetadata {
  return {
    logic: group.logic as EsFilterMetadata["logic"],
    filters: group.filters.map((node) =>
      "logic" in node
        ? toEsGroup(node as FilterGroupLike)
        : toEsCondition(node as FilterConditionLike),
    ),
  };
}

export const esQueryEngine: Engine = {
  id: "es-query",
  label: "es-query (Elasticsearch / OpenSearch)",
  operators(dataType) {
    if (dataType === "object") return toSpecs(OBJECT_OPS);
    if (dataType === "array") return toSpecs(ARRAY_OPS);
    return toSpecs(scalarOps(dataType));
  },
  compile(group: FilterGroupLike, _ctx: CompileContext) {
    try {
      const query = buildEsQuery(toEsGroup(group), { dialect: "elasticsearch" });
      return { ok: true, primary: JSON.stringify(query, null, 2) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "queryFailed";
      return { ok: false, error: msg };
    }
  },
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm -F @rfjs/filter-builder vitest:run es-query`
Expected: PASS (all 5 cases).

- [ ] **Step 7: Commit**

```bash
git add packages/filter-builder/package.json packages/filter-builder/src/engines/types.ts packages/filter-builder/src/engines/es-query.ts packages/filter-builder/src/engines/es-query.spec.ts pnpm-lock.yaml
git commit -m "feat(filter-builder): add es-query engine module"
```

---

### Task 2: Register in the engine registry + changeset

**Files:**
- Modify: `packages/filter-builder/src/engines/index.ts`
- Test: `packages/filter-builder/src/engines/index.spec.ts` (create if absent)
- Create: `.changeset/es-query-engine.md`

**Interfaces:**
- Consumes: `esQueryEngine` from `./es-query`.
- Produces: `getEngine("es-query")` resolves; `ENGINE_IDS` includes `"es-query"`.

- [ ] **Step 1: Write the failing test**

Create `packages/filter-builder/src/engines/index.spec.ts` (or append the cases if the file exists):
```ts
import { describe, it, expect } from "vitest";
import { getEngine, ENGINE_IDS } from "./index";

describe("engine registry", () => {
  it("includes es-query in ENGINE_IDS", () => {
    expect(ENGINE_IDS).toContain("es-query");
  });
  it("resolves the es-query engine", () => {
    const e = getEngine("es-query");
    expect(e.id).toBe("es-query");
    expect(typeof e.compile).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/filter-builder vitest:run engines/index`
Expected: FAIL — `getEngine("es-query")` is `undefined` (and/or `ENGINE_IDS` lacks it).

- [ ] **Step 3: Register the engine**

In `packages/filter-builder/src/engines/index.ts`:
- add the import: `import { esQueryEngine } from "./es-query";`
- add to the `ENGINES` record: `"es-query": esQueryEngine,`
- add to `ENGINE_IDS`: `"es-query"` (append to the array).

Resulting `ENGINES` / `ENGINE_IDS`:
```ts
const ENGINES: Record<EngineId, Engine> = {
  jsonb: jsonbEngine,
  "data-filter": dataFilterEngine,
  "pg-filter": pgFilterEngine,
  "sql-filter": sqlFilterEngine,
  mongo: mongoEngine,
  "es-query": esQueryEngine,
};

export const ENGINE_IDS: EngineId[] = ["jsonb", "data-filter", "pg-filter", "sql-filter", "mongo", "es-query"];
```

- [ ] **Step 4: Run test + full suite + typecheck + build**

```bash
pnpm -F @rfjs/filter-builder vitest:run
pnpm -F @rfjs/filter-builder typecheck
pnpm -F @rfjs/filter-builder build
```
Expected: all PASS; typecheck clean (the `Record<EngineId, Engine>` now requires the `"es-query"` entry, which is present); build produces `dist`.

- [ ] **Step 5: Add a changeset**

Create `.changeset/es-query-engine.md`:
```markdown
---
'@rfjs/filter-builder': minor
---

Add the `es-query` engine: compile the canonical filter-tree to an Elasticsearch / OpenSearch `bool` query via `@rfjs/es-query`. Available through `getEngine('es-query')`.
```

- [ ] **Step 6: Commit**

```bash
git add packages/filter-builder/src/engines/index.ts packages/filter-builder/src/engines/index.spec.ts .changeset/es-query-engine.md
git commit -m "feat(filter-builder): register es-query in the engine registry"
```

---

## Self-Review

**Spec coverage (§3 of design — filter-builder engine):**
- `getEngine('es-query')` registration → Task 2. ✅
- ES operators declared via `arity.ts`/`operators()` (per-dataType specs, arity from `arityOf`) → Task 1. ✅
- Canonical tree → es-query compile (logic + operator mapping, incl. `not`) → Task 1. ✅

**Placeholder scan:** none.

**Type consistency:** `esQueryEngine.id === "es-query"` matches the `EngineId` union member added in Task 1 Step 2 and the `ENGINES` key in Task 2. `OP_MAP` values are typed `EsConditionType` (compile error if a non-existent condition is used). `toEsDataType` returns `DataType` (es-query's `EsFieldCondition.dataType`). ✅

---

## Follow-on plan (not in this plan)

1. **apps/web tool** — `src/tools/es-query-builder/` interactive demo calling `getEngine('es-query')` (+ dialect toggle) + en/zh i18n; register `@rfjs/es-query` and `@rfjs/es-client` in `packageRegistry`.
