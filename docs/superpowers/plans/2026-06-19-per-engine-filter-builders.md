# Per-Engine Filter Builders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three new per-engine filter-builder tools in `apps/web` — `jsonb-query-builder`, `sql-filter-builder`, `mongo-query-builder` — each cloning the merged `data-filter-builder` design, and retire the old toggle-based `query-builder` showcase tool.

**Architecture:** The merged `data-filter-builder` is the design template. Two new `@rfjs/filter-builder` engines (`sql-filter`, `mongo`) are added first (the `jsonb` engine already exists). A shared scaffold (`apps/web/src/tools/_filter-builder/`) is extracted so all four tools share one state hook + UI primitives; `data-filter-builder` is refactored onto it. Each tool differs only in `engineId` and its "output" panel: data-filter shows live in-memory matched rows; the three query engines show the compiled query (`primary` WHERE/object + `secondary` values) via `getEngine(id).compile(...)`.

**Tech Stack:** TypeScript 5.7, React 19, Next.js 16, Tailwind v4, Vitest, next-intl. Packages: `@rfjs/filter-builder` (tsdown→dist), `@rfjs/filter-builder-ui`, `@rfjs/web-ui`, `@rfjs/web-core`, `@rfjs/jsonb-query`, `@rfjs/sql-filter`, `@rfjs/mongo-query`, `@rfjs/data-transform`.

## Global Constraints

- **All user-facing copy is bilingual**: every tool's `messages.ts` has `en` and `zh-TW`, each with a `Tools.<id>.{title,description}` block and a `ToolUI` block. zh-TW must be Traditional Chinese.
- **`@rfjs/filter-builder` is consumed by apps as built `dist/`, NOT transpiled src.** After ANY edit to `packages/filter-builder/src`, run `pnpm -F @rfjs/filter-builder build` before the app/tools see it. Vitest imports src, so package specs pass without a rebuild — do not mistake green specs for "the app works".
- **Tailwind only generates CSS for classes it can scan.** New tool UI lives under `apps/web/src` (already scanned) — no new `@source` needed. Do not invent classes that only exist in an unscanned package.
- **Co-locate tests**: `*.spec.ts(x)` next to source. Package specs glob `src/**/*.spec.ts`; app specs run via `vitest run`.
- **One branch, granular conventional commits, one PR** to `main`. Branch: `feat/per-engine-filter-builders`.
- **No new deep export subpaths**: `@rfjs/filter-builder` exports only its root `src/index.ts`. New engines are reached via `getEngine("sql-filter"|"mongo")`, never imported directly.
- **Engines never imported from UI directly** — always go through `getEngine`.

---

## File Structure

**`packages/filter-builder/`** (Phase 1 — engines):
- Create: `src/engines/sql-filter.ts` — `sqlFilterEngine: Engine` (wraps `@rfjs/sql-filter` `buildColumnQuery`)
- Create: `src/engines/sql-filter.spec.ts`
- Create: `src/engines/mongo.ts` — `mongoEngine: Engine` (wraps `@rfjs/mongo-query` `genFilterQuery`)
- Create: `src/engines/mongo.spec.ts`
- Modify: `src/engines/types.ts` — extend `EngineId`
- Modify: `src/engines/index.ts` — register both engines
- Modify: `src/engines/arity.ts` — add `nin: "list"`
- Modify: `package.json` — add `@rfjs/sql-filter`, `@rfjs/mongo-query`, `@rfjs/data-transform` deps

**`apps/web/src/tools/_filter-builder/`** (Phase 2 — shared scaffold, NOT a tool; leading underscore excludes it from the tool loader which imports explicit dirs):
- Create: `csv.ts` — `parseRows`, `safeInfer`, `coerceCell`, `parseCsv` (moved verbatim from `data-filter-builder/ui.tsx`)
- Create: `rise.ts` — `RISE` animation CSS string
- Create: `use-filter-builder.ts` — `useFilterBuilder()` hook (all sample/schema/tree/reverse state)
- Create: `metadata-strip.tsx` — moved from `data-filter-builder/ui/metadata-strip.tsx`
- Create: `metadata-strip.spec.tsx` — moved
- Create: `sample-card.tsx` — collapsible Sample JSON + Upload section
- Create: `canonical-editor.tsx` — reverse-parse JSON textarea + CopyButton
- Create: `index.ts` — barrel

**`apps/web/src/tools/data-filter-builder/`** (Phase 2 — refactor onto scaffold):
- Modify: `ui.tsx` — consume `useFilterBuilder` + shared `SampleCard`; delete the moved helpers
- Modify: `ui/data-panel.tsx` — use shared `CanonicalEditor` for the json tab
- Delete: `ui/metadata-strip.tsx`, `ui/metadata-strip.spec.tsx` (moved to scaffold)

**`apps/web/src/tools/<engine>-builder/`** (Phases 3–5, one per engine):
- Create: `index.ts`, `messages.ts`, `ui.tsx`
- Create: `ui/query-output-panel.tsx` (shared-shaped, per-tool labels) + spec
- Create: `ui.spec.tsx`

**Registry wiring** (each of Phases 3–5):
- Modify: `packages/web-core/src/registry/tools.ts` — add tool entry
- Modify: `apps/web/src/tools/index.ts` — import + push to `toolModules`
- Modify: `apps/web/src/tools/messages.ts` — import + push to `toolMessages`
- Modify: `packages/web-core/src/registry/registry.spec.ts` — keep assertions accurate

**Retirement** (Phase 6):
- Delete: `apps/web/src/tools/query-builder/` (whole dir)
- Modify: `tools.ts`, `tools/index.ts`, `tools/messages.ts`, `registry.spec.ts`

---

## Task 1: Add `nin` arity + `sql-filter` engine (package, TDD)

**Files:**
- Modify: `packages/filter-builder/src/engines/arity.ts`
- Modify: `packages/filter-builder/src/engines/types.ts:11`
- Create: `packages/filter-builder/src/engines/sql-filter.ts`
- Test: `packages/filter-builder/src/engines/sql-filter.spec.ts`
- Modify: `packages/filter-builder/src/engines/index.ts`
- Modify: `packages/filter-builder/package.json:37-41`

**Interfaces:**
- Consumes: `Engine`, `OperatorSpec`, `CompileContext` from `./types`; `FilterGroupLike`, `FilterConditionLike` from `../compile`; `arityOf` from `./arity`; `buildColumnQuery`, `ColumnConfig`, `ColumnCondition`, `ColumnType`, `FilterGroup` from `@rfjs/sql-filter`.
- Produces: `sqlFilterEngine: Engine` with `id: "sql-filter"`; `EngineId` now includes `"sql-filter"`.

- [ ] **Step 1: Add `@rfjs/sql-filter` to package deps**

In `packages/filter-builder/package.json`, change the `dependencies` block to:

```json
  "dependencies": {
    "@rfjs/pg-filter": "workspace:*",
    "@rfjs/jsonb-query": "workspace:*",
    "@rfjs/sql-filter": "workspace:*",
    "@rfjs/mongo-query": "workspace:*",
    "@rfjs/data-transform": "workspace:*",
    "@rfjs/data-filter": "workspace:*"
  },
```

Then run `pnpm install` from repo root to link the new workspace deps.
Run: `pnpm install`
Expected: lockfile updates, no errors.

- [ ] **Step 2: Add `nin: "list"` to the shared arity table**

In `packages/filter-builder/src/engines/arity.ts`, add `nin: "list",` to the `ARITY` record (after `containsall: "list",`). No other engine offers `nin`, so this is safe.

