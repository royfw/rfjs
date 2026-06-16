# query-builder pg-filter engine + field-kind + 3-column UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `pg-filter` engine to the apps/web query-builder that previews unified column+jsonb PostgreSQL SQL, introduce a per-field column/jsonb "kind" model, and redesign the tool as a full-width 3-column colored UI.

**Architecture:** Phase A is pure logic (model + engine-registry interface + the pg-filter engine), fully TDD. Phase B rebuilds the tool's UI once into the 3-column layout (left data source + schema, middle colored tree, right engine output) — folding in the B1 wiring so UI files aren't edited twice. The existing `jsonb`/`data-filter` engines need no changes (their narrower functions satisfy the widened `Engine` interface structurally).

**Tech Stack:** Next.js (apps/web), React 19, `@rfjs/pg-filter` (+ transitively `@rfjs/sql-filter`, `@rfjs/jsonb-query`), `@rfjs/web-ui` (Tailwind tokens), next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-16-query-builder-pg-filter-design.md`
**Decisions locked:** D1 default kind `jsonb` + one-click "top-level scalars → column"; D2 dialect `legacy`; D3 no sort/pagination in builder (WHERE preview only); D4 `lg` 3-column else stacked.

All paths are under `apps/web/src/tools/query-builder/` unless noted. Run tests with `pnpm -F web vitest:run <pattern>`. Commit subjects lowercase (commitlint); never `--no-verify`. Commit messages in English.

---

## File Structure

**Phase A — logic**
- `logic/types.ts` (modify) — add `FieldKind`; `FieldSchema.kind`.
- `logic/schema-infer.ts` (modify) — inferred fields default `kind: 'jsonb'`.
- `logic/field-kind.ts` (create, + spec) — `canBeColumn`, `mapColumnType`, `SqlColumnType`.
- `logic/engines/types.ts` (modify) — `EngineId += 'pg-filter'`; `CompileField`/`CompileContext`; `operators(...,kind?)`; `compile(group, ctx)`.
- `logic/engines/pg-filter.ts` (create, + spec) — the engine.
- `logic/engines/index.ts` (modify) — register pg-filter.
- `apps/web/package.json` (modify) — add `@rfjs/pg-filter`.

**Phase B — UI (3-column)**
- `ui/index.tsx` (rewrite) — 3-column layout, build `CompileContext`, thread create-field.
- `ui/three-pane.tsx` (create) — full-width 3-column container.
- `ui/schema-panel.tsx` (modify) — per-field kind control + "top-level scalars → column" button.
- `logic/field-create.ts` (create, + spec) — pure `addInferredField` helper for the creatable combobox.
- `ui/field-combobox.tsx` (create) — input + datalist creatable field picker.
- `logic/colors.ts` (create, + spec) — token-class mapping for logic/dataType/operator.
- `ui/builder-tree.tsx` (modify) — pass field `kind` to `operators`; use combobox; apply colors.
- `messages.ts` (modify) — new i18n keys (en + zh-TW).

---

## Phase A — Logic

### Task 1: field-kind model + helper

**Files:**
- Modify: `logic/types.ts`
- Modify: `logic/schema-infer.ts`
- Modify: `logic/schema-infer.spec.ts`
- Create: `logic/field-kind.ts`
- Test: `logic/field-kind.spec.ts`

- [ ] **Step 1: Write the failing test** `logic/field-kind.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canBeColumn, mapColumnType } from "./field-kind";