- [ ] **Step 3: Extend `EngineId`**

In `packages/filter-builder/src/engines/types.ts` line 11, change:

```ts
export type EngineId = "jsonb" | "data-filter" | "pg-filter";
```
to:
```ts
export type EngineId = "jsonb" | "data-filter" | "pg-filter" | "sql-filter" | "mongo";
```

- [ ] **Step 4: Write the failing sql-filter engine spec**

Create `packages/filter-builder/src/engines/sql-filter.spec.ts`:

```ts
import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "../compile";
import type { BuilderGroup } from "../types";
import { sqlFilterEngine } from "./sql-filter";

describe("sqlFilterEngine.operators", () => {
  it("offers text ops (incl. contains/startswith) for string columns", () => {
    const ops = sqlFilterEngine.operators("string").map((o) => o.op);
    expect(ops).toEqual(
      expect.arrayContaining(["eq", "neq", "contains", "startswith", "gt", "lt", "isnull"]),
    );
    expect(ops).not.toContain("terms"); // sql-filter column layer has no IN list
  });

  it("offers comparison ops for numeric/date columns", () => {
    expect(sqlFilterEngine.operators("numeric").map((o) => o.op)).toEqual(
      expect.arrayContaining(["eq", "neq", "gt", "gte", "lt", "lte"]),
    );
    expect(sqlFilterEngine.operators("numeric").map((o) => o.op)).not.toContain("contains");
  });

  it("offers only equality + null for boolean", () => {
    expect(sqlFilterEngine.operators("boolean").map((o) => o.op)).toEqual([
      "eq", "neq", "isnull", "isnotnull",
    ]);
  });
});

describe("sqlFilterEngine.compile", () => {
  const ctx = {
    fields: [
      { path: "name", kind: "column" as const, dataType: "string" as const },
      { path: "age", kind: "column" as const, dataType: "numeric" as const },
    ],
  };

  it("compiles a flat AND group to parameterized SQL", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [
        { kind: "condition", id: "c1", field: "name", dataType: "string", operator: "contains", value: "sa" },
        { kind: "condition", id: "c2", field: "age", dataType: "numeric", operator: "gte", value: 18 },
      ],
    };
    const out = sqlFilterEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.primary).toContain("$1");
    expect(out.primary.toLowerCase()).toContain("and");
    expect(JSON.parse(out.secondary ?? "[]")).toEqual(["sa", 18]);
  });

  it("returns ok:false with a message on an unknown column", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "ghost", dataType: "string", operator: "eq", value: "x" }],
    };
    const out = sqlFilterEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out.ok).toBe(false);
  });
});
```

- [ ] **Step 5: Run the spec to verify it fails**

Run: `pnpm -F @rfjs/filter-builder vitest:run src/engines/sql-filter.spec.ts`
Expected: FAIL — cannot find module `./sql-filter`.

- [ ] **Step 6: Implement the sql-filter engine**

Create `packages/filter-builder/src/engines/sql-filter.ts`:

```ts
import {
  buildColumnQuery,
  type ColumnCondition,
  type ColumnConfig,
  type ColumnOperator,
  type ColumnType,
  type FilterGroup,
} from "@rfjs/sql-filter";

import type { FilterConditionLike, FilterGroupLike } from "../compile";
import { arityOf } from "./arity";
import type { CompileContext, Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
// sql-filter's column layer (ColumnOperator) is the authority on what's renderable.
const TEXT_OPS = ["eq", "neq", "contains", "startswith", "gt", "gte", "lt", "lte", ...NULL_OPS];
const NUMERIC_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", ...NULL_OPS]; // numeric + date
const BOOL_OPS = ["eq", "neq", ...NULL_OPS];

function columnOps(dataType: string): string[] {
  if (dataType === "string") return TEXT_OPS;
  if (dataType === "boolean") return BOOL_OPS;
  if (dataType === "numeric" || dataType === "date") return NUMERIC_OPS;
  return NULL_OPS; // object/array columns: only null checks are meaningful here
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({ op, arity: arityOf(op) }));
}

function toColumnType(dataType: string): ColumnType {
  if (dataType === "numeric") return "numeric";
  if (dataType === "date") return "timestamp";
  if (dataType === "boolean") return "boolean";
  return "text";
}

function toColumnGroup(group: FilterGroupLike): FilterGroup<ColumnCondition> {
  return {
    logic: group.logic as FilterGroup<ColumnCondition>["logic"],
    filters: group.filters.map((node) =>
      "logic" in node
        ? toColumnGroup(node as FilterGroupLike)
        : toColumnLeaf(node as FilterConditionLike),
    ),
  };
}

function toColumnLeaf(leaf: FilterConditionLike): ColumnCondition {
  return { column: leaf.field, operator: leaf.operator as ColumnOperator, value: leaf.value };
}

export const sqlFilterEngine: Engine = {
  id: "sql-filter",
  label: "sql-filter (columns)",
  operators(dataType) {
    return toSpecs(columnOps(dataType));
  },
  compile(group: FilterGroupLike, ctx: CompileContext) {
    try {
      const columns = ctx.fields.reduce<ColumnConfig>((acc, f) => {
        acc[f.path] = { column: f.path, type: toColumnType(f.dataType) };
        return acc;
      }, {});
      const { where, values } = buildColumnQuery(columns, toColumnGroup(group));
      return { ok: true, primary: where, secondary: JSON.stringify(values, null, 2) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "queryFailed" };
    }
  },
};
```

> NOTE: confirm the exact type names exported by `@rfjs/sql-filter` (`ColumnConfig`, `ColumnCondition`, `ColumnOperator`, `ColumnType`, `FilterGroup`, `buildColumnQuery`) against its `src/index.ts`. They were verified present during planning; if a name differs, fix the import — do not invent.

- [ ] **Step 7: Register the engine**

In `packages/filter-builder/src/engines/index.ts`:
- add `import { sqlFilterEngine } from "./sql-filter";`
- add `"sql-filter": sqlFilterEngine,` to the `ENGINES` map
- add `"sql-filter"` to the `ENGINE_IDS` array

- [ ] **Step 8: Run the spec to verify it passes**

Run: `pnpm -F @rfjs/filter-builder vitest:run src/engines/sql-filter.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 9: Commit**

```bash
git add packages/filter-builder
git commit -m "feat(filter-builder): add sql-filter engine + nin arity"
```

---

## Task 2: Add `mongo` engine (package, TDD)

**Files:**
- Create: `packages/filter-builder/src/engines/mongo.ts`
- Test: `packages/filter-builder/src/engines/mongo.spec.ts`
- Modify: `packages/filter-builder/src/engines/index.ts`

**Interfaces:**
- Consumes: `genFilterQuery`, `MgoFilterMetadata`, `MgoFieldCondition`, `MgoConditionType` from `@rfjs/mongo-query`; `MgoDataType` from `@rfjs/data-transform`; `FilterConditionLike`, `FilterGroupLike` from `../compile`; `arityOf` from `./arity`.
- Produces: `mongoEngine: Engine` with `id: "mongo"`.

**Mapping contract (the heart of this engine):**
- Logic: `and→and`, `or→or`, `nor→nor`. `not` is unsupported by `@rfjs/mongo-query` → `compile` returns `{ ok: false, error: "mongoNoNot" }`.
- dataType→MgoDataType: `string→string`, `numeric→number`, `date→date`, `boolean→boolean`, `object|array→any`.
- operator→`MgoConditionType` (+ value transform):
  - `eq→eq`, `neq→neq`, `gt→gt`, `gte→gte`, `lt→lt`, `lte→lte`, `range→range`, `terms→terms`, `nin→nin`
  - `contains→regex` value `new RegExp(escape(v))`; `startswith→regex` `^…`; `endswith→regex` `…$`
  - `isnull→eq` value `null`; `isnotnull→neq` value `null`
  - any other op → throw (caught → `{ ok:false, error }`)
- Output `primary` is the Mongo query object stringified with a replacer that renders `RegExp` via `.toString()` and `Date` via `.toISOString()` (plain `JSON.stringify` turns a RegExp into `{}`).

- [ ] **Step 1: Write the failing mongo engine spec**

Create `packages/filter-builder/src/engines/mongo.spec.ts`:

```ts
import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "../compile";
import type { BuilderGroup } from "../types";
import { mongoEngine } from "./mongo";

const ctx = { fields: [] };

describe("mongoEngine.operators", () => {
  it("offers regex-style + membership ops for string", () => {
    const ops = mongoEngine.operators("string").map((o) => o.op);
    expect(ops).toEqual(expect.arrayContaining(["eq", "neq", "contains", "startswith", "terms", "nin"]));
  });

  it("offers comparison ops for numeric", () => {
    expect(mongoEngine.operators("numeric").map((o) => o.op)).toEqual(
      expect.arrayContaining(["gt", "gte", "lt", "lte", "range", "terms"]),
    );
  });

  it("marks nin (and terms) as list arity", () => {
    expect(mongoEngine.operators("string").find((o) => o.op === "nin")?.arity).toBe("list");
    expect(mongoEngine.operators("numeric").find((o) => o.op === "terms")?.arity).toBe("list");
  });
});

describe("mongoEngine.compile", () => {
  it("compiles nested and/or into $and/$or with field conditions", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [
        { kind: "condition", id: "c1", field: "name", dataType: "string", operator: "eq", value: "test" },
        {
          kind: "group", id: "g2", logic: "or",
          children: [
            { kind: "condition", id: "c2", field: "age", dataType: "numeric", operator: "gt", value: 18 },
          ],
        },
      ],
    };
    const out = mongoEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const q = JSON.parse(out.primary);
    expect(q).toEqual({
      $and: [{ name: { $eq: "test" } }, { $or: [{ age: { $gt: 18 } }] }],
    });
  });

  it("maps contains to a $regex (rendered as a regex literal string)", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "name", dataType: "string", operator: "contains", value: "ab" }],
    };
    const out = mongoEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.primary).toContain("/ab/");
  });

  it("maps isnull to $eq null", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "addr", dataType: "string", operator: "isnull" }],
    };
    const out = mongoEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(JSON.parse(out.primary)).toEqual({ $and: [{ addr: { $eq: null } }] });
  });

  it("rejects NOT groups (MongoDB has no top-level NOT here)", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "not",
      children: [{ kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 1 }],
    };
    const out = mongoEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out).toEqual({ ok: false, error: "mongoNoNot" });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `pnpm -F @rfjs/filter-builder vitest:run src/engines/mongo.spec.ts`
Expected: FAIL — cannot find module `./mongo`.

- [ ] **Step 3: Implement the mongo engine**

Create `packages/filter-builder/src/engines/mongo.ts`:

```ts
import { genFilterQuery, type MgoConditionType, type MgoFieldCondition, type MgoFilterMetadata } from "@rfjs/mongo-query";
import type { MgoDataType } from "@rfjs/data-transform";

import type { FilterConditionLike, FilterGroupLike } from "../compile";
import { arityOf } from "./arity";
import type { CompileContext, Engine, OperatorSpec, ValueType } from "./types";

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

function toMgoDataType(dataType: string): MgoDataType {
  if (dataType === "numeric") return "number";
  if (dataType === "date") return "date";
  if (dataType === "boolean") return "boolean";
  if (dataType === "string") return "string";
  return "any"; // object / array
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Maps one canonical leaf to a mongo-query field condition, transforming the
// value where MongoDB has no direct operator (substring -> $regex, null checks
// -> equality against null).
function toMgoCondition(leaf: FilterConditionLike): MgoFieldCondition {
  const base = { field: leaf.field, dataType: toMgoDataType(leaf.dataType) };
  const v = leaf.value as ValueType;
  switch (leaf.operator) {
    case "eq": case "neq": case "gt": case "gte": case "lt": case "lte":
    case "range": case "terms": case "nin":
      return { ...base, condition: leaf.operator as MgoConditionType, value: v };
    case "contains":
      return { ...base, condition: "regex", value: new RegExp(escapeRegex(String(v))) };
    case "startswith":
      return { ...base, condition: "regex", value: new RegExp("^" + escapeRegex(String(v))) };
    case "endswith":
      return { ...base, condition: "regex", value: new RegExp(escapeRegex(String(v)) + "$") };
    case "isnull":
      return { ...base, condition: "eq", value: null };
    case "isnotnull":
      return { ...base, condition: "neq", value: null };
    default:
      throw new Error("mongoUnsupportedOp:" + leaf.operator);
  }
}

function toMgoGroup(group: FilterGroupLike): MgoFilterMetadata {
  if (group.logic === "not") throw new Error("mongoNoNot");
  return {
    logic: group.logic as MgoFilterMetadata["logic"],
    filters: group.filters.map((node) =>
      "logic" in node
        ? toMgoGroup(node as FilterGroupLike)
        : toMgoCondition(node as FilterConditionLike),
    ),
  };
}

// MongoDB values can be RegExp/Date which JSON.stringify would flatten; render
// them as literals so the displayed query is faithful.
function stringifyMongo(query: unknown): string {
  return JSON.stringify(
    query,
    (_k, v) => {
      if (v instanceof RegExp) return v.toString();
      if (v instanceof Date) return v.toISOString();
      return v;
    },
    2,
  );
}

export const mongoEngine: Engine = {
  id: "mongo",
  label: "mongo-query (MongoDB)",
  operators(dataType, elementType) {
    if (dataType === "object") return toSpecs(OBJECT_OPS);
    if (dataType === "array") return toSpecs(ARRAY_OPS);
    return toSpecs(scalarOps(dataType));
  },
  compile(group: FilterGroupLike, _ctx: CompileContext) {
    try {
      const query = genFilterQuery(toMgoGroup(group));
      return { ok: true, primary: stringifyMongo(query) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "queryFailed";
      return { ok: false, error: msg === "mongoNoNot" ? "mongoNoNot" : msg };
    }
  },
};
```

> If `@rfjs/mongo-query` does not export a `ValueType` you can import, replace the `ValueType` import with `unknown` for `v` and cast at the call site. The `MgoDataType` lives in `@rfjs/data-transform`; the planning step confirmed mongo-query depends on it. Verify exact exported names against `packages/mongo-query/src/index.ts` and `packages/data-transform/src/index.ts`; fix imports if a name differs.

> `ValueType` is NOT currently exported from `filter-builder/src/engines/types.ts`. Either import `ValueType` from `@rfjs/mongo-query` (it exports one) instead of from `./types`, or use `unknown`. Pick whichever typechecks; do not add a new export to `types.ts` unless needed.

- [ ] **Step 4: Register the engine**

In `packages/filter-builder/src/engines/index.ts`:
- add `import { mongoEngine } from "./mongo";`
- add `mongo: mongoEngine,` to the `ENGINES` map
- add `"mongo"` to the `ENGINE_IDS` array

- [ ] **Step 5: Run the spec to verify it passes**

Run: `pnpm -F @rfjs/filter-builder vitest:run src/engines/mongo.spec.ts`
Expected: PASS.