describe("field-kind", () => {
  it("maps scalar dataTypes to SQL column types", () => {
    expect(mapColumnType("string")).toBe("text");
    expect(mapColumnType("numeric")).toBe("numeric");
    expect(mapColumnType("date")).toBe("timestamp");
    expect(mapColumnType("boolean")).toBe("boolean");
  });

  it("allows only scalar dataTypes as columns", () => {
    expect(canBeColumn("string")).toBe(true);
    expect(canBeColumn("numeric")).toBe(true);
    expect(canBeColumn("date")).toBe(true);
    expect(canBeColumn("boolean")).toBe(true);
    expect(canBeColumn("object")).toBe(false);
    expect(canBeColumn("array")).toBe(false);
  });

  it("throws when mapping a non-column dataType", () => {
    expect(() => mapColumnType("object")).toThrow();
    expect(() => mapColumnType("array")).toThrow();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm -F web vitest:run field-kind`
Expected: FAIL (`./field-kind` not found).

- [ ] **Step 3: Create `logic/field-kind.ts`**

```ts
import type { PgFilterConfig } from "@rfjs/pg-filter";

import type { FieldType } from "./types";

// Derive the SQL column type union from pg-filter's config shape (avoids a direct
// @rfjs/sql-filter import; stays in sync with the package).
export type SqlColumnType = PgFilterConfig["columns"][string]["type"];

const COLUMN_TYPE_BY_DATATYPE: Partial<Record<FieldType, SqlColumnType>> = {
  string: "text",
  numeric: "numeric",
  date: "timestamp",
  boolean: "boolean",
};

export function canBeColumn(dataType: FieldType): boolean {
  return dataType in COLUMN_TYPE_BY_DATATYPE;
}

export function mapColumnType(dataType: FieldType): SqlColumnType {
  const t = COLUMN_TYPE_BY_DATATYPE[dataType];
  if (!t) throw new Error(`dataType "${dataType}" cannot be a SQL column`);
  return t;
}
```

- [ ] **Step 4: Add `FieldKind` + `FieldSchema.kind` to `logic/types.ts`**

Add the type and field (rest of the file unchanged):
```ts
export type FieldKind = "column" | "jsonb";
```
And in `FieldSchema`, add `kind`:
```ts
export interface FieldSchema {
  path: string;
  dataType: FieldType;
  elementType?: ElementType;
  include: boolean;
  kind: FieldKind; // 'column' = real SQL column, 'jsonb' = path inside the jsonb blob
}
```

- [ ] **Step 5: Default inferred fields to `jsonb` in `logic/schema-infer.ts`**

In `inferSchema`, the final `.map(...)` returns the FieldSchema objects — add `kind: "jsonb"`:
```ts
  return [...acc.entries()].map(([path, t]) => ({
    path,
    dataType: t.dataType,
    ...(t.elementType ? { elementType: t.elementType } : {}),
    include: true,
    kind: "jsonb" as const,
  }));
```

- [ ] **Step 6: Update `logic/schema-infer.spec.ts`**

The existing assertions compare returned `FieldSchema[]`. Add `kind: "jsonb"` to each expected object. (Open the file; for every expected field object that asserts `include: true`, add `kind: "jsonb"`. If it uses `toEqual` on full arrays, add the key to each element; if it uses `toMatchObject`/`toContainEqual`, add `kind` to those matchers.)

- [ ] **Step 7: Run, expect PASS**

Run: `pnpm -F web vitest:run field-kind schema-infer`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/tools/query-builder/logic/types.ts apps/web/src/tools/query-builder/logic/schema-infer.ts apps/web/src/tools/query-builder/logic/schema-infer.spec.ts apps/web/src/tools/query-builder/logic/field-kind.ts apps/web/src/tools/query-builder/logic/field-kind.spec.ts
git commit -m "feat(web/query-builder): field-kind model (column vs jsonb) + type mapping"
```

---

### Task 2: widen the Engine interface (CompileContext + operator kind)

**Files:**
- Modify: `logic/engines/types.ts`
- Modify: `ui/index.tsx` (the single `compile` caller — minimal change; full rewrite in Phase B)

> Note: the existing `jsonbEngine` / `dataFilterEngine` need NO changes — a `compile(group)` function is assignable to the widened `compile(group, ctx)` type, and `operators(dataType, elementType)` is assignable to `operators(dataType, elementType?, kind?)`. Do NOT add `'pg-filter'` to `EngineId` here (it would make `ENGINES: Record<EngineId, Engine>` in index.ts non-exhaustive until Task 3).

- [ ] **Step 1: Widen `logic/engines/types.ts`**

Add imports + types; widen `Engine`:
```ts
import type { FilterGroupLike } from "../compile";
import type { ElementType, FieldKind, FieldType } from "../types";

export type OperatorArity = "none" | "one" | "two" | "list";

export interface OperatorSpec {
  op: string;
  arity: OperatorArity;
}

export type EngineId = "jsonb" | "data-filter";

export interface CompileField {
  path: string;
  kind: FieldKind;
  dataType: FieldType;
  elementType?: ElementType;
}

export interface CompileContext {
  fields: CompileField[];
}

export type EngineOutput =
  | { ok: true; primary: string; secondary?: string }
  | { ok: false; error: string };

export interface Engine {
  id: EngineId;
  label: string;
  operators(dataType: string, elementType?: string, kind?: FieldKind): OperatorSpec[];
  compile(group: FilterGroupLike, ctx: CompileContext): EngineOutput;
}
```

- [ ] **Step 2: Update the `compile` caller in `ui/index.tsx`**

Replace the `output` memo so it passes a `CompileContext` built from the included schema fields:
```ts
  const output = useMemo(
    () =>
      getEngine(engineId).compile(treeToFilterGroup(tree), {
        fields: schema
          .filter((f) => f.include)
          .map((f) => ({ path: f.path, kind: f.kind, dataType: f.dataType, elementType: f.elementType })),
      }),
    [engineId, tree, schema],
  );
```

- [ ] **Step 3: Verify typecheck + existing engine tests still pass**

Run: `pnpm -F web vitest:run engines && pnpm -F web typecheck`
Expected: PASS (jsonb/data-filter unchanged and still satisfy `Engine`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/tools/query-builder/logic/engines/types.ts apps/web/src/tools/query-builder/ui/index.tsx
git commit -m "feat(web/query-builder): widen Engine interface with CompileContext + operator kind"
```

---

### Task 3: pg-filter engine

**Files:**
- Modify: `apps/web/package.json` (add dep)
- Create: `logic/engines/pg-filter.ts`
- Test: `logic/engines/pg-filter.spec.ts`
- Modify: `logic/engines/types.ts` (add `'pg-filter'` to `EngineId`)
- Modify: `logic/engines/index.ts` (register)

- [ ] **Step 1: Add the dependency**

In `apps/web/package.json` `dependencies`, add (keep the list alphabetical-ish near the other `@rfjs/*`):
```json
    "@rfjs/pg-filter": "workspace:*",
```
Run: `pnpm install`
Expected: links `@rfjs/pg-filter`.

- [ ] **Step 2: Write the failing test** `logic/engines/pg-filter.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pgFilterEngine } from "./pg-filter";
import type { CompileContext } from "./types";

const ctx = (fields: CompileContext["fields"]): CompileContext => ({ fields });

describe("pgFilterEngine.operators", () => {
  it("returns column operators for column-kind fields", () => {
    const ops = pgFilterEngine.operators("string", undefined, "column").map((o) => o.op);
    expect(ops).toContain("contains");
    expect(ops).toContain("startswith");
    expect(ops).toContain("eq");
    expect(ops).not.toContain("icontains"); // jsonb-only, not a column op
  });

  it("returns jsonb operators for jsonb-kind fields", () => {
    const ops = pgFilterEngine.operators("string", undefined, "jsonb").map((o) => o.op);
    expect(ops).toContain("icontains"); // jsonb engine has this
  });
});

describe("pgFilterEngine.compile", () => {
  it("renders a pure column condition", () => {
    const group = { logic: "and", filters: [{ field: "name", dataType: "string", operator: "contains", value: "ab" }] };
    const out = pgFilterEngine.compile(group, ctx([{ path: "name", kind: "column", dataType: "string" }]));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.primary).toContain("name");
      expect(out.primary).toContain("$1");
      expect(out.secondary).toContain("ab");
    }
  });

  it("renders a pure jsonb condition against the data column", () => {
    const group = { logic: "and", filters: [{ field: "score", dataType: "numeric", operator: "gt", value: 80 }] };
    const out = pgFilterEngine.compile(group, ctx([{ path: "score", kind: "jsonb", dataType: "numeric" }]));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.primary).toContain("data");
  });

  it("mixes column + jsonb leaves with contiguous params", () => {
    const group = {
      logic: "and",
      filters: [
        { field: "name", dataType: "string", operator: "eq", value: "x" },
        { field: "score", dataType: "numeric", operator: "gt", value: 5 },
      ],
    };
    const out = pgFilterEngine.compile(
      group,
      ctx([
        { path: "name", kind: "column", dataType: "string" },
        { path: "score", kind: "jsonb", dataType: "numeric" },
      ]),
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.primary).toContain("name");
      expect(out.primary).toContain("data");
      expect(out.primary).toContain("$1");
      expect(out.primary).toContain("$2");
    }
  });

  it("returns ok:false when a column gets an unsupported operator", () => {
    const group = { logic: "and", filters: [{ field: "n", dataType: "numeric", operator: "contains", value: "x" }] };
    const out = pgFilterEngine.compile(group, ctx([{ path: "n", kind: "column", dataType: "numeric" }]));
    expect(out.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm -F web vitest:run pg-filter`
Expected: FAIL (`./pg-filter` not found).

- [ ] **Step 4: Create `logic/engines/pg-filter.ts`**

```ts
import { buildPgFilter, type PgFilterConfig, type PgFilterGroup, type PgLeaf } from "@rfjs/pg-filter";

import type { FilterConditionLike, FilterGroupLike } from "../compile";
import { mapColumnType } from "../field-kind";
import type { FieldKind } from "../types";
import { arityOf } from "./arity";
import { jsonbEngine } from "./jsonb";
import type { CompileContext, Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
const COLUMN_TEXT_OPS = ["eq", "neq", "contains", "startswith", "gt", "gte", "lt", "lte", ...NULL_OPS];
const COLUMN_NUMERIC_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", ...NULL_OPS]; // numeric + date(timestamp)
const COLUMN_BOOL_OPS = ["eq", "neq", ...NULL_OPS];

function columnOps(dataType: string): string[] {
  if (dataType === "string") return COLUMN_TEXT_OPS;
  if (dataType === "boolean") return COLUMN_BOOL_OPS;
  return COLUMN_NUMERIC_OPS; // numeric, date
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({ op, arity: arityOf(op) }));
}

function toPgLeaf(c: FilterConditionLike, kindByPath: Map<string, FieldKind>): PgLeaf {
  const kind = kindByPath.get(c.field) ?? "jsonb";
  if (kind === "column") {
    return { target: "column", column: c.field, operator: c.operator, value: c.value } as PgLeaf;
  }
  const leaf = {
    target: "jsonb",
    field: c.field,
    dataType: c.dataType,
    operator: c.operator,
    ...(c.value !== undefined ? { value: c.value } : {}),
    ...(c.elementType ? { elementType: c.elementType } : {}),
    ...(c.filters ? { filters: c.filters } : {}),
  };
  return leaf as unknown as PgLeaf;
}

function toPgGroup(group: FilterGroupLike, kindByPath: Map<string, FieldKind>): PgFilterGroup {
  return {
    logic: group.logic as PgFilterGroup["logic"],
    filters: group.filters.map((node) =>
      "logic" in node
        ? toPgGroup(node as FilterGroupLike, kindByPath)
        : toPgLeaf(node as FilterConditionLike, kindByPath),
    ),
  };
}

export const pgFilterEngine: Engine = {
  id: "pg-filter",
  label: "pg-filter (column + jsonb)",
  operators(dataType, elementType, kind) {
    if (kind === "column") return toSpecs(columnOps(dataType));
    return jsonbEngine.operators(dataType, elementType); // jsonb fields reuse the jsonb matrix
  },
  compile(group, ctx: CompileContext) {
    try {
      const kindByPath = new Map(ctx.fields.map((f) => [f.path, f.kind]));
      const columns = ctx.fields
        .filter((f) => f.kind === "column")
        .reduce<PgFilterConfig["columns"]>((acc, f) => {
          acc[f.path] = { column: f.path, type: mapColumnType(f.dataType) };
          return acc;
        }, {});
      const config: PgFilterConfig = { columns, jsonb: { column: "data", dialect: "legacy" } };
      const { where, values } = buildPgFilter(config, { filter: toPgGroup(group, kindByPath) });
      return { ok: true, primary: where, secondary: JSON.stringify(values, null, 2) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "queryFailed" };
    }
  },
};
```

- [ ] **Step 5: Add `'pg-filter'` to `EngineId` in `logic/engines/types.ts`**

```ts
export type EngineId = "jsonb" | "data-filter" | "pg-filter";
```

- [ ] **Step 6: Register in `logic/engines/index.ts`**

```ts
import { dataFilterEngine } from "./data-filter";
import { jsonbEngine } from "./jsonb";
import { pgFilterEngine } from "./pg-filter";
import type { Engine, EngineId } from "./types";

const ENGINES: Record<EngineId, Engine> = {
  jsonb: jsonbEngine,
  "data-filter": dataFilterEngine,
  "pg-filter": pgFilterEngine,
};

export const ENGINE_IDS: EngineId[] = ["jsonb", "data-filter", "pg-filter"];

export function getEngine(id: EngineId): Engine {
  return ENGINES[id];
}

export type {
  Engine,
  EngineId,
  OperatorSpec,
  OperatorArity,
  EngineOutput,
  CompileContext,
  CompileField,
} from "./types";
```

- [ ] **Step 7: Run, expect PASS + typecheck**

Run: `pnpm -F web vitest:run pg-filter engines && pnpm -F web typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/tools/query-builder/logic/engines
git commit -m "feat(web/query-builder): pg-filter engine for unified column+jsonb SQL preview"
```

---

## Phase B — 3-column UI

### Task 4: schema-panel — per-field kind control + one-click columns

**Files:**
- Modify: `ui/schema-panel.tsx`
- Modify: `messages.ts`

- [ ] **Step 1: Add i18n keys** in `messages.ts` under `ToolUI` for BOTH `en` and `zh-TW`:

en:
```ts
      kindColumn: "column",
      kindJsonb: "jsonb",
      topLevelToColumns: "Top-level scalars → columns",
```
zh-TW:
```ts
      kindColumn: "欄位",
      kindJsonb: "jsonb",
      topLevelToColumns: "頂層 scalar 設為欄位",
```

- [ ] **Step 2: Add the kind control + button to `ui/schema-panel.tsx`**

Import the helper at the top:
```ts
import { canBeColumn } from "@/tools/query-builder/logic/field-kind";
import type { FieldKind } from "@/tools/query-builder/logic/types";
```

Inside the field row (after the type `<select>`), add a kind toggle that is forced to `jsonb` and disabled when the dataType can't be a column:
```tsx
              <select
                aria-label={`kind ${f.path}`}
                value={canBeColumn(f.dataType) ? f.kind : "jsonb"}
                disabled={!canBeColumn(f.dataType)}
                onChange={(e) => patch(f.path, { kind: e.target.value as FieldKind })}
                className="rounded-sm border bg-transparent px-1 py-0.5 text-xs disabled:opacity-50"
              >
                <option value="jsonb">{t("kindJsonb")}</option>
                <option value="column">{t("kindColumn")}</option>
              </select>
```

When the dataType select changes to object/array, also reset kind to jsonb. In the existing `patch` call for the type select, change it to also clear kind when needed:
```tsx
                onChange={(e) => {
                  const dataType = e.target.value as FieldType;
                  patch(f.path, canBeColumn(dataType) ? { dataType } : { dataType, kind: "jsonb" });
                }}
```

Add a one-click button above or below the field list (inside the Panel, after the field list `</div>`):
```tsx
        <button
          type="button"
          onClick={() =>
            onSchemaChange(
              schema.map((f) =>
                !f.path.includes(".") && canBeColumn(f.dataType) ? { ...f, kind: "column" } : f,
              ),
            )
          }
          className="self-start rounded-sm border border-border bg-transparent px-2 py-1 text-xs"
        >
          {t("topLevelToColumns")}
        </button>
```

- [ ] **Step 3: Verify typecheck + build**

Run: `pnpm -F web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/tools/query-builder/ui/schema-panel.tsx apps/web/src/tools/query-builder/messages.ts
git commit -m "feat(web/query-builder): per-field column/jsonb kind control"
```

---

### Task 5: creatable field combobox

**Files:**
- Create: `logic/field-create.ts`
- Test: `logic/field-create.spec.ts`
- Create: `ui/field-combobox.tsx`
- Modify: `ui/builder-tree.tsx` (use the combobox; pass field kind to `operators`)

- [ ] **Step 1: Write the failing test** `logic/field-create.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addInferredField } from "./field-create";
import type { FieldSchema } from "./types";

const base: FieldSchema[] = [{ path: "name", dataType: "string", include: true, kind: "jsonb" }];

describe("addInferredField", () => {
  it("appends a new jsonb string field when the path is unknown", () => {
    const next = addInferredField(base, "newKey");
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ path: "newKey", dataType: "string", include: true, kind: "jsonb" });
  });

  it("returns the same array when the path already exists", () => {
    const next = addInferredField(base, "name");
    expect(next).toBe(base);
  });

  it("ignores empty paths", () => {
    expect(addInferredField(base, "")).toBe(base);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm -F web vitest:run field-create`
Expected: FAIL.

- [ ] **Step 3: Create `logic/field-create.ts`**

```ts
import type { FieldSchema } from "./types";

// Append a new field (default jsonb string) when the user types a key not in the schema.
export function addInferredField(schema: FieldSchema[], path: string): FieldSchema[] {
  if (!path || schema.some((f) => f.path === path)) return schema;
  return [...schema, { path, dataType: "string", include: true, kind: "jsonb" }];
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm -F web vitest:run field-create`
Expected: PASS.

- [ ] **Step 5: Create `ui/field-combobox.tsx`** (input + datalist; free text allowed = creatable):

```tsx
"use client";

let nextId = 0;

export function FieldCombobox({
  value,
  options,
  ariaLabel,
  onCommit,
}: {
  value: string;
  options: string[];
  ariaLabel: string;
  onCommit: (path: string) => void;
}) {
  const listId = `fields-${(nextId += 1)}`;
  return (
    <>
      <input
        aria-label={ariaLabel}
        list={listId}
        defaultValue={value}
        onBlur={(e) => onCommit(e.target.value.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="min-w-0 flex-1 rounded-sm border bg-transparent px-2 py-1 text-sm"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
```

- [ ] **Step 6: Use the combobox + pass kind to `operators` in `ui/builder-tree.tsx`**

`GroupNode` and `ConditionRow` need an `onCreateField(path: string)` callback threaded from the top. Add `onCreateField: (path: string) => void` to both component prop types and pass it through the recursion (alongside `schema`).

In `ConditionRow`, look up the selected field's kind and pass it to `operators`, and replace the field `<select>` with the combobox:
```tsx
  const fieldKind = schema.find((s) => s.path === condition.field)?.kind;
  const ops = engine.operators(condition.dataType, condition.elementType, fieldKind);
```
Replace the field `<select>...</select>` block with:
```tsx
      <FieldCombobox
        ariaLabel="field"
        value={condition.field}
        options={fields.map((f) => f.path)}
        onCommit={(path) => {
          if (path && !schema.some((s) => s.path === path)) onCreateField(path);
          onField(path);
        }}
      />
```
Keep the existing `onField` logic, but make it resilient when the field isn't in the schema yet (combobox just created it; the schema prop updates next render). Update `onField` to default to a jsonb string field when not found, and pass kind into the ops lookup:
```tsx
  function onField(path: string) {
    const f = schema.find((s) => s.path === path);
    const dataType = f?.dataType ?? "string";
    const elementType = f?.elementType;
    const kind = f?.kind ?? "jsonb";
    const nextOps = engine.operators(dataType, elementType, kind);
    onChange({ field: path, dataType, elementType, operator: nextOps[0]?.op ?? "", value: "" });
  }
```
Add the import:
```ts
import { FieldCombobox } from "./field-combobox";
```

- [ ] **Step 7: Verify typecheck + tests**

Run: `pnpm -F web vitest:run field-create && pnpm -F web typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/tools/query-builder/logic/field-create.ts apps/web/src/tools/query-builder/logic/field-create.spec.ts apps/web/src/tools/query-builder/ui/field-combobox.tsx apps/web/src/tools/query-builder/ui/builder-tree.tsx
git commit -m "feat(web/query-builder): creatable field combobox + kind-aware operators"
```

---

### Task 6: colored nodes

**Files:**
- Create: `logic/colors.ts`
- Test: `logic/colors.spec.ts`
- Modify: `ui/builder-tree.tsx` (apply color classes)

- [ ] **Step 1: Write the failing test** `logic/colors.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { logicColor, dataTypeColor } from "./colors";

describe("colors", () => {
  it("returns a stable token class per logic operator", () => {
    expect(logicColor("and")).toBe(logicColor("and"));
    expect(logicColor("and")).not.toBe(logicColor("or"));
    expect(logicColor("and")).toMatch(/^text-/);
  });

  it("returns a token class per dataType and a fallback", () => {
    expect(dataTypeColor("string")).toMatch(/^text-/);
    expect(dataTypeColor("unknown")).toMatch(/^text-/);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm -F web vitest:run colors`
Expected: FAIL.

- [ ] **Step 3: Create `logic/colors.ts`** (web-ui Tailwind semantic tokens only — no hex):

```ts
import type { LogicOp } from "./types";

const LOGIC: Record<LogicOp, string> = {
  and: "text-signal",
  or: "text-accent",
  nor: "text-fault",
  not: "text-warning",
};

const DATATYPE: Record<string, string> = {
  string: "text-signal",
  numeric: "text-accent",
  date: "text-accent",
  boolean: "text-warning",
  object: "text-muted-foreground",
  array: "text-muted-foreground",
};

export function logicColor(op: LogicOp): string {
  return LOGIC[op];
}

export function dataTypeColor(dataType: string): string {
  return DATATYPE[dataType] ?? "text-muted-foreground";
}
```
> If a token (e.g. `text-accent`/`text-warning`) is not defined in `@rfjs/web-ui`, substitute an existing one (check `packages/web-ui`); the test only requires distinct `text-*` classes, so keep them distinct and token-based.

- [ ] **Step 4: Apply colors in `ui/builder-tree.tsx`**

- Logic `<select>`: add the color class, e.g. `className={`rounded-sm border bg-transparent px-2 py-1 text-sm ${logicColor(group.logic)}`}`.
- ConditionRow: wrap/append the dataType color on the operator `<select>` or a small dataType badge: e.g. show `condition.dataType` in a span with `className={`font-mono text-[10px] ${dataTypeColor(condition.dataType)}`}`.
- Add import: `import { logicColor, dataTypeColor } from "@/tools/query-builder/logic/colors";`

- [ ] **Step 5: Run, expect PASS + typecheck**

Run: `pnpm -F web vitest:run colors && pnpm -F web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tools/query-builder/logic/colors.ts apps/web/src/tools/query-builder/logic/colors.spec.ts apps/web/src/tools/query-builder/ui/builder-tree.tsx
git commit -m "feat(web/query-builder): token-based coloring for logic and dataType"
```

---

### Task 7: three-pane layout

**Files:**
- Create: `ui/three-pane.tsx`
- Rewrite: `ui/index.tsx`

- [ ] **Step 1: Create `ui/three-pane.tsx`** (full-width 3-column at `lg`, stacked below — D4):

```tsx
import type { ReactNode } from "react";

export function ThreePane({
  source,
  builder,
  output,
}: {
  source: ReactNode;
  builder: ReactNode;
  output: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div className="flex flex-col gap-3">{source}</div>
      <div className="flex flex-col gap-3">{builder}</div>
      <div className="flex flex-col gap-3">{output}</div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `ui/index.tsx`** to use ThreePane, move the engine selector to the output column, build `CompileContext`, and thread `onCreateField`:

```tsx
"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { treeToFilterGroup } from "@/tools/query-builder/logic/compile";
import { ENGINE_IDS, getEngine, type EngineId } from "@/tools/query-builder/logic/engines";
import { addInferredField } from "@/tools/query-builder/logic/field-create";
import { runLiveMatch } from "@/tools/query-builder/logic/live-match";
import { inferSchema } from "@/tools/query-builder/logic/schema-infer";
import { emptyGroup } from "@/tools/query-builder/logic/tree-ops";
import type { BuilderGroup, FieldSchema } from "@/tools/query-builder/logic/types";

import { GroupNode } from "./builder-tree";
import { PreviewPanel } from "./preview-panel";
import { SchemaPanel } from "./schema-panel";
import { ThreePane } from "./three-pane";

const SAMPLE = JSON.stringify(
  [
    { name: "Ada", age: 36, active: true, tags: ["ml", "math"] },
    { name: "Bo", age: 12, active: false, tags: ["games"] },
  ],
  null,
  2,
);

const id = () => crypto.randomUUID();

export function QueryBuilder() {
  const t = useTranslations("ToolUI");
  const [sampleText, setSampleText] = useState(SAMPLE);
  const [schema, setSchema] = useState<FieldSchema[]>(() => safeInfer(SAMPLE).schema);
  const [error, setError] = useState<string | null>(() => safeInfer(SAMPLE).error);
  const [engineId, setEngineId] = useState<EngineId>("pg-filter");
  const [tree, setTree] = useState<BuilderGroup>(() => emptyGroup(id));

  function onSample(text: string) {
    setSampleText(text);
    const { schema: next, error: err } = safeInfer(text);
    setError(err);
    if (!err) setSchema(next);
  }

  const rows = useMemo(() => parseRows(sampleText), [sampleText]);
  const output = useMemo(
    () =>
      getEngine(engineId).compile(treeToFilterGroup(tree), {
        fields: schema
          .filter((f) => f.include)
          .map((f) => ({ path: f.path, kind: f.kind, dataType: f.dataType, elementType: f.elementType })),
      }),
    [engineId, tree, schema],
  );
  const live = useMemo(() => runLiveMatch(rows, tree), [rows, tree]);

  return (
    <ThreePane
      source={
        <SchemaPanel
          sampleText={sampleText}
          schema={schema}
          error={error}
          onSampleChange={onSample}
          onSchemaChange={setSchema}
        />
      }
      builder={
        <Panel title={t("builder")}>
          <GroupNode
            group={tree}
            engineId={engineId}
            schema={schema}
            onChange={setTree}
            onCreateField={(path) => setSchema((s) => addInferredField(s, path))}
          />
        </Panel>
      }
      output={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {ENGINE_IDS.map((eid) => (
              <Button
                key={eid}
                size="sm"
                variant={eid === engineId ? "default" : "outline"}
                onClick={() => setEngineId(eid)}
              >
                {getEngine(eid).label}
              </Button>
            ))}
          </div>
          <PreviewPanel output={output} live={live} />
        </div>
      }
    />
  );
}

function parseRows(text: string): unknown[] {
  try {
    const data: unknown = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function safeInfer(text: string): { schema: FieldSchema[]; error: string | null } {
  try {
    return { schema: inferSchema(JSON.parse(text)), error: null };
  } catch {
    return { schema: [], error: "invalidJson" };
  }
}
```

> Note: `GroupNode` must accept and forward `onCreateField` (added in Task 5). If Task 5 only added it to `ConditionRow`, also add `onCreateField` to `GroupNode`'s props and pass it down both recursion branches.

- [ ] **Step 3: Verify typecheck + build (SSG)**

Run: `pnpm -F web typecheck && pnpm -F web build`
Expected: typecheck clean; Next build + SSG prerender succeed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/tools/query-builder/ui/three-pane.tsx apps/web/src/tools/query-builder/ui/index.tsx apps/web/src/tools/query-builder/ui/builder-tree.tsx
git commit -m "feat(web/query-builder): full-width three-pane layout"
```

---

### Task 8: tool description i18n + full verification

**Files:**
- Modify: `messages.ts`

- [ ] **Step 1: Update the tool description** in `messages.ts` to mention column+jsonb + SQL preview (both locales):

en `Tools["query-builder"].description`:
```
"Build nested filters over real columns and JSONB, and preview the generated SQL (jsonb / data-filter / pg-filter)."
```
zh-TW:
```
"在真實欄位與 JSONB 上建構巢狀過濾，並預覽產生的 SQL（jsonb / data-filter / pg-filter）。"
```

- [ ] **Step 2: Full verification**

Run: `pnpm -F web vitest:run && pnpm -F web typecheck && pnpm -F web build`
Expected: all query-builder unit tests pass; typecheck clean; build + SSG succeed.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run: `pnpm -F web dev`, open the query-builder tool, mark `name` as column, add `name contains "A"` + a jsonb `age > 10`, select the pg-filter engine, confirm the SQL preview shows a mixed WHERE with `$1/$2` and the params list.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/tools/query-builder/messages.ts
git commit -m "docs(web/query-builder): update tool description for pg-filter engine"
```

---

## Self-Review Notes (plan vs spec)

- B1 model (FieldSchema.kind, default jsonb=D1, mapType, column-only-scalar) → Task 1 ✅
- Engine interface (CompileContext, operators kind, EngineId pg-filter) → Tasks 2–3 ✅
- pg-filter engine (config from ctx, target tagging, buildPgFilter, legacy dialect=D2, WHERE-only=D3, error→ok:false) → Task 3 ✅
- jsonb/data-filter unchanged (structural assignability) → noted in Task 2 ✅
- live-match engine-independent (no pg-filter special-casing) → unchanged, confirmed in Task 8 smoke ✅
- B3 three-pane (D4 lg/stacked), colored tree (tokens), creatable combobox, engine selector to right, schema kind control + one-click → Tasks 4–7 ✅
- apps/web dep on @rfjs/pg-filter → Task 3 ✅
- i18n en+zh-TW → Tasks 4, 8 ✅
- Excluded B2/B4, no sort/pagination, no new sql-filter operators, no column uuid → not in plan ✅