- [ ] **Step 6: Full package check + rebuild dist**

```bash
pnpm -F @rfjs/filter-builder typecheck
pnpm -F @rfjs/filter-builder vitest:run
pnpm -F @rfjs/filter-builder lint
pnpm -F @rfjs/filter-builder build
```
Expected: all green; `dist/` rebuilt (so apps pick up the new engines).

- [ ] **Step 7: Commit**

```bash
git add packages/filter-builder
git commit -m "feat(filter-builder): add mongo engine (genFilterQuery adapter)"
```

---

## Task 3: Extract shared filter-builder scaffold + refactor data-filter-builder

**Files:**
- Create: `apps/web/src/tools/_filter-builder/csv.ts`
- Create: `apps/web/src/tools/_filter-builder/rise.ts`
- Create: `apps/web/src/tools/_filter-builder/use-filter-builder.ts`
- Create: `apps/web/src/tools/_filter-builder/metadata-strip.tsx` (+ `.spec.tsx`)
- Create: `apps/web/src/tools/_filter-builder/sample-card.tsx`
- Create: `apps/web/src/tools/_filter-builder/canonical-editor.tsx`
- Create: `apps/web/src/tools/_filter-builder/index.ts`
- Modify: `apps/web/src/tools/data-filter-builder/ui.tsx`
- Modify: `apps/web/src/tools/data-filter-builder/ui/data-panel.tsx`
- Delete: `apps/web/src/tools/data-filter-builder/ui/metadata-strip.tsx` (+ `.spec.tsx`)

**Interfaces:**
- Produces (consumed by Tasks 4–6):
  - `useFilterBuilder(opts: { sample: string }): FilterBuilderState`
  - `interface FilterBuilderState { sampleText, sampleOpen, setSampleOpen, schema, setSchema, error, tree, setTree, rows, canonicalJson, reverseError, onSample, onUpload, onCanonicalChange, onCreateField }` (types below)
  - `SampleCard`, `MetadataStrip`, `CanonicalEditor` components + their label interfaces
  - `RISE: string`
  - `toCompileContext(schema: FieldSchema[]): CompileContext` helper (used by query tools)

- [ ] **Step 1: Create `rise.ts`**

```ts
export const RISE = `
@keyframes fb-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.fb-rise { animation: fb-rise .45s cubic-bezier(.2,.7,.2,1) both; }
@media (prefers-reduced-motion: reduce) { .fb-rise { animation: none; } }
`;
```
(Rename the class from `dfb-rise` to `fb-rise` since it's now shared; update all `dfb-rise` usages in data-filter-builder to `fb-rise` in Step 8.)

- [ ] **Step 2: Create `csv.ts`** — move `parseRows`, `safeInfer`, `coerceCell`, `parseCsv` verbatim from `data-filter-builder/ui.tsx` (lines 254–318). Add `import { inferSchema } from "@rfjs/filter-builder"; import type { FieldSchema } from "@rfjs/filter-builder";` and `export` each function.

- [ ] **Step 3: Move `metadata-strip.tsx` + spec** — copy `data-filter-builder/ui/metadata-strip.tsx` and its spec into `_filter-builder/` unchanged (imports are package-absolute, so they still resolve). Will delete the originals in Step 9.

- [ ] **Step 4: Create `canonical-editor.tsx`** — extract the json-tab body from `data-panel.tsx` (lines 142–161):

```tsx
"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Textarea } from "@rfjs/web-ui/components/textarea";

export interface CanonicalEditorLabels {
  canonicalHint: string;
  copy: string;
}

export function CanonicalEditor({
  value,
  onChange,
  error,
  labels,
}: {
  value: string;
  onChange: (text: string) => void;
  error: string | null;
  labels: CanonicalEditorLabels;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Textarea
          aria-label={labels.canonicalHint}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          rows={12}
          className="resize-y pr-24 font-mono"
        />
        <CopyButton text={value} label={labels.copy} className="absolute top-2 right-2" />
      </div>
      {error ? <p className="font-mono text-sm text-fault">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Create `sample-card.tsx`** — extract the Sample-JSON `<section>` from `data-filter-builder/ui.tsx` (lines 132–183). Props:

```tsx
"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Textarea } from "@rfjs/web-ui/components/textarea";
import { ChevronDown, ChevronRight, Upload } from "lucide-react";

export interface SampleCardLabels {
  sample: string;
  invalidSample: string;
  rawCount: string; // already-formatted "raw (N)" string
  upload: string;
}

export function SampleCard({
  open,
  onToggle,
  value,
  onChange,
  onUpload,
  hasError,
  labels,
  style,
}: {
  open: boolean;
  onToggle: () => void;
  value: string;
  onChange: (text: string) => void;
  onUpload: (file: File | undefined) => void;
  hasError: boolean;
  labels: SampleCardLabels;
  style?: React.CSSProperties;
}) {
  return (
    <section className="fb-rise rounded-lg border bg-card" style={style}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {labels.sample}
          </span>
        </span>
        {hasError ? (
          <span className="font-mono text-xs text-fault">{labels.invalidSample}</span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{labels.rawCount}</span>
        )}
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t p-4">
          <div className="relative">
            <Textarea
              aria-label={labels.sample}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              rows={6}
              className="resize-y pr-24 font-mono"
            />
            <Button asChild variant="outline" size="sm" className="absolute top-2 right-2">
              <label className="cursor-pointer">
                <Upload className="size-3.5" />
                {labels.upload}
                <input
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    onUpload(e.target.files?.[0]);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </Button>
          </div>
          {hasError ? <p className="font-mono text-sm text-fault">{labels.invalidSample}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 6: Create `use-filter-builder.ts`** — the shared brain (extracted from `data-filter-builder/ui.tsx` state, lines 60–125):

```ts
"use client";

import {
  addInferredField,
  emptyGroup,
  filterGroupToTree,
  mergeFieldsFromTree,
  parseFilterGroup,
  treeToFilterGroup,
  type BuilderGroup,
  type CompileContext,
  type FieldSchema,
  type ReverseError,
} from "@rfjs/filter-builder";
import { useEffect, useMemo, useRef, useState } from "react";

import { parseCsv, parseRows, safeInfer } from "./csv";

const id = () => crypto.randomUUID();

export interface FilterBuilderState {
  sampleText: string;
  sampleOpen: boolean;
  setSampleOpen: React.Dispatch<React.SetStateAction<boolean>>;
  schema: FieldSchema[];
  setSchema: React.Dispatch<React.SetStateAction<FieldSchema[]>>;
  error: string | null;
  tree: BuilderGroup;
  setTree: (g: BuilderGroup) => void;
  rows: unknown[];
  canonicalJson: string;
  reverseError: ReverseError | null;
  onSample: (text: string) => void;
  onUpload: (file: File | undefined) => Promise<void>;
  onCanonicalChange: (text: string) => void;
  onCreateField: (path: string) => void;
}

export function useFilterBuilder({ sample }: { sample: string }): FilterBuilderState {
  const [sampleText, setSampleText] = useState(sample);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [schema, setSchema] = useState<FieldSchema[]>(() => safeInfer(sample).schema);
  const [error, setError] = useState<string | null>(() => safeInfer(sample).error);
  const [tree, setTree] = useState<BuilderGroup>(() => emptyGroup(id));
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<ReverseError | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const rows = useMemo(() => parseRows(sampleText), [sampleText]);
  const canonical = useMemo(() => JSON.stringify(treeToFilterGroup(tree), null, 2), [tree]);

  function onCanonicalChange(text: string) {
    setJsonDraft(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (text.trim() === "") { setReverseError(null); return; }
      const r = parseFilterGroup(text);
      if (r.ok) {
        setTree(filterGroupToTree(r.group, id));
        setSchema((s) => mergeFieldsFromTree(s, r.group));
        setReverseError(null);
        setJsonDraft(null);
      } else {
        setReverseError(r.error);
      }
    }, 300);
  }

  function onSample(text: string) {
    setSampleText(text);
    const { schema: next, error: err } = safeInfer(text);
    setError(err);
    if (!err) setSchema(next);
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const json = file.name.toLowerCase().endsWith(".csv")
      ? JSON.stringify(parseCsv(text), null, 2)
      : text;
    onSample(json);
  }

  function onCreateField(path: string) {
    setSchema((s) => addInferredField(s, path));
  }

  return {
    sampleText, sampleOpen, setSampleOpen, schema, setSchema, error, tree, setTree,
    rows, canonicalJson: jsonDraft ?? canonical, reverseError,
    onSample, onUpload, onCanonicalChange, onCreateField,
  };
}

// Build a compile context from the schema (every field becomes a compile field,
// so engine compilers can resolve any referenced path).
export function toCompileContext(schema: FieldSchema[]): CompileContext {
  return {
    fields: schema.map((f) => ({
      path: f.path, kind: f.kind, dataType: f.dataType, elementType: f.elementType,
    })),
  };
}
```

- [ ] **Step 7: Create `index.ts` barrel**

```ts
export { RISE } from "./rise";
export { useFilterBuilder, toCompileContext, type FilterBuilderState } from "./use-filter-builder";
export { MetadataStrip, type MetadataStripLabels } from "./metadata-strip";
export { SampleCard, type SampleCardLabels } from "./sample-card";
export { CanonicalEditor, type CanonicalEditorLabels } from "./canonical-editor";
export { parseCsv, parseRows, safeInfer, coerceCell } from "./csv";
```

- [ ] **Step 8: Refactor `data-filter-builder/ui.tsx`** to consume the scaffold. The new file:
  - imports `useFilterBuilder`, `SampleCard`, `MetadataStrip`, `RISE` from `@/tools/_filter-builder`
  - imports `runLiveMatch`, `treeToFilterGroup` from `@rfjs/filter-builder` (live match stays here — it's data-filter's unique output)
  - replaces all local state with `const fb = useFilterBuilder({ sample: SAMPLE });`
  - `const live = useMemo(() => runLiveMatch(fb.rows, fb.tree), [fb.rows, fb.tree]);`
  - renders `<SampleCard ... />` instead of the inline section
  - `<FilterTreeEditor group={fb.tree} engineId="data-filter" schema={fb.schema} onChange={fb.setTree} onCreateField={fb.onCreateField} labels={treeLabels} />`
  - `<DataPanel rows={fb.rows} matched={live.matched} canonicalJson={fb.canonicalJson} onCanonicalChange={fb.onCanonicalChange} error={reverseText} labels={...} />`
  - changes `dfb-rise` → `fb-rise` everywhere
  - deletes the local `parseRows/safeInfer/coerceCell/parseCsv` (now in csv.ts) and the local `RISE` const

  The `reverseText` mapping and `treeLabels` stay (they use `t(...)`). The `SampleCard` labels: `{ sample: t("dfbSample"), invalidSample: t("dfbInvalidSample"), rawCount: t("dfbRaw", { count: fb.rows.length }), upload: t("dfbUpload") }`.

- [ ] **Step 9: Refactor `data-panel.tsx`** — replace the json-tab inline body (lines 142–161) with `<CanonicalEditor value={canonicalJson} onChange={onCanonicalChange} error={error} labels={{ canonicalHint: labels.canonicalHint, copy: labels.copy }} />`. Remove now-unused `CopyButton`/`Textarea` imports if no longer referenced.

- [ ] **Step 10: Delete moved files**

```bash
git rm apps/web/src/tools/data-filter-builder/ui/metadata-strip.tsx apps/web/src/tools/data-filter-builder/ui/metadata-strip.spec.tsx
```

- [ ] **Step 11: Run data-filter-builder + scaffold specs (no regression)**

Run: `pnpm -F web vitest:run src/tools/data-filter-builder src/tools/_filter-builder`
Expected: PASS — the moved metadata-strip spec runs from its new location; data-filter-builder ui/data-panel specs still pass unchanged.

- [ ] **Step 12: Typecheck + lint the app**

Run: `pnpm -F web check-types && pnpm -F web lint` (use whatever the package's actual script names are; check `apps/web/package.json`).
Expected: green.

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/tools
git commit -m "refactor(web): extract shared filter-builder scaffold from data-filter-builder"
```

---

## Task 4: Build the `jsonb-query-builder` tool

**Files:**
- Create: `apps/web/src/tools/jsonb-query-builder/index.ts`
- Create: `apps/web/src/tools/jsonb-query-builder/messages.ts`
- Create: `apps/web/src/tools/jsonb-query-builder/ui.tsx`
- Create: `apps/web/src/tools/jsonb-query-builder/ui/query-output-panel.tsx` (+ `.spec.tsx`)
- Create: `apps/web/src/tools/jsonb-query-builder/ui.spec.tsx`
- Modify: `packages/web-core/src/registry/tools.ts`
- Modify: `apps/web/src/tools/index.ts`
- Modify: `apps/web/src/tools/messages.ts`
- Modify: `packages/web-core/src/registry/registry.spec.ts` (if any web-id assertion needs it)

**Interfaces:**
- Consumes: `useFilterBuilder`, `toCompileContext`, `SampleCard`, `MetadataStrip`, `CanonicalEditor`, `RISE` from `@/tools/_filter-builder`; `getEngine`, `treeToFilterGroup` from `@rfjs/filter-builder`; `FilterTreeEditor` from `@rfjs/filter-builder-ui`.
- Produces: `tool: ToolModule` (`id: "jsonb-query-builder"`); a reusable `QueryOutputPanel` shape (each engine tool gets its own copy under its `ui/` — small enough not to over-share; OR promote to `_filter-builder/` if all three end up identical — decide at Task 5).

- [ ] **Step 1: Register the tool in the web-core registry**

In `packages/web-core/src/registry/tools.ts`, add (near `data-filter-builder`):

```ts
  {
    id: 'jsonb-query-builder',
    category: 'query',
    surface: 'web',
    status: 'preview',
    relatedPackages: ['@rfjs/jsonb-query', '@rfjs/filter-builder'],
    tags: ['builder', 'playground'],
  },
```

- [ ] **Step 2: Update registry spec if needed**

Run: `pnpm -F @rfjs/web-core vitest:run`
The workbench-surface assertion (`expect(ids).toEqual(['object-transformer'])`) is unaffected (new tool is web-surface). `ids are unique` + `every entry matches the tool schema` pass automatically. If any test enumerates web ids explicitly, update it. Expected after check: green.

- [ ] **Step 3: Write `messages.ts`** (en + zh-TW). Title "JSONB Query Builder" / "JSONB 查詢建構器". Reuse the `dfb*`-style keys but prefix `jqb*`, plus query-output keys:

```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "jsonb-query-builder": {
        title: "JSONB Query Builder",
        description: "Visually build a PostgreSQL JSONB WHERE clause over sample JSON and see the compiled SQL live.",
      },
    },
    ToolUI: {
      jqbFilterLogic: "Filter logic",
      jqbFields: "Fields",
      jqbSample: "Sample JSON",
      jqbInvalidSample: "Invalid JSON — open to fix",
      jqbRaw: "raw ({count})",
      jqbUpload: "Upload",
      jqbInclude: "include {field}",
      jqbType: "type {field}",
      jqbOutput: "Compiled query",
      jqbWhere: "WHERE",
      jqbValues: "values",
      jqbCanonical: "'{ }'",
      jqbCanonicalHint: "Canonical filter (editable) — edit to rebuild the tree",
      jqbReverseInvalidJson: "Invalid JSON",
      jqbReverseInvalidShape: "Not a valid filter group",
      jqbCompileError: "Could not compile: {error}",
      jqbCopy: "Copy",
      jqbValueHint: "type, Enter to add",
      jqbLogicAnd: "ALL · all match",
      jqbLogicOr: "ANY · any match",
      jqbLogicNor: "NONE · none match",
      jqbLogicNot: "NOT · not all",
      jqbAddCondition: "+ condition",
      jqbAddGroup: "+ group",
      jqbRemoveGroup: "remove group",
      jqbRemoveCondition: "remove condition",
      jqbElemMatch: "elemmatch (nested match)",
    },
  },
  "zh-TW": {
    Tools: {
      "jsonb-query-builder": {
        title: "JSONB 查詢建構器",
        description: "在範例 JSON 上視覺化建構 PostgreSQL JSONB WHERE 條件，並即時查看編譯後的 SQL。",
      },
    },
    ToolUI: {
      jqbFilterLogic: "篩選邏輯",
      jqbFields: "欄位",
      jqbSample: "範例 JSON",
      jqbInvalidSample: "JSON 無效 —— 展開修正",
      jqbRaw: "原始（{count}）",
      jqbUpload: "上傳",
      jqbInclude: "納入 {field}",
      jqbType: "型別 {field}",
      jqbOutput: "編譯後查詢",
      jqbWhere: "WHERE",
      jqbValues: "參數值",
      jqbCanonical: "'{ }'",
      jqbCanonicalHint: "Canonical 篩選（可編輯）—— 編輯即反推條件樹",
      jqbReverseInvalidJson: "無效的 JSON",
      jqbReverseInvalidShape: "不是合法的 filter group",
      jqbCompileError: "無法編譯：{error}",
      jqbCopy: "複製",
      jqbValueHint: "輸入後按 Enter 加入",
      jqbLogicAnd: "全部成立 · ALL",
      jqbLogicOr: "擇一成立 · ANY",
      jqbLogicNor: "皆不成立 · NONE",
      jqbLogicNot: "非全部 · NOT",
      jqbAddCondition: "+ 條件",
      jqbAddGroup: "+ 群組",
      jqbRemoveGroup: "移除群組",
      jqbRemoveCondition: "移除條件",
      jqbElemMatch: "elemmatch（巢狀比對）",
    },
  },
};
```

- [ ] **Step 4: Write `ui/query-output-panel.tsx`** — the collapsible compiled-query panel (analogue of DataPanel for query engines). Tabs: output (primary `where` + secondary `values`), raw rows, canonical JSON.

```tsx
"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { CanonicalEditor } from "@/tools/_filter-builder";

export interface QueryOutputLabels {
  output: string;
  primaryLabel: string; // "WHERE" | "filter" — what `primary` is
  secondaryLabel: string; // "values" | "" — what `secondary` is (empty hides it)
  canonical: string;
  canonicalHint: string;
  reverseError: string | null;
  compileError: string | null; // already-formatted
  copy: string;
}

export function QueryOutputPanel({
  primary,
  secondary,
  canonicalJson,
  onCanonicalChange,
  labels,
}: {
  primary: string | null;
  secondary: string | null;
  canonicalJson: string;
  onCanonicalChange: (text: string) => void;
  labels: QueryOutputLabels;
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"output" | "canonical">("output");

  return (
    <section className="rounded-lg border bg-card text-card-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {labels.output}
          </span>
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-3 border-t p-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="xs" variant={tab === "output" ? "default" : "outline"} onClick={() => setTab("output")}>
              {labels.output}
            </Button>
            <Button type="button" size="xs" variant={tab === "canonical" ? "default" : "outline"} onClick={() => setTab("canonical")}>
              {labels.canonical}
            </Button>
          </div>

          {tab === "output" ? (
            labels.compileError ? (
              <p className="font-mono text-sm text-fault">{labels.compileError}</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {labels.primaryLabel}
                  </span>
                  <div className="relative">
                    <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 pr-12 font-mono text-xs text-foreground">
                      {primary || "—"}
                    </pre>
                    <CopyButton text={primary ?? ""} label={labels.copy} className="absolute top-2 right-2" />
                  </div>
                </div>
                {labels.secondaryLabel && secondary ? (
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {labels.secondaryLabel}
                    </span>
                    <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs text-foreground">
                      {secondary}
                    </pre>
                  </div>
                ) : null}
              </div>
            )
          ) : null}

          {tab === "canonical" ? (
            <CanonicalEditor
              value={canonicalJson}
              onChange={onCanonicalChange}
              error={labels.reverseError}
              labels={{ canonicalHint: labels.canonicalHint, copy: labels.copy }}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: Write `ui.tsx`** — the assembly. Mirrors data-filter-builder but: `engineId="jsonb"`, and the hero stat + data panel are replaced by the compiled query. Compute `compiled = getEngine("jsonb").compile(treeToFilterGroup(fb.tree), toCompileContext(fb.schema))`.

```tsx
"use client";

import { getEngine, treeToFilterGroup } from "@rfjs/filter-builder";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  MetadataStrip,
  RISE,
  SampleCard,
  toCompileContext,
  useFilterBuilder,
} from "@/tools/_filter-builder";

import { QueryOutputPanel } from "./ui/query-output-panel";

const SAMPLE = JSON.stringify(
  [
    { name: "Ada", age: 36, active: true, tags: ["ml", "math"] },
    { name: "Bo", age: 12, active: false, tags: ["games"] },
  ],
  null,
  2,
);

export function JsonbQueryBuilder() {
  const t = useTranslations("ToolUI");
  const fb = useFilterBuilder({ sample: SAMPLE });

  const treeLabels: FilterTreeLabels = {
    logic: { and: t("jqbLogicAnd"), or: t("jqbLogicOr"), nor: t("jqbLogicNor"), not: t("jqbLogicNot") },
    addCondition: t("jqbAddCondition"),
    addGroup: t("jqbAddGroup"),
    removeGroup: t("jqbRemoveGroup"),
    removeCondition: t("jqbRemoveCondition"),
    elemMatch: t("jqbElemMatch"),
    valueHint: t("jqbValueHint"),
  };

  const compiled = useMemo(
    () => getEngine("jsonb").compile(treeToFilterGroup(fb.tree), toCompileContext(fb.schema)),
    [fb.tree, fb.schema],
  );

  const reverseText =
    fb.reverseError === "invalidJson" ? t("jqbReverseInvalidJson")
    : fb.reverseError === "invalidShape" ? t("jqbReverseInvalidShape")
    : null;

  return (
    <div className="flex flex-col gap-5">
      <style>{RISE}</style>

      <SampleCard
        open={fb.sampleOpen}
        onToggle={() => fb.setSampleOpen((v) => !v)}
        value={fb.sampleText}
        onChange={fb.onSample}
        onUpload={(file) => void fb.onUpload(file)}
        hasError={Boolean(fb.error)}
        labels={{
          sample: t("jqbSample"),
          invalidSample: t("jqbInvalidSample"),
          rawCount: t("jqbRaw", { count: fb.rows.length }),
          upload: t("jqbUpload"),
        }}
        style={{ animationDelay: "0ms" }}
      />

      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "70ms" }}>
        <div className="border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{t("jqbFields")}</span>
        </div>
        <div className="p-4">
          <MetadataStrip
            schema={fb.schema}
            onChange={fb.setSchema}
            labels={{ include: t("jqbInclude", { field: "" }).trim(), type: t("jqbType", { field: "" }).trim() }}
          />
        </div>
      </section>

      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "140ms" }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{t("jqbFilterLogic")}</span>
        </div>
        <div className="overflow-x-auto p-5 sm:p-6">
          <FilterTreeEditor
            group={fb.tree}
            engineId="jsonb"
            schema={fb.schema}
            onChange={fb.setTree}
            onCreateField={fb.onCreateField}
            labels={treeLabels}
          />
        </div>
      </section>

      <div className="fb-rise" style={{ animationDelay: "210ms" }}>
        <QueryOutputPanel
          primary={compiled.ok ? compiled.primary : null}
          secondary={compiled.ok ? (compiled.secondary ?? null) : null}
          canonicalJson={fb.canonicalJson}
          onCanonicalChange={fb.onCanonicalChange}
          labels={{
            output: t("jqbOutput"),
            primaryLabel: t("jqbWhere"),
            secondaryLabel: t("jqbValues"),
            canonical: t("jqbCanonical"),
            canonicalHint: t("jqbCanonicalHint"),
            reverseError: reverseText,
            compileError: compiled.ok ? null : t("jqbCompileError", { error: compiled.error }),
            copy: t("jqbCopy"),
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `index.ts`**

```ts
import type { ToolModule } from "@/tools/types";

import { JsonbQueryBuilder } from "./ui";

export const tool: ToolModule = { id: "jsonb-query-builder", Component: JsonbQueryBuilder };
```

- [ ] **Step 7: Wire into the app loaders**
  - `apps/web/src/tools/index.ts`: `import { tool as jsonbQueryBuilder } from "./jsonb-query-builder";` and add `jsonbQueryBuilder` to `toolModules`.
  - `apps/web/src/tools/messages.ts`: `import { messages as jsonbQueryBuilder } from "./jsonb-query-builder/messages";` and add to `toolMessages`.

- [ ] **Step 8: Write specs**

`ui.spec.tsx` (smoke + compiled output appears):

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { messages } from "./messages";
import { JsonbQueryBuilder } from "./ui";

describe("JsonbQueryBuilder", () => {
  it("renders the builder and the compiled-query panel", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
        <JsonbQueryBuilder />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Fields")).toBeTruthy();
    expect(screen.getAllByText("Compiled query").length).toBeGreaterThan(0);
  });
});
```

`ui/query-output-panel.spec.tsx`: render with a sample `primary`/`secondary`, assert the WHERE text shows; click the canonical tab, assert textarea appears; render with `compileError` set, assert it shows. (Follow the data-panel.spec.tsx style; no NextIntl needed since labels are passed as plain strings.)

- [ ] **Step 9: Run specs + typecheck + lint**

```bash
pnpm -F web vitest:run src/tools/jsonb-query-builder
pnpm -F @rfjs/web-core vitest:run
pnpm -F web check-types && pnpm -F web lint
```
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/tools packages/web-core
git commit -m "feat(web): add jsonb-query-builder tool"
```

---

## Task 5: Build the `sql-filter-builder` tool

Identical structure to Task 4 with these differences:
- Tool id `sql-filter-builder`; component `SqlFilterBuilder`; `engineId="sql-filter"`.
- Registry entry `category: 'query'`, `relatedPackages: ['@rfjs/sql-filter', '@rfjs/filter-builder']`.
- Message key prefix `sfb*`; title "SQL Filter Builder" / "SQL 篩選建構器"; description about compiling to **parameterized SQL over plain columns**. `primaryLabel` = "WHERE", `secondaryLabel` = "values".
- `QueryOutputPanel` is reused from `jsonb-query-builder/ui/query-output-panel.tsx`. **Decision point:** since Tasks 4 and 5 use an identical panel, MOVE `query-output-panel.tsx` (+ spec) into `apps/web/src/tools/_filter-builder/` during this task, re-export from the barrel, and update the jsonb tool's import. Keep `QueryOutputLabels` there too.

**Files:**
- Create: `apps/web/src/tools/sql-filter-builder/{index.ts,messages.ts,ui.tsx,ui.spec.tsx}`
- Move: `jsonb-query-builder/ui/query-output-panel.tsx` (+spec) → `_filter-builder/query-output-panel.tsx`; update `_filter-builder/index.ts` barrel + jsonb tool import
- Modify: `packages/web-core/src/registry/tools.ts`, `apps/web/src/tools/index.ts`, `apps/web/src/tools/messages.ts`

- [ ] **Step 1:** Move `query-output-panel.tsx` + spec into `_filter-builder/`; add `export { QueryOutputPanel, type QueryOutputLabels } from "./query-output-panel";` to the barrel; change jsonb `ui.tsx` import to `from "@/tools/_filter-builder"`; delete the now-empty `jsonb-query-builder/ui/` dir.
- [ ] **Step 2:** Run jsonb specs to confirm the move didn't break it: `pnpm -F web vitest:run src/tools/jsonb-query-builder src/tools/_filter-builder`. Expected: PASS.
- [ ] **Step 3:** Add the registry entry (above). Run `pnpm -F @rfjs/web-core vitest:run`.
- [ ] **Step 4:** Write `messages.ts` (`sfb*` keys, en + zh-TW) — same key shape as `jqb*`.
- [ ] **Step 5:** Write `ui.tsx` (copy jsonb `ui.tsx`, swap prefix→`sfb`, `engineId="sql-filter"`, import `QueryOutputPanel` from the barrel).
- [ ] **Step 6:** Write `index.ts` (`SqlFilterBuilder`, id `sql-filter-builder`).
- [ ] **Step 7:** Wire into `tools/index.ts` + `tools/messages.ts`.
- [ ] **Step 8:** Write `ui.spec.tsx` (smoke).
- [ ] **Step 9:** `pnpm -F web vitest:run src/tools/sql-filter-builder && pnpm -F @rfjs/web-core vitest:run && pnpm -F web check-types && pnpm -F web lint`. Expected: green.
- [ ] **Step 10:** Commit `feat(web): add sql-filter-builder tool`.

---

## Task 6: Build the `mongo-query-builder` tool

Identical structure to Task 5 with these differences:
- Tool id `mongo-query-builder`; component `MongoQueryBuilder`; `engineId="mongo"`.
- Registry entry `category: 'query'`, `relatedPackages: ['@rfjs/mongo-query', '@rfjs/filter-builder']`.
- Message key prefix `mqb*`; title "Mongo Query Builder" / "Mongo 查詢建構器"; description about compiling to a **MongoDB query object**.
- `QueryOutputPanel` reused from `_filter-builder/`. Output is a single object: `primaryLabel` = "query" (the Mongo object); `secondaryLabel` = "" (empty → the values block is hidden, since mongo embeds values inline).
- **NOT logic:** add a message `mqbNoNot` and map a compile error of `"mongoNoNot"` to it (e.g. en "MongoDB queries can't use a NOT group — use NONE (nor) instead", zh-TW "MongoDB 查詢不支援 NOT 群組 —— 請改用 NONE（nor）"). In `ui.tsx`, the `compileError` label becomes: `compiled.ok ? null : compiled.error === "mongoNoNot" ? t("mqbNoNot") : t("mqbCompileError", { error: compiled.error })`.

**Files:** `apps/web/src/tools/mongo-query-builder/{index.ts,messages.ts,ui.tsx,ui.spec.tsx}` + the three registry/loader edits.

- [ ] **Step 1:** Registry entry. Run `pnpm -F @rfjs/web-core vitest:run`.
- [ ] **Step 2:** `messages.ts` (`mqb*` keys incl. `mqbNoNot`, en + zh-TW).
- [ ] **Step 3:** `ui.tsx` (copy sql `ui.tsx`, swap prefix→`mqb`, `engineId="mongo"`, `secondaryLabel: ""`, the `mqbNoNot` branch in compileError).
- [ ] **Step 4:** `index.ts` (`MongoQueryBuilder`, id `mongo-query-builder`).
- [ ] **Step 5:** Wire into `tools/index.ts` + `tools/messages.ts`.
- [ ] **Step 6:** `ui.spec.tsx` smoke test. Add one case asserting a NOT group shows the `mqbNoNot` message: build the tool, then since the tree starts empty, simplest is a `query-output-panel`-level test isn't enough — instead unit-test the message wiring by rendering with a pre-set NOT tree is hard via UI. Keep the smoke test for the tool; the NOT→error mapping is already covered by `mongo.spec.ts` at the engine layer. (Do not over-test the UI.)
- [ ] **Step 7:** `pnpm -F web vitest:run src/tools/mongo-query-builder && pnpm -F @rfjs/web-core vitest:run && pnpm -F web check-types && pnpm -F web lint`. Expected: green.
- [ ] **Step 8:** Commit `feat(web): add mongo-query-builder tool`.

---

## Task 7: Retire the old `query-builder` showcase tool

**Files:**
- Delete: `apps/web/src/tools/query-builder/` (whole dir)
- Modify: `packages/web-core/src/registry/tools.ts` (remove the `query-builder` entry)
- Modify: `apps/web/src/tools/index.ts` (remove import + array entry)
- Modify: `apps/web/src/tools/messages.ts` (remove import + array entry)
- Modify: `packages/web-core/src/registry/registry.spec.ts` / `apps/web/src/lib/nav.spec.ts` if either enumerates `query-builder`

**Interfaces:** none produced. This removes a tool; the three new builders cover its scenarios.

- [ ] **Step 1:** Confirm nothing else imports it: `grep -rn "query-builder\"" apps/web/src packages/web-core/src` and `grep -rn "queryBuilder" apps/web/src`. Note every reference (registry entry, `tools/index.ts`, `tools/messages.ts`). The pure generators `jsonb-query-generator` / `mongo-query-generator` are DIFFERENT tools — do NOT touch them.
- [ ] **Step 2:** Remove the `query-builder` object from `tools.ts`.
- [ ] **Step 3:** Remove `queryBuilder` import + array entry from `tools/index.ts` and `tools/messages.ts`.
- [ ] **Step 4:** `git rm -r apps/web/src/tools/query-builder`.
- [ ] **Step 5:** Update any spec that names `query-builder`. Run `pnpm -F @rfjs/web-core vitest:run && pnpm -F web vitest:run src/lib`. Expected: green (nav.spec derives groups dynamically; if it hard-listed query-builder, fix it).
- [ ] **Step 6:** Full app check: `pnpm -F web vitest:run && pnpm -F web check-types && pnpm -F web lint`. Expected: green.
- [ ] **Step 7:** Commit `feat(web): retire toggle-based query-builder in favor of per-engine builders`.

---

## Task 8: Whole-repo verification + PR

- [ ] **Step 1: Rebuild filter-builder dist** (belt-and-suspenders, in case anything touched it since Task 2):

Run: `pnpm -F @rfjs/filter-builder build`

- [ ] **Step 2: Affected build + test + typecheck + lint across the repo**

```bash
pnpm -F @rfjs/filter-builder vitest:run
pnpm -F @rfjs/web-core vitest:run
pnpm -F web vitest:run
pnpm -F web check-types
pnpm -F web lint
pnpm -F web build
```
Expected: all green; `next build` statically generates the three new `/tools/<id>` routes (no errors, no missing-translation warnings).

- [ ] **Step 3: Manual verification checklist** (the agent can't run a browser; document what a human should confirm in the PR body):
  - each of `/en/tools/{jsonb-query-builder,sql-filter-builder,mongo-query-builder}` renders, sidebar shows each under its package group
  - typing a filter updates the compiled output; copy buttons work
  - mongo NOT group shows the `mqbNoNot` hint
  - editing the canonical JSON round-trips back into the tree

- [ ] **Step 4: Push + open ONE PR to main**

```bash
git push -u origin feat/per-engine-filter-builders
gh pr create --base main --title "feat(web): per-engine filter builders (jsonb-query, sql-filter, mongo-query)" --body "<summary + the manual checklist above + the two engines added>"
```

End the PR body with the Claude Code attribution line.

---

## Self-Review

**1. Spec coverage**
- jsonb-query scenario → Task 4 ✓ (reuses existing `jsonb` engine)
- sql-filter scenario → Task 5 ✓ (new `sql-filter` engine, Task 1)
- mongo-query scenario → Task 6 ✓ (new `mongo` engine, Task 2)
- "follow data-filter-builder design" → shared scaffold (Task 3) guarantees identical look/behavior ✓
- "mongo needs a new engine first" → Task 2 precedes Task 6 ✓
- retire old query-builder → Task 7 ✓
- one branch / one PR → Task 8 ✓

**2. Placeholder scan** — engine code + scaffold + jsonb tool are given in full. sql/mongo tools are "copy the jsonb tool, swap prefix + engineId + labels" — that is a concrete, complete instruction because the jsonb tool is fully specified; repeating ~120 identical lines three times adds no information. The `<body>` of the PR and the sql/mongo `messages.ts` are described by exact analogy to the fully-written jsonb `messages.ts`.

**3. Type consistency**
- `Engine.compile(group, ctx)` signature matches across both new engines ✓
- `EngineId` extended once (Task 1) and used by registry (Tasks 1, 2) ✓
- `toCompileContext` returns `CompileContext { fields: CompileField[] }` matching `CompileField { path, kind, dataType, elementType? }` ✓
- `useFilterBuilder` return shape consumed identically by all four tools ✓
- `QueryOutputLabels` fields referenced in `ui.tsx` (`output, primaryLabel, secondaryLabel, canonical, canonicalHint, reverseError, compileError, copy`) match the interface ✓

**Open risks flagged for the implementer (verify, don't assume):**
- Exact export names of `@rfjs/sql-filter` (`buildColumnQuery`, `ColumnConfig`, `ColumnCondition`, `ColumnOperator`, `ColumnType`, `FilterGroup`) and `@rfjs/mongo-query` (`genFilterQuery`, `MgoFilterMetadata`, `MgoFieldCondition`, `MgoConditionType`, `ValueType`) and `@rfjs/data-transform` (`MgoDataType`) — confirm against each `src/index.ts` before writing imports.
- `apps/web` script names (`check-types` vs `typecheck`, `vitest:run`) — confirm in `apps/web/package.json`.
- Whether `FilterTreeEditor` restricts logic options per engine — it does NOT (mongo `not` is handled by a graceful compile error, which is the chosen v1 behavior).
- `mongo-query`'s `toQuery('regex', …)` value handling — the engine passes a real `RegExp`; confirm `genFilterQuery`/`RegexQuery` accept a `RegExp` value (planning indicates `RegexQuery` constructor takes `pattern: RegExp`).
