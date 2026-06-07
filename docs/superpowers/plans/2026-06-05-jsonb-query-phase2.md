# @rfjs/jsonb-query Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add nested-object, JSON-array, and array-of-objects query support to `buildJsonbQuery` in both dialects (legacy + jsonpath), fully parameterized, with spec coverage and README updates.

**Architecture:** Phase 2 extends the existing condition union with three new condition kinds (`object`, `array` of scalars, `array` of objects / `elemmatch`). Array queries are rendered as self-contained `EXISTS (...)` subqueries in the WHERE clause (legacy) or as `[*]`-filtered jsonpath predicates (jsonpath) — the reserved `from: string[]` result field stays `[]` because EXISTS composes correctly with `or` logic where lateral FROM fragments would not. Object conditions render identical SQL in both dialects (`#>` / `@>`), because SQL/JSON path predicates cannot compare non-scalar values.

**Tech Stack:** TypeScript 5.7, Vitest 3, tsdown, pnpm workspace (Turborepo). No runtime dependencies.

---

## Context: current state (Phase 1, must not break)

Package: `packages/jsonb-query` (`@rfjs/jsonb-query`). Baseline: **6 spec files, 45 tests, all green** (`pnpm -F @rfjs/jsonb-query vitest:run`).

| File | Responsibility |
|---|---|
| `src/types.ts` | Metadata types (`JsonbCondition`, `JsonbFilterGroup`, …) |
| `src/build.ts` | `buildJsonbQuery` — group walker, dialect dispatch |
| `src/param-builder.ts` | `$n` placeholder allocation (`ParamBuilder`) |
| `src/column.ts` | Column identifier validation/quoting |
| `src/escape.ts` | jsonpath string + regex-literal escaping |
| `src/dialect.ts` | `ScalarDialect` interface, `fieldSegments`, value asserts, operator-per-type validation |
| `src/dialect-legacy.ts` | `#>>` + casts dialect |
| `src/dialect-jsonpath.ts` | `jsonb_path_exists` dialect (path + vars both parameterized) |

Key Phase 1 invariants that must hold after every task:
1. All existing spec expectations stay **byte-identical** (SQL strings unchanged).
2. Values and field paths are always parameterized; only validated/quoted identifiers and generated aliases appear in SQL text.
3. `paramOffset` produces contiguous global numbering.
4. Empty groups render to `''` and are dropped.

## Phase 2 API design

### New metadata shapes

```typescript
// 1. Nested object (dot paths already work for scalars; this adds object-valued ops)
{ field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } }
// operators: eq | neq | contains | isnull | isnotnull

// 2. JSON array of scalars — scalar operators with "some element matches" (∃) semantics
{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }
{ field: 'nums', dataType: 'array', elementType: 'numeric', operator: 'range', value: [1, 9] }
{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a', 'b'] }
// isnull/isnotnull test the array FIELD itself; `neq` is excluded (∃ vs ∀ ambiguity)

// 3. Array of objects — elemMatch: all sub-conditions must hold on the SAME element
{
  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
  filters: {
    logic: 'and',
    filters: [
      { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
      { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
    ],
  },
}
// sub-fields are relative to the element; nested and/or groups and nested elemmatch allowed
```

### Operator matrix (new rows)

| dataType | operators |
|---|---|
| `object` | `eq` `neq` `contains` `isnull` `isnotnull` |
| `array` + scalar `elementType` | per element (∃): string → `eq contains startswith endswith terms`; numeric → `eq gt gte lt lte range terms`; date → `eq gt gte lt lte range terms`; boolean → `eq`. Plus field-level `isnull` `isnotnull`; plus `containsall` (string/numeric only) |
| `array` + `elementType: 'object'` | `elemmatch` (with `filters` group) |

### SQL mapping

| Condition | legacy | jsonpath |
|---|---|---|
| object `eq`/`neq` | `(col #> $f) = $v::jsonb` / `<>` | same SQL (path language can't compare objects) |
| object `contains` | `(col #> $f) @> $v::jsonb` | same SQL |
| object/array `isnull` | `(col #>> $f) is null` (shared with scalars) | same SQL |
| array element op | `EXISTS (SELECT 1 FROM jsonb_array_elements_text(<guarded>) AS eN(v) WHERE <op on eN.v>)` | `$."f"[*] ? (@ <op> $v)` via `jsonb_path_exists` |
| array `containsall` | `(col #> $f) @> $v::jsonb` | same SQL |
| elemmatch | `EXISTS (SELECT 1 FROM jsonb_array_elements(<guarded>) AS eN WHERE <group rendered against eN.value>)` | `$."f"[*] ? (@."sku" == $v0 && …)` — one path + one vars object |

`<guarded>` = `case when jsonb_typeof(col #> $f) = 'array' then col #> $f else '[]'::jsonb end` — without it, `jsonb_array_elements` raises a runtime error when the stored value is not an array. The same `$f` placeholder is referenced twice (one param).

### Design decisions (and why)

1. **EXISTS in WHERE, `from` stays `[]`.** Lateral `jsonb_array_elements` FROM fragments multiply rows and cannot compose under `or`. EXISTS has correct "row has ≥1 matching element" semantics and nests arbitrarily. `from` remains reserved.
2. **∃ semantics for array element ops; `neq` excluded.** Mirrors MongoDB's implicit array matching. Mongo's `$ne` on arrays means ∀-not-equal, which contradicts ∃ — rather than ship a confusing operator, exclude it (no `not` group logic exists yet to express ∀).
3. **Object conditions render identical SQL in both dialects.** jsonpath `==` only compares scalars, and the path language has no containment operator — so the jsonpath dialect falls back to `#>` / `@>` (precedent: Phase 1's `isnull` fallback). Bonus: `@>` is GIN-indexable.
4. **Inside `elemmatch`, only scalar conditions, nested groups, and nested elemmatch are allowed.** Object and scalar-array conditions inside elemmatch are rejected by validation in **both** dialects (legacy could support them, but jsonpath's predicate language cannot fall back to SQL per-element; uniform API > dialect-specific capability). Future phase can lift this.
5. **`containsall` excluded for `date`/`boolean` elements.** `@>` on date arrays compares ISO text, not datetimes; boolean containsall is meaningless. Validation rejects.
6. **`JSON.stringify` for all `::jsonb`-bound params.** node-postgres encodes raw JS arrays as Postgres array literals (`{a,b}`), not JSON — explicit stringify is mandatory for array values and used uniformly for objects too.
7. **jsonpath var naming.** Single-condition paths keep Phase 1 names (`$v`, `$lo`/`$hi`, `$v0…`) so existing specs stay byte-identical. elemmatch merges many conditions into one path, so it allocates sequential `$v0, $v1, …` via a `VarSink` abstraction.
8. **Alias uniqueness.** Legacy EXISTS aliases (`e1`, `e2`, …) come from a per-`buildJsonbQuery`-call counter on a new `RenderContext`, so sibling and nested subqueries never collide.

### Per-dialect difficulty notes

- **legacy / arrays:** main risks are (a) runtime crash on non-array data → CASE `jsonb_typeof` guard, (b) alias collisions in nested EXISTS → `ctx.nextAlias()`, (c) recursion: elemmatch sub-groups reuse the normal group walker with `column = 'eN.value'` (the dialect already treats `column` as opaque SQL).
- **jsonpath / arrays:** lax mode auto-unwraps arrays, so `$."f"[*]` is explicit and unambiguous. Difficulty is elemmatch: one merged predicate needs (a) unique var names across all sub-conditions, (b) parenthesization of compound predicates (`range`, multi-`terms`, `isnull`) inside `&&`/`||` chains, (c) `exists (@."sub"[*] ? (…))` for nested elemmatch, (d) `isnull` inside an element = `(!exists (@."x") || @."x" == null)` to cover both missing-key and JSON-null (matching legacy `#>>` semantics).
- **Known semantic divergence (documented, not fixed):** when stored data is not an array, legacy's guard yields no match, while jsonpath lax mode auto-wraps a scalar into a one-element array. Same class of divergence as Phase 1 lax-mode unwrapping; goes in README.

### Out of scope (Phase 2)

- `neq`/∀ operators on array elements; `not` group logic
- object / scalar-array conditions **inside** elemmatch (validated away, both dialects)
- whole-array exact equality (`eq` on `dataType: 'array'`)
- `containsall` for date/boolean elements
- Anything release-related: **do not touch `packages/jsonb-query/package.json` `"private": true`, do not touch `.changeset/config.json` `ignore`, do not add changesets, never run `changeset version/publish` locally.** Release wiring happens after user sign-off, separately.

## File structure

| File | Change |
|---|---|
| `src/types.ts` | Condition union: scalar / object / array / elemmatch |
| `src/dialect.ts` | `RenderContext`, renamed `JsonbQueryDialect` interface (+2 methods), `assertCondition` (scope-aware validation), `assertObjectValue`, shared `renderNullCheck` / `renderJsonbContains` / `isFilterGroup` |
| `src/object-condition.ts` | **new** — dialect-independent object condition rendering |
| `src/dialect-legacy.ts` | extract `renderScalarOp(F, …)`; add `renderArray`, `renderElemMatch` |
| `src/dialect-jsonpath.ts` | refactor to `memberAccessor` + `VarSink` + `scalarPredicate`; add `renderArray`, `renderElemMatch` (group→predicate walker) |
| `src/build.ts` | condition-kind dispatch, `RenderContext` creation, scope threading |
| `src/index.ts` | unchanged (`export * from './types'` already covers new types) |
| `src/dialect.spec.ts`, `src/object-condition.spec.ts` | **new** spec files |
| `src/dialect-legacy.spec.ts`, `src/dialect-jsonpath.spec.ts`, `src/build.spec.ts` | additive describe blocks |
| `README.md`, `README.zh-TW.md` | new operator rows, examples, semantics notes |

Verification commands used throughout (run from repo root):

```bash
pnpm -F @rfjs/jsonb-query vitest:run     # unit tests
pnpm -F @rfjs/jsonb-query typecheck      # tsc --noEmit
pnpm -F @rfjs/jsonb-query lint           # eslint
```

Commits follow the repo's commit-flow conventions (conventional commits, `jsonb-query` scope). The pre-commit hook runs `turbo run lint-staged test --affected` automatically. **No changeset in any task** — the package is in the changesets `ignore` list and stays there for now.

---

### Task 1: Branch + baseline

**Files:** none (git only)

- [ ] **Step 1: Create the feature branch from main**

```bash
git checkout main && git pull && git checkout -b feat/jsonb-query-phase2
```

- [ ] **Step 2: Confirm baseline is green**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: `Test Files 6 passed (6)` / `Tests 45 passed (45)`

---

### Task 2: Phase 2 condition types

**Files:**
- Modify: `src/types.ts` (full replacement below)
- Test: `pnpm -F @rfjs/jsonb-query typecheck` + existing suite (type-only change; runtime tests come with each renderer)

- [ ] **Step 1: Replace `src/types.ts` with the Phase 2 union**

```typescript
export type JsonbDialect = 'legacy' | 'jsonpath';

export type JsonbScalarType = 'string' | 'numeric' | 'date' | 'boolean';

export type JsonbDataType = JsonbScalarType | 'object' | 'array';

export type JsonbValue = string | number | boolean | Date;

/** Value for object-typed conditions: a plain JSON-serializable object. */
export type JsonbObjectValue = Record<string, unknown>;

export type JsonbLogicalOperator = 'and' | 'or';

export type JsonbScalarOperator =
  | 'eq'
  | 'neq'
  | 'isnull'
  | 'isnotnull'
  | 'contains'
  | 'startswith'
  | 'endswith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'range'
  | 'terms';

export type JsonbObjectOperator = 'eq' | 'neq' | 'contains' | 'isnull' | 'isnotnull';

/**
 * Operators on arrays of scalars. Scalar operators use "some element matches"
 * (∃) semantics; `isnull`/`isnotnull` test the array field itself;
 * `containsall` requires every listed value to be present. `neq` is excluded:
 * its exists-vs-forall meaning is ambiguous on arrays.
 */
export type JsonbArrayOperator = Exclude<JsonbScalarOperator, 'neq'> | 'containsall';

export interface JsonbScalarCondition {
  field: string;
  dataType: JsonbScalarType;
  operator: JsonbScalarOperator;
  value?: JsonbValue | JsonbValue[];
  elementType?: never;
  filters?: never;
}

export interface JsonbObjectCondition {
  field: string;
  dataType: 'object';
  operator: JsonbObjectOperator;
  value?: JsonbObjectValue;
  elementType?: never;
  filters?: never;
}

export interface JsonbArrayCondition {
  field: string;
  dataType: 'array';
  elementType: JsonbScalarType;
  operator: JsonbArrayOperator;
  value?: JsonbValue | JsonbValue[];
  filters?: never;
}

export interface JsonbElemMatchCondition {
  field: string;
  dataType: 'array';
  elementType: 'object';
  operator: 'elemmatch';
  /** Conditions applied per element; each `field` is relative to the element. */
  filters: JsonbFilterGroup;
  value?: never;
}

export type JsonbCondition =
  | JsonbScalarCondition
  | JsonbObjectCondition
  | JsonbArrayCondition
  | JsonbElemMatchCondition;

export interface JsonbFilterGroup {
  logic: JsonbLogicalOperator;
  filters: Array<JsonbCondition | JsonbFilterGroup>;
}

export interface JsonbQueryResult {
  where: string;
  values: unknown[];
  /** Always `[]`. Array queries render as EXISTS subqueries inside `where`; reserved. */
  from: string[];
}

export interface BuildJsonbOptions {
  dialect?: JsonbDialect;
  paramOffset?: number;
}
```

Notes: the `?: never` members keep `cond.value` / `cond.filters` accessible on the un-narrowed union, so Phase 1 consumer code still compiles. The old `JsonbCondition` interface shape is the `JsonbScalarCondition` member — existing literals remain assignable.

- [ ] **Step 2: Verify typecheck and tests stay green**

Run: `pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query vitest:run`
Expected: tsc exits 0; `Tests 45 passed (45)`

- [ ] **Step 3: Commit**

```bash
git add packages/jsonb-query/src/types.ts
git commit -m "feat(jsonb-query): add phase-2 condition types (object, array, elemmatch)"
```

---

### Task 3: Shared SQL helpers + `isFilterGroup` in dialect.ts

Pure refactor + two new helpers. Existing specs must stay byte-identical.

**Files:**
- Modify: `src/dialect.ts`, `src/dialect-legacy.ts`, `src/dialect-jsonpath.ts`, `src/build.ts`
- Test: Create `src/dialect.spec.ts`

- [ ] **Step 1: Write failing tests for the new helpers** — create `src/dialect.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderNullCheck, renderJsonbContains, isFilterGroup } from './dialect';
import { ParamBuilder } from './param-builder';

describe('renderNullCheck', () => {
  it('renders is null / is not null with a parameterized path', () => {
    const p1 = new ParamBuilder();
    expect(renderNullCheck('"data"', 'a.b', 'isnull', p1)).toBe('(("data" #>> $1) is null)');
    expect(p1.values).toEqual([['a', 'b']]);

    const p2 = new ParamBuilder();
    expect(renderNullCheck('"data"', 'x', 'isnotnull', p2)).toBe('(("data" #>> $1) is not null)');
    expect(p2.values).toEqual([['x']]);
  });
});

describe('renderJsonbContains', () => {
  it('JSON-stringifies the value (node-postgres array-literal gotcha)', () => {
    const p = new ParamBuilder();
    expect(renderJsonbContains('"data"', 'tags', ['a', 'b'], p)).toBe(
      '(("data" #> $1) @> $2::jsonb)',
    );
    expect(p.values).toEqual([['tags'], '["a","b"]']);
  });
});

describe('isFilterGroup', () => {
  it('discriminates groups from conditions', () => {
    expect(isFilterGroup({ logic: 'and', filters: [] })).toBe(true);
    expect(
      isFilterGroup({ field: 'a', dataType: 'string', operator: 'eq', value: 'x' }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: FAIL — `renderNullCheck` / `renderJsonbContains` / `isFilterGroup` are not exported from `./dialect`.

- [ ] **Step 3: Add to `src/dialect.ts`** (below `fieldSegments`; also widen the `operator` param of `assertScalarValue` / `assertArrayValue` from `JsonbScalarOperator` to `string` so non-scalar operators like `containsall` can reuse them — message-only usage):

```typescript
import type { JsonbCondition, JsonbFilterGroup } from './types'; // extend existing type imports

export function isFilterGroup(
  node: JsonbCondition | JsonbFilterGroup,
): node is JsonbFilterGroup {
  return 'logic' in node && 'filters' in node;
}

/** `field IS [NOT] NULL` via `#>>`: SQL null for both missing keys and JSON null. */
export function renderNullCheck(
  column: string,
  field: string,
  operator: 'isnull' | 'isnotnull',
  params: ParamBuilder,
): string {
  const F = `(${column} #>> ${params.add(fieldSegments(field))})`;
  return operator === 'isnull' ? `(${F} is null)` : `(${F} is not null)`;
}

/**
 * JSONB containment (`@>`). `JSON.stringify` is required: node-postgres encodes
 * raw JS arrays as Postgres array literals ('{a,b}'), which are not valid jsonb.
 */
export function renderJsonbContains(
  column: string,
  field: string,
  value: unknown,
  params: ParamBuilder,
): string {
  const fParam = params.add(fieldSegments(field));
  return `((${column} #> ${fParam}) @> ${params.add(JSON.stringify(value))}::jsonb)`;
}
```

(`ParamBuilder` must become a value import: `import { ParamBuilder } from './param-builder';` → keep as `import type` if only used in signatures — it is, so keep `import type`.)

- [ ] **Step 4: Refactor the three call sites to the shared helpers**

In `src/dialect-legacy.ts` — replace the `isnull`/`isnotnull` switch cases with an early return before computing `F` (add `renderNullCheck` to the `./dialect` import):

```typescript
render(column, field, dataType, operator, value, params) {
  if (operator === 'isnull' || operator === 'isnotnull') {
    return renderNullCheck(column, field, operator, params);
  }
  const fParam = params.add(fieldSegments(field));
  const F = `(${column} #>> ${fParam})`;
  const Fc = `${F}${CASTS[dataType]}`;
  switch (operator) {
    // 'isnull'/'isnotnull' cases deleted; everything else unchanged
```

In `src/dialect-jsonpath.ts` — replace the inline fallback:

```typescript
if (operator === 'isnull' || operator === 'isnotnull') {
  return renderNullCheck(column, field, operator, params);
}
```

In `src/build.ts` — delete the local `isGroup` function and import/use `isFilterGroup` from `./dialect` instead.

- [ ] **Step 5: Verify everything is green (byte-identical SQL proven by existing specs)**

Run: `pnpm -F @rfjs/jsonb-query vitest:run && pnpm -F @rfjs/jsonb-query typecheck`
Expected: `Tests 48 passed` (45 + 3 new), tsc clean.

- [ ] **Step 6: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "refactor(jsonb-query): extract shared null-check, containment and group-guard helpers"
```

---

### Task 4: Scope-aware condition validation (`assertCondition`)

**Files:**
- Modify: `src/dialect.ts`
- Test: `src/dialect.spec.ts` (append)

- [ ] **Step 1: Write failing tests** — append to `src/dialect.spec.ts`:

```typescript
import { assertCondition, assertObjectValue } from './dialect';
import type { JsonbCondition } from './types';

describe('assertObjectValue', () => {
  it('accepts a plain object', () => {
    expect(assertObjectValue('eq', { a: 1 })).toEqual({ a: 1 });
  });
  it.each([null, undefined, [1], new Date(), 'x', 1])('rejects %p', (bad) => {
    expect(() => assertObjectValue('eq', bad)).toThrow(/requires a plain object value/i);
  });
});

describe('assertCondition', () => {
  const c = (node: unknown) => () => assertCondition(node as JsonbCondition, 'root');
  const e = (node: unknown) => () => assertCondition(node as JsonbCondition, 'elemmatch');

  it('delegates scalar validation unchanged', () => {
    expect(c({ field: 'x', dataType: 'boolean', operator: 'gt' })).toThrow(
      /unsupported operator "gt" for type "boolean"/i,
    );
    expect(c({ field: 'x', dataType: 'string', operator: 'eq', value: 'a' })).not.toThrow();
  });

  it('validates object operators', () => {
    expect(c({ field: 'p', dataType: 'object', operator: 'eq', value: {} })).not.toThrow();
    expect(c({ field: 'p', dataType: 'object', operator: 'gt', value: {} })).toThrow(
      /unsupported operator "gt" for type "object"/i,
    );
  });

  it('validates array element operators per elementType', () => {
    const arr = (elementType: string, operator: string) =>
      c({ field: 'a', dataType: 'array', elementType, operator, value: 1 });
    expect(arr('numeric', 'gt')).not.toThrow();
    expect(arr('string', 'gt')).toThrow(/for array elements of type "string"/i);
    expect(arr('numeric', 'startswith')).toThrow(/for array elements of type "numeric"/i);
    expect(arr('string', 'neq')).toThrow(/unsupported operator "neq" for array elements/i);
    expect(arr('boolean', 'terms')).toThrow(/for array elements of type "boolean"/i);
    expect(arr('date', 'containsall')).toThrow(/for array elements of type "date"/i);
    expect(arr('bogus', 'eq')).toThrow(/unsupported elementtype "bogus"/i);
  });

  it('requires elemmatch (with a non-empty group) for arrays of objects', () => {
    const ok = {
      field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
      filters: { logic: 'and', filters: [{ field: 's', dataType: 'string', operator: 'eq', value: 'x' }] },
    };
    expect(c(ok)).not.toThrow();
    expect(c({ ...ok, operator: 'eq' })).toThrow(/use "elemmatch"/i);
    expect(c({ ...ok, filters: { logic: 'and', filters: [] } })).toThrow(
      /requires a filter group with at least one condition/i,
    );
    expect(c({ ...ok, filters: undefined })).toThrow(/requires a filter group/i);
  });

  it('rejects object and scalar-array conditions inside elemmatch', () => {
    expect(e({ field: 'p', dataType: 'object', operator: 'eq', value: {} })).toThrow(
      /object conditions are not supported inside elemmatch/i,
    );
    expect(
      e({ field: 'a', dataType: 'array', elementType: 'string', operator: 'eq', value: 'x' }),
    ).toThrow(/array conditions with scalar elements are not supported inside elemmatch/i);
    // scalar + nested elemmatch ARE allowed inside elemmatch
    expect(e({ field: 's', dataType: 'string', operator: 'eq', value: 'x' })).not.toThrow();
    expect(
      e({
        field: 'sub', dataType: 'array', elementType: 'object', operator: 'elemmatch',
        filters: { logic: 'and', filters: [{ field: 's', dataType: 'string', operator: 'eq', value: 'x' }] },
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: FAIL — `assertCondition` / `assertObjectValue` not exported.

- [ ] **Step 3: Implement in `src/dialect.ts`** (extend type imports with `JsonbObjectOperator`, `JsonbObjectValue`):

```typescript
export function assertObjectValue(operator: string, value: unknown): JsonbObjectValue {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    value instanceof Date
  ) {
    throw new Error(`Operator "${operator}" requires a plain object value`);
  }
  return value as JsonbObjectValue;
}

const OBJECT_OPERATORS: ReadonlySet<JsonbObjectOperator> = new Set([
  'eq', 'neq', 'contains', 'isnull', 'isnotnull',
]);

const ARRAY_OPERATORS_BY_ELEMENT: Record<JsonbScalarType, ReadonlySet<string>> = {
  string: new Set(['eq', 'contains', 'startswith', 'endswith', 'terms', 'containsall', 'isnull', 'isnotnull']),
  numeric: new Set(['eq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'containsall', 'isnull', 'isnotnull']),
  date: new Set(['eq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'isnull', 'isnotnull']),
  boolean: new Set(['eq', 'isnull', 'isnotnull']),
};

export type ConditionScope = 'root' | 'elemmatch';

export function assertCondition(node: JsonbCondition, scope: ConditionScope): void {
  if (node.dataType === 'object') {
    if (scope === 'elemmatch') {
      throw new Error('Object conditions are not supported inside elemmatch');
    }
    if (!OBJECT_OPERATORS.has(node.operator)) {
      throw new Error(`Unsupported operator "${node.operator as string}" for type "object"`);
    }
    return;
  }
  if (node.dataType === 'array') {
    if (node.elementType === 'object') {
      if ((node.operator as string) !== 'elemmatch') {
        throw new Error(
          `Unsupported operator "${node.operator as string}" for array of objects (use "elemmatch")`,
        );
      }
      if (!node.filters || !Array.isArray(node.filters.filters) || node.filters.filters.length === 0) {
        throw new Error('Operator "elemmatch" requires a filter group with at least one condition');
      }
      return;
    }
    if (scope === 'elemmatch') {
      throw new Error('Array conditions with scalar elements are not supported inside elemmatch');
    }
    const ops = ARRAY_OPERATORS_BY_ELEMENT[node.elementType];
    if (!ops) {
      throw new Error(
        `Unsupported elementType ${JSON.stringify(node.elementType)} for array condition`,
      );
    }
    if (!ops.has(node.operator)) {
      throw new Error(
        `Unsupported operator "${node.operator as string}" for array elements of type "${node.elementType}"`,
      );
    }
    return;
  }
  assertOperatorForType(node.dataType, node.operator);
}
```

- [ ] **Step 4: Verify green**

Run: `pnpm -F @rfjs/jsonb-query vitest:run && pnpm -F @rfjs/jsonb-query typecheck`
Expected: all pass (48 + new validation tests), tsc clean.

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/dialect.ts packages/jsonb-query/src/dialect.spec.ts
git commit -m "feat(jsonb-query): add scope-aware condition validation for phase-2 types"
```

---

### Task 5: Dialect interface + RenderContext

Type-level change preparing both dialects; implement stub methods that throw, so existing behavior is untouched.

**Files:**
- Modify: `src/dialect.ts` (interface), `src/dialect-legacy.ts`, `src/dialect-jsonpath.ts`, `src/build.ts` (rename only)

- [ ] **Step 1: In `src/dialect.ts`, rename `ScalarDialect` → `JsonbQueryDialect` and extend** (extend type imports with `JsonbArrayCondition`, `JsonbElemMatchCondition`):

```typescript
export interface RenderContext {
  params: ParamBuilder;
  /** Allocate a unique table alias (e1, e2, …) for EXISTS subqueries. */
  nextAlias(): string;
  /** Render a nested filter group against an element expression (elemmatch scope). */
  renderGroup(group: JsonbFilterGroup, column: string): string;
}

export interface JsonbQueryDialect {
  /**
   * Render one scalar condition into a SQL boolean expression, pushing any
   * parameter values onto `params`.
   * @param column already-quoted column SQL, e.g. `"data"`
   * @param field  raw dot path, e.g. "address.city"
   */
  render(
    column: string,
    field: string,
    dataType: JsonbScalarType,
    operator: JsonbScalarOperator,
    value: JsonbValue | JsonbValue[] | undefined,
    params: ParamBuilder,
  ): string;
  /** Render a scalar-element array condition (∃ semantics / containsall / null checks). */
  renderArray(column: string, condition: JsonbArrayCondition, ctx: RenderContext): string;
  /** Render an array-of-objects condition (all sub-conditions on the same element). */
  renderElemMatch(column: string, condition: JsonbElemMatchCondition, ctx: RenderContext): string;
}
```

- [ ] **Step 2: Update both dialects and build.ts**

In `src/dialect-legacy.ts` and `src/dialect-jsonpath.ts`: change the type annotation to `JsonbQueryDialect` and add temporary stubs (replaced in Tasks 7–11):

```typescript
renderArray() {
  throw new Error('Not implemented');
},
renderElemMatch() {
  throw new Error('Not implemented');
},
```

In `src/build.ts`: update the import/type reference (`ScalarDialect` → `JsonbQueryDialect`).

- [ ] **Step 3: Verify green**

Run: `pnpm -F @rfjs/jsonb-query vitest:run && pnpm -F @rfjs/jsonb-query typecheck`
Expected: all pass, tsc clean.

- [ ] **Step 4: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "refactor(jsonb-query): widen dialect interface with renderArray/renderElemMatch"
```

---

### Task 6: Shared object-condition renderer

**Files:**
- Create: `src/object-condition.ts`
- Test: Create `src/object-condition.spec.ts`

- [ ] **Step 1: Write failing tests** — create `src/object-condition.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderObjectCondition } from './object-condition';
import { ParamBuilder } from './param-builder';
import type { JsonbObjectCondition } from './types';

function run(cond: Omit<JsonbObjectCondition, 'dataType'>) {
  const p = new ParamBuilder();
  const where = renderObjectCondition('"data"', { ...cond, dataType: 'object' }, p);
  return { where, values: p.values };
}

describe('renderObjectCondition', () => {
  it('eq compares via #> against a jsonb param (structural equality)', () => {
    expect(run({ field: 'profile', operator: 'eq', value: { vip: true } })).toEqual({
      where: '(("data" #> $1) = $2::jsonb)',
      values: [['profile'], '{"vip":true}'],
    });
  });

  it('neq uses <>', () => {
    expect(run({ field: 'profile', operator: 'neq', value: { vip: true } })).toEqual({
      where: '(("data" #> $1) <> $2::jsonb)',
      values: [['profile'], '{"vip":true}'],
    });
  });

  it('contains uses @> and supports dot paths', () => {
    expect(run({ field: 'meta.flags', operator: 'contains', value: { beta: true } })).toEqual({
      where: '(("data" #> $1) @> $2::jsonb)',
      values: [['meta', 'flags'], '{"beta":true}'],
    });
  });

  it('isnull / isnotnull use the shared #>> null check', () => {
    expect(run({ field: 'profile', operator: 'isnull' })).toEqual({
      where: '(("data" #>> $1) is null)',
      values: [['profile']],
    });
    expect(run({ field: 'profile', operator: 'isnotnull' })).toEqual({
      where: '(("data" #>> $1) is not null)',
      values: [['profile']],
    });
  });

  it('rejects non-object values', () => {
    expect(() => run({ field: 'p', operator: 'eq', value: [1] as never })).toThrow(
      /requires a plain object value/i,
    );
  });

  it('keeps hostile values in params, never in SQL', () => {
    const { where, values } = run({
      field: 'p', operator: 'eq', value: { name: "x'; DROP TABLE t; --" },
    });
    expect(where).toBe('(("data" #> $1) = $2::jsonb)');
    expect(values[1]).toBe('{"name":"x\'; DROP TABLE t; --"}');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: FAIL — cannot resolve `./object-condition`.

- [ ] **Step 3: Create `src/object-condition.ts`**

```typescript
import type { JsonbObjectCondition } from './types';
import type { ParamBuilder } from './param-builder';
import {
  fieldSegments,
  assertObjectValue,
  renderNullCheck,
  renderJsonbContains,
} from './dialect';

/**
 * Object conditions render the same SQL in both dialects: SQL/JSON path
 * predicates cannot compare or contain non-scalar values, so the jsonpath
 * dialect falls back to `#>` / `@>` (both GIN-indexable). jsonb `=` is
 * structural equality (key order and whitespace insensitive).
 */
export function renderObjectCondition(
  column: string,
  condition: JsonbObjectCondition,
  params: ParamBuilder,
): string {
  const { field, operator, value } = condition;
  switch (operator) {
    case 'isnull':
    case 'isnotnull':
      return renderNullCheck(column, field, operator, params);
    case 'contains':
      return renderJsonbContains(column, field, assertObjectValue(operator, value), params);
    case 'eq':
    case 'neq': {
      const obj = assertObjectValue(operator, value);
      const F = `(${column} #> ${params.add(fieldSegments(field))})`;
      return `(${F} ${operator === 'eq' ? '=' : '<>'} ${params.add(JSON.stringify(obj))}::jsonb)`;
    }
    default:
      throw new Error(`Unsupported operator "${operator as string}" for type "object"`);
  }
}
```

- [ ] **Step 4: Verify green**

Run: `pnpm -F @rfjs/jsonb-query vitest:run && pnpm -F @rfjs/jsonb-query typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/object-condition.ts packages/jsonb-query/src/object-condition.spec.ts
git commit -m "feat(jsonb-query): render object conditions (eq/neq/contains/null checks)"
```

---

### Task 7: Legacy — extract `renderScalarOp` (pure refactor)

**Files:**
- Modify: `src/dialect-legacy.ts`

- [ ] **Step 1: Refactor** — move the operator switch into a module-level function taking the text expression `F` (the null-check early return from Task 3 stays in `render`):

```typescript
import type { JsonbScalarType, JsonbScalarOperator, JsonbValue } from './types';
import {
  type JsonbQueryDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
  renderNullCheck,
} from './dialect';
import type { ParamBuilder } from './param-builder';

const CASTS: Record<JsonbScalarType, string> = {
  string: '',
  numeric: '::numeric',
  date: '::timestamptz',
  boolean: '::boolean',
};

const ARRAY_CASTS: Record<JsonbScalarType, string> = {
  string: '::text[]',
  numeric: '::numeric[]',
  date: '::timestamptz[]',
  boolean: '::boolean[]',
};

/** Render a scalar operator against `F`, a text-valued SQL expression. */
function renderScalarOp(
  F: string,
  dataType: JsonbScalarType,
  operator: JsonbScalarOperator,
  value: JsonbValue | JsonbValue[] | undefined,
  params: ParamBuilder,
): string {
  const Fc = `${F}${CASTS[dataType]}`;
  switch (operator) {
    case 'eq':
      return `(${Fc} = ${params.add(assertScalarValue(operator, value))})`;
    case 'neq':
      return `(${Fc} <> ${params.add(assertScalarValue(operator, value))})`;
    case 'gt':
      return `(${Fc} > ${params.add(assertScalarValue(operator, value))})`;
    case 'gte':
      return `(${Fc} >= ${params.add(assertScalarValue(operator, value))})`;
    case 'lt':
      return `(${Fc} < ${params.add(assertScalarValue(operator, value))})`;
    case 'lte':
      return `(${Fc} <= ${params.add(assertScalarValue(operator, value))})`;
    case 'range': {
      const [lo, hi] = assertArrayValue(operator, value, 2);
      return `(${Fc} between ${params.add(lo)} and ${params.add(hi)})`;
    }
    case 'terms':
      return `(${Fc} = ANY(${params.add(assertArrayValue(operator, value))}${ARRAY_CASTS[dataType]}))`;
    case 'contains':
      return `(position(${params.add(assertScalarValue(operator, value))} in ${F}) > 0)`;
    case 'startswith': {
      const v = params.add(assertScalarValue(operator, value));
      return `(left(${F}, char_length(${v})) = ${v})`;
    }
    case 'endswith': {
      const v = params.add(assertScalarValue(operator, value));
      return `(right(${F}, char_length(${v})) = ${v})`;
    }
    default:
      throw new Error(`Unsupported operator "${operator as string}"`);
  }
}

export const legacyDialect: JsonbQueryDialect = {
  render(column, field, dataType, operator, value, params) {
    if (operator === 'isnull' || operator === 'isnotnull') {
      return renderNullCheck(column, field, operator, params);
    }
    const F = `(${column} #>> ${params.add(fieldSegments(field))})`;
    return renderScalarOp(F, dataType, operator, value, params);
  },
  // renderArray / renderElemMatch stubs unchanged for now
};
```

- [ ] **Step 2: Verify byte-identical behavior via existing specs**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: all pass, no expectation changes.

- [ ] **Step 3: Commit**

```bash
git add packages/jsonb-query/src/dialect-legacy.ts
git commit -m "refactor(jsonb-query): extract renderScalarOp for reuse on array elements"
```

---### Task 8: Legacy — `renderArray`

**Files:**
- Modify: `src/dialect-legacy.ts`
- Test: `src/dialect-legacy.spec.ts` (append)

- [ ] **Step 1: Write failing tests** — append to `src/dialect-legacy.spec.ts` (add imports for `RenderContext`, `JsonbArrayCondition` types):

```typescript
import type { RenderContext } from './dialect';
import type { JsonbArrayCondition } from './types';

function makeCtx(
  p: ParamBuilder,
  renderGroup: RenderContext['renderGroup'] = () => {
    throw new Error('renderGroup not stubbed');
  },
): RenderContext {
  let n = 0;
  return {
    params: p,
    nextAlias: () => {
      n += 1;
      return `e${n}`;
    },
    renderGroup,
  };
}

const GUARD = (col: string, ph: string) =>
  `case when jsonb_typeof(${col} #> ${ph}) = 'array' then ${col} #> ${ph} else '[]'::jsonb end`;

describe('legacyDialect.renderArray', () => {
  function runArray(cond: Omit<JsonbArrayCondition, 'dataType'>) {
    const p = new ParamBuilder();
    const ctx = makeCtx(p);
    const where = legacyDialect.renderArray('"data"', { ...cond, dataType: 'array' }, ctx);
    return { where, values: p.values, ctx };
  }

  it('element eq uses EXISTS over jsonb_array_elements_text with a typeof guard', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'eq', value: 'a' })).toMatchObject({
      where: `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$1')}) as e1(v) where (e1.v = $2)))`,
      values: [['tags'], 'a'],
    });
  });

  it('element gt casts the element', () => {
    expect(runArray({ field: 'nums', elementType: 'numeric', operator: 'gt', value: 5 }).where).toBe(
      `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$1')}) as e1(v) where (e1.v::numeric > $2)))`,
    );
  });

  it('element range / terms / string ops reuse the scalar operator rendering', () => {
    expect(runArray({ field: 'nums', elementType: 'numeric', operator: 'range', value: [1, 9] }).where).toContain(
      '(e1.v::numeric between $2 and $3)',
    );
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'terms', value: ['a', 'b'] }).where).toContain(
      '(e1.v = ANY($2::text[]))',
    );
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'startswith', value: 'x' }).where).toContain(
      '(left(e1.v, char_length($2)) = $2)',
    );
    expect(runArray({ field: 'dates', elementType: 'date', operator: 'gt', value: '2020-01-01' }).where).toContain(
      '(e1.v::timestamptz > $2)',
    );
  });

  it('containsall maps to @> with a JSON-stringified param', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'containsall', value: ['a', 'b'] })).toMatchObject({
      where: '(("data" #> $1) @> $2::jsonb)',
      values: [['tags'], '["a","b"]'],
    });
  });

  it('isnull / isnotnull test the array field itself', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'isnull' })).toMatchObject({
      where: '(("data" #>> $1) is null)',
      values: [['tags']],
    });
  });

  it('allocates unique aliases across calls sharing a context', () => {
    const p = new ParamBuilder();
    const ctx = makeCtx(p);
    const a = legacyDialect.renderArray('"data"', { field: 'x', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }, ctx);
    const b = legacyDialect.renderArray('"data"', { field: 'y', dataType: 'array', elementType: 'string', operator: 'eq', value: 'b' }, ctx);
    expect(a).toContain('as e1(v)');
    expect(b).toContain('as e2(v)');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: FAIL — `Not implemented` from the Task 5 stub.

- [ ] **Step 3: Implement `renderArray` in `src/dialect-legacy.ts`** (replace the stub; add `renderJsonbContains` to the `./dialect` import):

```typescript
renderArray(column, condition, ctx) {
  const { params } = ctx;
  const { field, elementType, operator, value } = condition;
  if (operator === 'isnull' || operator === 'isnotnull') {
    return renderNullCheck(column, field, operator, params);
  }
  if (operator === 'containsall') {
    return renderJsonbContains(column, field, assertArrayValue(operator, value), params);
  }
  const fParam = params.add(fieldSegments(field));
  const guarded = `case when jsonb_typeof(${column} #> ${fParam}) = 'array' then ${column} #> ${fParam} else '[]'::jsonb end`;
  const alias = ctx.nextAlias();
  const predicate = renderScalarOp(`${alias}.v`, elementType, operator, value, params);
  return `(exists (select 1 from jsonb_array_elements_text(${guarded}) as ${alias}(v) where ${predicate}))`;
},
```

- [ ] **Step 4: Verify green**

Run: `pnpm -F @rfjs/jsonb-query vitest:run && pnpm -F @rfjs/jsonb-query typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/dialect-legacy.ts packages/jsonb-query/src/dialect-legacy.spec.ts
git commit -m "feat(jsonb-query): legacy scalar-array conditions via guarded EXISTS"
```

---

### Task 9: Legacy — `renderElemMatch`

**Files:**
- Modify: `src/dialect-legacy.ts`
- Test: `src/dialect-legacy.spec.ts` (append)

- [ ] **Step 1: Write failing tests** — append inside the spec file (reuses `makeCtx`/`GUARD` from Task 8):

```typescript
describe('legacyDialect.renderElemMatch', () => {
  const cond = {
    field: 'items',
    dataType: 'array',
    elementType: 'object',
    operator: 'elemmatch',
    filters: { logic: 'and', filters: [{ field: 'sku', dataType: 'string', operator: 'eq', value: 'x' }] },
  } as const;

  it('wraps the sub-group in EXISTS over jsonb_array_elements, rendered against the alias', () => {
    const p = new ParamBuilder();
    const seen: string[] = [];
    const ctx = makeCtx(p, (_group, col) => {
      seen.push(col);
      return `<<sub:${col}>>`;
    });
    const where = legacyDialect.renderElemMatch('"data"', cond, ctx);
    expect(where).toBe(
      `(exists (select 1 from jsonb_array_elements(${GUARD('"data"', '$1')}) as e1 where <<sub:e1.value>>))`,
    );
    expect(seen).toEqual(['e1.value']);
    expect(p.values).toEqual([['items']]);
  });

  it('throws when the sub-group renders empty', () => {
    const p = new ParamBuilder();
    const ctx = makeCtx(p, () => '');
    expect(() => legacyDialect.renderElemMatch('"data"', cond, ctx)).toThrow(
      /requires a filter group with at least one condition/i,
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: FAIL — `Not implemented`.

- [ ] **Step 3: Implement `renderElemMatch` in `src/dialect-legacy.ts`** (replace the stub):

```typescript
renderElemMatch(column, condition, ctx) {
  const fParam = ctx.params.add(fieldSegments(condition.field));
  const guarded = `case when jsonb_typeof(${column} #> ${fParam}) = 'array' then ${column} #> ${fParam} else '[]'::jsonb end`;
  const alias = ctx.nextAlias();
  const sub = ctx.renderGroup(condition.filters, `${alias}.value`);
  if (sub.length === 0) {
    throw new Error('Operator "elemmatch" requires a filter group with at least one condition');
  }
  return `(exists (select 1 from jsonb_array_elements(${guarded}) as ${alias} where ${sub}))`;
},
```

- [ ] **Step 4: Verify green**

Run: `pnpm -F @rfjs/jsonb-query vitest:run && pnpm -F @rfjs/jsonb-query typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/dialect-legacy.ts packages/jsonb-query/src/dialect-legacy.spec.ts
git commit -m "feat(jsonb-query): legacy elemmatch via EXISTS over jsonb_array_elements"
```

---

### Task 10: jsonpath — refactor to `memberAccessor` + `VarSink` + `scalarPredicate` (pure refactor)

Phase 1 jsonpath output must stay **byte-identical** — the existing spec is the proof.

**Files:**
- Modify: `src/dialect-jsonpath.ts`

- [ ] **Step 1: Refactor** — replace the body of `src/dialect-jsonpath.ts` with:

```typescript
import type { JsonbScalarType, JsonbScalarOperator, JsonbValue } from './types';
import {
  type JsonbQueryDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
  renderNullCheck,
} from './dialect';
import type { ParamBuilder } from './param-builder';
import { escapeJsonpathString, escapeRegexLiteral } from './escape';

/** `$."a"."b"` / `@."a"."b"` accessor for a dot path, members escaped. */
function memberAccessor(root: '$' | '@', field: string): string {
  return (
    root +
    fieldSegments(field)
      .map((seg) => `."${escapeJsonpathString(seg)}"`)
      .join('')
  );
}

const COMPARATORS: Partial<Record<JsonbScalarOperator, string>> = {
  eq: '==',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

/** Allocates jsonpath variable names and collects their values. */
interface VarSink {
  vars: Record<string, JsonbValue>;
  one(value: JsonbValue): string;
  pair(lo: JsonbValue, hi: JsonbValue): [string, string];
  many(values: JsonbValue[]): string[];
}

/** Phase-1 naming for single-condition paths: $v, $lo/$hi, $v0… */
function namedSink(): VarSink {
  const vars: Record<string, JsonbValue> = {};
  return {
    vars,
    one(value) {
      vars.v = value;
      return 'v';
    },
    pair(lo, hi) {
      vars.lo = lo;
      vars.hi = hi;
      return ['lo', 'hi'];
    },
    many(values) {
      return values.map((v, i) => {
        vars[`v${i}`] = v;
        return `v${i}`;
      });
    },
  };
}

interface Predicate {
  pred: string;
  /** true when the predicate contains a top-level && / || and needs parens when embedded */
  compound: boolean;
}

function scalarPredicate(
  acc: string,
  dataType: JsonbScalarType,
  operator: JsonbScalarOperator,
  value: JsonbValue | JsonbValue[] | undefined,
  sink: VarSink,
): Predicate {
  const lhs = dataType === 'date' ? `${acc}.datetime()` : acc;
  const rhs = (name: string) => (dataType === 'date' ? `$${name}.datetime()` : `$${name}`);

  const comparator = COMPARATORS[operator];
  if (comparator) {
    const name = sink.one(assertScalarValue(operator, value));
    return { pred: `${lhs} ${comparator} ${rhs(name)}`, compound: false };
  }

  switch (operator) {
    case 'range': {
      const [lo, hi] = assertArrayValue(operator, value, 2);
      const [a, b] = sink.pair(lo, hi);
      return { pred: `${lhs} >= ${rhs(a)} && ${lhs} <= ${rhs(b)}`, compound: true };
    }
    case 'terms': {
      const items = assertArrayValue(operator, value);
      const names = sink.many(items);
      return {
        pred: names.map((name) => `${lhs} == ${rhs(name)}`).join(' || '),
        compound: items.length > 1,
      };
    }
    // startswith/contains/endswith are string predicates: they operate on the
    // text form (`acc`), never `.datetime()`.
    case 'startswith': {
      const name = sink.one(assertScalarValue(operator, value));
      return { pred: `${acc} starts with $${name}`, compound: false };
    }
    case 'contains': {
      const raw = String(assertScalarValue(operator, value));
      const lit = escapeJsonpathString(escapeRegexLiteral(raw));
      return { pred: `${acc} like_regex "${lit}"`, compound: false };
    }
    case 'endswith': {
      const raw = String(assertScalarValue(operator, value));
      const lit = escapeJsonpathString(escapeRegexLiteral(raw) + '$');
      return { pred: `${acc} like_regex "${lit}"`, compound: false };
    }
    // isnull/isnotnull only reach here inside elemmatch (root conditions use
    // the SQL fallback). Covers both a missing member and a JSON null, matching
    // legacy `#>>` semantics.
    case 'isnull':
      return { pred: `!exists (${acc}) || ${acc} == null`, compound: true };
    case 'isnotnull':
      return { pred: `exists (${acc}) && ${acc} != null`, compound: true };
    default:
      throw new Error(`Unsupported operator "${operator as string}"`);
  }
}

/** Emit jsonb_path_exists; omits the vars argument when no variables were used. */
function pathExists(
  column: string,
  path: string,
  vars: Record<string, JsonbValue>,
  params: ParamBuilder,
): string {
  const pParam = params.add(path);
  if (Object.keys(vars).length === 0) {
    return `jsonb_path_exists(${column}, ${pParam}::jsonpath)`;
  }
  return `jsonb_path_exists(${column}, ${pParam}::jsonpath, ${params.add(vars)}::jsonb)`;
}

export const jsonpathDialect: JsonbQueryDialect = {
  render(column, field, dataType, operator, value, params) {
    // isnull/isnotnull are dialect-independent.
    if (operator === 'isnull' || operator === 'isnotnull') {
      return renderNullCheck(column, field, operator, params);
    }
    const sink = namedSink();
    const { pred } = scalarPredicate('@', dataType, operator, value, sink);
    return pathExists(column, `${memberAccessor('$', field)} ? (${pred})`, sink.vars, params);
  },
  renderArray() {
    throw new Error('Not implemented');
  },
  renderElemMatch() {
    throw new Error('Not implemented');
  },
};
```

- [ ] **Step 2: Verify byte-identical output via existing specs**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: all pass with zero expectation changes (this is the whole point of the task).

- [ ] **Step 3: Commit**

```bash
git add packages/jsonb-query/src/dialect-jsonpath.ts
git commit -m "refactor(jsonb-query): extract jsonpath predicate builder and var sinks"
```

---

### Task 11: jsonpath — `renderArray`

**Files:**
- Modify: `src/dialect-jsonpath.ts`
- Test: `src/dialect-jsonpath.spec.ts` (append)

- [ ] **Step 1: Write failing tests** — append to `src/dialect-jsonpath.spec.ts`:

```typescript
import type { RenderContext } from './dialect';
import type { JsonbArrayCondition } from './types';

function makeCtx(p: ParamBuilder): RenderContext {
  let n = 0;
  return {
    params: p,
    nextAlias: () => {
      n += 1;
      return `e${n}`;
    },
    renderGroup: () => {
      throw new Error('renderGroup not used by jsonpath dialect');
    },
  };
}

describe('jsonpathDialect.renderArray', () => {
  function runArray(cond: Omit<JsonbArrayCondition, 'dataType'>) {
    const p = new ParamBuilder();
    const where = jsonpathDialect.renderArray('"data"', { ...cond, dataType: 'array' }, makeCtx(p));
    return { where, values: p.values };
  }

  it('element eq filters over [*] with phase-1 var naming', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'eq', value: 'a' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."tags"[*] ? (@ == $v)', { v: 'a' }],
    });
  });

  it('element range / terms / date / contains', () => {
    expect(runArray({ field: 'nums', elementType: 'numeric', operator: 'range', value: [1, 9] }).values[0]).toBe(
      '$."nums"[*] ? (@ >= $lo && @ <= $hi)',
    );
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'terms', value: ['a', 'b'] }).values[0]).toBe(
      '$."tags"[*] ? (@ == $v0 || @ == $v1)',
    );
    expect(runArray({ field: 'dates', elementType: 'date', operator: 'eq', value: '2020-01-01' }).values[0]).toBe(
      '$."dates"[*] ? (@.datetime() == $v.datetime())',
    );
    // contains embeds an escaped regex literal and emits the 2-arg form
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'contains', value: 'a.b' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath)',
      values: ['$."tags"[*] ? (@ like_regex "a\\\\.b")'],
    });
  });

  it('containsall falls back to @> (identical to legacy)', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'containsall', value: ['a', 'b'] })).toEqual({
      where: '(("data" #> $1) @> $2::jsonb)',
      values: [['tags'], '["a","b"]'],
    });
  });

  it('isnull / isnotnull use the dialect-independent null check', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'isnull' })).toEqual({
      where: '(("data" #>> $1) is null)',
      values: [['tags']],
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: FAIL — `Not implemented`.

- [ ] **Step 3: Implement `renderArray`** (replace the stub; add `renderJsonbContains` to the `./dialect` import):

```typescript
renderArray(column, condition, ctx) {
  const { params } = ctx;
  const { field, elementType, operator, value } = condition;
  if (operator === 'isnull' || operator === 'isnotnull') {
    return renderNullCheck(column, field, operator, params);
  }
  if (operator === 'containsall') {
    return renderJsonbContains(column, field, assertArrayValue(operator, value), params);
  }
  const sink = namedSink();
  const { pred } = scalarPredicate('@', elementType, operator, value, sink);
  return pathExists(column, `${memberAccessor('$', field)}[*] ? (${pred})`, sink.vars, params);
},
```

- [ ] **Step 4: Verify green**

Run: `pnpm -F @rfjs/jsonb-query vitest:run && pnpm -F @rfjs/jsonb-query typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/dialect-jsonpath.ts packages/jsonb-query/src/dialect-jsonpath.spec.ts
git commit -m "feat(jsonb-query): jsonpath scalar-array conditions via [*] filters"
```

---

### Task 12: jsonpath — `renderElemMatch` (group → predicate walker)

**Files:**
- Modify: `src/dialect-jsonpath.ts`
- Test: `src/dialect-jsonpath.spec.ts` (append)

- [ ] **Step 1: Write failing tests** — append (reuses `makeCtx`; add `JsonbElemMatchCondition`, `JsonbFilterGroup` to type imports):

```typescript
import type { JsonbElemMatchCondition, JsonbFilterGroup } from './types';

describe('jsonpathDialect.renderElemMatch', () => {
  function runElem(field: string, filters: JsonbFilterGroup) {
    const p = new ParamBuilder();
    const cond: JsonbElemMatchCondition = {
      field, dataType: 'array', elementType: 'object', operator: 'elemmatch', filters,
    };
    const where = jsonpathDialect.renderElemMatch('"data"', cond, makeCtx(p));
    return { where, values: p.values };
  }

  it('merges all sub-conditions into one path with sequential vars', () => {
    expect(
      runElem('items', {
        logic: 'and',
        filters: [
          { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
          { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
        ],
      }),
    ).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."items"[*] ? (@."sku" == $v0 && @."qty" > $v1)', { v0: 'x', v1: 1 }],
    });
  });

  it('wraps nested or-groups and compound predicates in parens', () => {
    expect(
      runElem('items', {
        logic: 'and',
        filters: [
          { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
          {
            logic: 'or',
            filters: [
              { field: 'qty', dataType: 'numeric', operator: 'range', value: [1, 9] },
              { field: 'tag', dataType: 'string', operator: 'terms', value: ['a', 'b'] },
            ],
          },
        ],
      }).values[0],
    ).toBe(
      '$."items"[*] ? (@."sku" == $v0 && ((@."qty" >= $v1 && @."qty" <= $v2) || (@."tag" == $v3 || @."tag" == $v4)))',
    );
  });

  it('supports dotted sub-fields, datetime, startswith and null checks', () => {
    expect(
      runElem('items', {
        logic: 'and',
        filters: [
          { field: 'detail.x', dataType: 'numeric', operator: 'eq', value: 1 },
          { field: 'd', dataType: 'date', operator: 'gte', value: '2020-01-01' },
          { field: 's', dataType: 'string', operator: 'startswith', value: 'x' },
          { field: 'n', dataType: 'string', operator: 'isnull' },
          { field: 'm', dataType: 'string', operator: 'isnotnull' },
        ],
      }).values[0],
    ).toBe(
      '$."items"[*] ? (@."detail"."x" == $v0 && @."d".datetime() >= $v1.datetime() && @."s" starts with $v2 && (!exists (@."n") || @."n" == null) && (exists (@."m") && @."m" != null))',
    );
  });

  it('renders nested elemmatch via exists()', () => {
    expect(
      runElem('orders', {
        logic: 'and',
        filters: [
          { field: 'status', dataType: 'string', operator: 'eq', value: 'open' },
          {
            field: 'lines', dataType: 'array', elementType: 'object', operator: 'elemmatch',
            filters: { logic: 'and', filters: [{ field: 'sku', dataType: 'string', operator: 'eq', value: 'x' }] },
          },
        ],
      }).values[0],
    ).toBe('$."orders"[*] ? (@."status" == $v0 && exists (@."lines"[*] ? (@."sku" == $v1)))');
  });

  it('emits the 2-arg form when no vars are used', () => {
    expect(
      runElem('items', {
        logic: 'and',
        filters: [{ field: 's', dataType: 'string', operator: 'contains', value: 'x' }],
      }),
    ).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath)',
      values: ['$."items"[*] ? (@."s" like_regex "x")'],
    });
  });

  it('escapes hostile member names into the path parameter', () => {
    expect(
      runElem('items', {
        logic: 'and',
        filters: [{ field: 'a"b', dataType: 'string', operator: 'eq', value: 'x' }],
      }).values[0],
    ).toBe('$."items"[*] ? (@."a\\"b" == $v0)');
  });

  it('rejects object / scalar-array conditions inside elemmatch', () => {
    expect(() =>
      runElem('items', {
        logic: 'and',
        filters: [{ field: 'p', dataType: 'object', operator: 'eq', value: {} }],
      }),
    ).toThrow(/not supported inside elemmatch/i);
    expect(() =>
      runElem('items', {
        logic: 'and',
        filters: [{ field: 't', dataType: 'array', elementType: 'string', operator: 'eq', value: 'x' }],
      }),
    ).toThrow(/not supported inside elemmatch/i);
  });

  it('throws when the group renders empty', () => {
    expect(() =>
      runElem('items', { logic: 'and', filters: [{ logic: 'or', filters: [] }] }),
    ).toThrow(/requires a filter group with at least one condition/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: FAIL — `Not implemented`.

- [ ] **Step 3: Implement the walker in `src/dialect-jsonpath.ts`**

Add a sequential sink and the group walker (module level, above the dialect object). Extend imports: `assertCondition`, `isFilterGroup` from `./dialect`; `JsonbCondition`, `JsonbFilterGroup`, `JsonbScalarCondition` types from `./types`.

```typescript
/** Sequential naming (v0, v1, …) for predicates that merge many conditions. */
function sequentialSink(): VarSink {
  const vars: Record<string, JsonbValue> = {};
  let n = 0;
  const next = (value: JsonbValue) => {
    const name = `v${n}`;
    n += 1;
    vars[name] = value;
    return name;
  };
  return {
    vars,
    one: next,
    pair: (lo, hi) => [next(lo), next(hi)],
    many: (values) => values.map(next),
  };
}

function groupPredicate(group: JsonbFilterGroup, sink: VarSink): string {
  const parts = group.filters
    .map((node) => {
      if (isFilterGroup(node)) {
        const inner = groupPredicate(node, sink);
        return inner.length > 0 ? `(${inner})` : '';
      }
      return conditionPredicate(node, sink);
    })
    .filter((part) => part.length > 0);
  return parts.join(group.logic === 'or' ? ' || ' : ' && ');
}

function conditionPredicate(node: JsonbCondition, sink: VarSink): string {
  assertCondition(node, 'elemmatch');
  if (node.dataType === 'array' && node.elementType === 'object') {
    const inner = groupPredicate(node.filters, sink);
    if (inner.length === 0) {
      throw new Error('Operator "elemmatch" requires a filter group with at least one condition');
    }
    return `exists (${memberAccessor('@', node.field)}[*] ? (${inner}))`;
  }
  // assertCondition only lets scalar conditions through past this point.
  const scalar = node as JsonbScalarCondition;
  const { pred, compound } = scalarPredicate(
    memberAccessor('@', scalar.field),
    scalar.dataType,
    scalar.operator,
    scalar.value,
    sink,
  );
  return compound ? `(${pred})` : pred;
}
```

Replace the `renderElemMatch` stub:

```typescript
renderElemMatch(column, condition, ctx) {
  const sink = sequentialSink();
  const pred = groupPredicate(condition.filters, sink);
  if (pred.length === 0) {
    throw new Error('Operator "elemmatch" requires a filter group with at least one condition');
  }
  return pathExists(
    column,
    `${memberAccessor('$', condition.field)}[*] ? (${pred})`,
    sink.vars,
    ctx.params,
  );
},
```

- [ ] **Step 4: Verify green**

Run: `pnpm -F @rfjs/jsonb-query vitest:run && pnpm -F @rfjs/jsonb-query typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/dialect-jsonpath.ts packages/jsonb-query/src/dialect-jsonpath.spec.ts
git commit -m "feat(jsonb-query): jsonpath elemmatch as a single merged path predicate"
```

---

### Task 13: build.ts — dispatch + RenderContext wiring (integration)

**Files:**
- Modify: `src/build.ts`
- Test: `src/build.spec.ts` (append)

- [ ] **Step 1: Write failing integration tests** — append to `src/build.spec.ts`:

```typescript
const GUARD = (col: string, ph: string) =>
  `case when jsonb_typeof(${col} #> ${ph}) = 'array' then ${col} #> ${ph} else '[]'::jsonb end`;

describe('buildJsonbQuery — phase 2', () => {
  it('object conditions render identically in both dialects', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'profile', dataType: 'object', operator: 'eq', value: { vip: true } }],
    };
    const legacy = buildJsonbQuery('data', filter);
    expect(legacy).toEqual({
      where: '(("data" #> $1) = $2::jsonb)',
      values: [['profile'], '{"vip":true}'],
      from: [],
    });
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual(legacy);
  });

  it('array element eq — legacy EXISTS vs jsonpath [*] filter', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where: `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$1')}) as e1(v) where (e1.v = $2)))`,
      values: [['tags'], 'a'],
      from: [],
    });
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."tags"[*] ? (@ == $v)', { v: 'a' }],
      from: [],
    });
  });

  it('sibling array conditions get unique aliases and contiguous params (legacy)', () => {
    const r = buildJsonbQuery('data', {
      logic: 'and',
      filters: [
        { field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' },
        { field: 'nums', dataType: 'array', elementType: 'numeric', operator: 'gt', value: 5 },
      ],
    });
    expect(r.where).toBe(
      `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$1')}) as e1(v) where (e1.v = $2))) and ` +
        `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$3')}) as e2(v) where (e2.v::numeric > $4)))`,
    );
    expect(r.values).toEqual([['tags'], 'a', ['nums'], 5]);
  });

  it('containsall is identical in both dialects', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a', 'b'] }],
    };
    const legacy = buildJsonbQuery('data', filter);
    expect(legacy).toEqual({
      where: '(("data" #> $1) @> $2::jsonb)',
      values: [['tags'], '["a","b"]'],
      from: [],
    });
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual(legacy);
  });

  it('elemmatch end-to-end (legacy)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: {
            logic: 'and',
            filters: [
              { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
              { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
            ],
          },
        },
      ],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where:
        `(exists (select 1 from jsonb_array_elements(${GUARD('"data"', '$1')}) as e1 ` +
        'where ((e1.value #>> $2) = $3) and ((e1.value #>> $4)::numeric > $5)))',
      values: [['items'], ['sku'], 'x', ['qty'], 1],
      from: [],
    });
  });

  it('elemmatch end-to-end (jsonpath)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: {
            logic: 'and',
            filters: [
              { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
              {
                logic: 'or',
                filters: [
                  { field: 'qty', dataType: 'numeric', operator: 'gt', value: 10 },
                  { field: 'flag', dataType: 'boolean', operator: 'eq', value: true },
                ],
              },
            ],
          },
        },
      ],
    };
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: [
        '$."items"[*] ? (@."sku" == $v0 && (@."qty" > $v1 || @."flag" == $v2))',
        { v0: 'x', v1: 10, v2: true },
      ],
      from: [],
    });
  });

  it('nested elemmatch recurses in both dialects', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'orders', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: {
            logic: 'and',
            filters: [
              { field: 'status', dataType: 'string', operator: 'eq', value: 'open' },
              {
                field: 'lines', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                filters: { logic: 'and', filters: [{ field: 'sku', dataType: 'string', operator: 'eq', value: 'x' }] },
              },
            ],
          },
        },
      ],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where:
        `(exists (select 1 from jsonb_array_elements(${GUARD('"data"', '$1')}) as e1 ` +
        'where ((e1.value #>> $2) = $3) and ' +
        `(exists (select 1 from jsonb_array_elements(${GUARD('e1.value', '$4')}) as e2 where ((e2.value #>> $5) = $6)))))`,
      values: [['orders'], ['status'], 'open', ['lines'], ['sku'], 'x'],
      from: [],
    });
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' }).values).toEqual([
      '$."orders"[*] ? (@."status" == $v0 && exists (@."lines"[*] ? (@."sku" == $v1)))',
      { v0: 'open', v1: 'x' },
    ]);
  });

  it('mixes scalar and phase-2 conditions with contiguous params and honours paramOffset', () => {
    const r = buildJsonbQuery(
      'data',
      {
        logic: 'and',
        filters: [
          { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
          { field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } },
          { field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' },
        ],
      },
      { paramOffset: 1 },
    );
    expect(r.where).toBe(
      '(("data" #>> $2) = $3) and (("data" #> $4) @> $5::jsonb) and ' +
        `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$6')}) as e1(v) where (e1.v = $7)))`,
    );
    expect(r.values).toEqual([['name'], 'bob', ['profile'], '{"vip":true}', ['tags'], 'a']);
  });

  it('rejects object / scalar-array conditions inside elemmatch in both dialects', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: { logic: 'and', filters: [{ field: 'p', dataType: 'object', operator: 'eq', value: {} }] },
        },
      ],
    };
    expect(() => buildJsonbQuery('data', filter)).toThrow(/not supported inside elemmatch/i);
    expect(() => buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toThrow(
      /not supported inside elemmatch/i,
    );
  });

  it('throws when elemmatch filters are empty or render empty', () => {
    const empty: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: { logic: 'and', filters: [] },
        },
      ],
    };
    expect(() => buildJsonbQuery('data', empty)).toThrow(/requires a filter group/i);

    const rendersEmpty: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: { logic: 'and', filters: [{ logic: 'or', filters: [] }] },
        },
      ],
    };
    expect(() => buildJsonbQuery('data', rendersEmpty)).toThrow(/at least one condition/i);
    expect(() => buildJsonbQuery('data', rendersEmpty, { dialect: 'jsonpath' })).toThrow(
      /at least one condition/i,
    );
  });

  it('rejects invalid phase-2 operator combinations', () => {
    const one = (f: unknown) => () =>
      buildJsonbQuery('data', { logic: 'and', filters: [f as never] });
    expect(one({ field: 'p', dataType: 'object', operator: 'gt', value: {} })).toThrow(
      /unsupported operator "gt" for type "object"/i,
    );
    expect(
      one({ field: 't', dataType: 'array', elementType: 'string', operator: 'neq', value: 'x' }),
    ).toThrow(/unsupported operator "neq" for array elements/i);
    expect(
      one({ field: 'i', dataType: 'array', elementType: 'object', operator: 'eq', value: {} }),
    ).toThrow(/use "elemmatch"/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @rfjs/jsonb-query vitest:run`
Expected: FAIL — `Not implemented` / validation not yet wired into `build.ts`.

- [ ] **Step 3: Rewrite `src/build.ts`**

```typescript
import type {
  JsonbCondition,
  JsonbDialect,
  JsonbElemMatchCondition,
  JsonbFilterGroup,
  JsonbQueryResult,
  BuildJsonbOptions,
} from './types';
import { ParamBuilder } from './param-builder';
import { quoteJsonbColumn } from './column';
import {
  type ConditionScope,
  type JsonbQueryDialect,
  type RenderContext,
  assertCondition,
  isFilterGroup,
} from './dialect';
import { renderObjectCondition } from './object-condition';
import { legacyDialect } from './dialect-legacy';
import { jsonpathDialect } from './dialect-jsonpath';

const DIALECTS = {
  legacy: legacyDialect,
  jsonpath: jsonpathDialect,
} satisfies Record<JsonbDialect, JsonbQueryDialect>;

function isElemMatch(node: JsonbCondition): node is JsonbElemMatchCondition {
  return node.dataType === 'array' && node.elementType === 'object';
}

function renderCondition(
  node: JsonbCondition,
  column: string,
  dialect: JsonbQueryDialect,
  ctx: RenderContext,
  scope: ConditionScope,
): string {
  assertCondition(node, scope);
  if (isElemMatch(node)) {
    return dialect.renderElemMatch(column, node, ctx);
  }
  if (node.dataType === 'object') {
    return renderObjectCondition(column, node, ctx.params);
  }
  if (node.dataType === 'array') {
    return dialect.renderArray(column, node, ctx);
  }
  return dialect.render(column, node.field, node.dataType, node.operator, node.value, ctx.params);
}

function buildGroup(
  group: JsonbFilterGroup,
  column: string,
  dialect: JsonbQueryDialect,
  ctx: RenderContext,
  scope: ConditionScope,
): string {
  const parts = group.filters
    .map((node) =>
      isFilterGroup(node)
        ? wrap(buildGroup(node, column, dialect, ctx, scope))
        : renderCondition(node, column, dialect, ctx, scope),
    )
    .filter((sql) => sql.length > 0);
  return parts.join(group.logic === 'or' ? ' or ' : ' and ');
}

function wrap(sql: string): string {
  return sql.length > 0 ? `(${sql})` : '';
}

export function buildJsonbQuery(
  column: string,
  filter: JsonbFilterGroup,
  options: BuildJsonbOptions = {},
): JsonbQueryResult {
  const quoted = quoteJsonbColumn(column);
  const dialectName = options.dialect ?? 'legacy';
  const dialect = DIALECTS[dialectName];
  if (!dialect) {
    throw new Error(`Unknown JSONB dialect: "${dialectName}"`);
  }
  const params = new ParamBuilder(options.paramOffset ?? 0);
  let aliasCount = 0;
  const ctx: RenderContext = {
    params,
    nextAlias: () => {
      aliasCount += 1;
      return `e${aliasCount}`;
    },
    renderGroup: (group, col) => buildGroup(group, col, dialect, ctx, 'elemmatch'),
  };
  const where = buildGroup(filter, quoted, dialect, ctx, 'root');
  return { where, values: params.values, from: [] };
}
```

- [ ] **Step 4: Verify the WHOLE suite is green (Phase 1 + Phase 2)**

Run: `pnpm -F @rfjs/jsonb-query vitest:run && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query lint`
Expected: all tests pass (Phase 1 expectations untouched), tsc and eslint clean.

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/build.ts packages/jsonb-query/src/build.spec.ts
git commit -m "feat(jsonb-query): dispatch phase-2 conditions through buildJsonbQuery"
```

---

### Task 14: README updates (en + zh-TW)

**Files:**
- Modify: `README.md`, `README.zh-TW.md`

- [ ] **Step 1: Update `README.md`** — replace the operator table + trailing "planned" note with:

````markdown
## Supported types & operators

| dataType | operators |
|----------|-----------|
| `string` | `eq` `neq` `isnull` `isnotnull` `contains` `startswith` `endswith` `terms` |
| `numeric` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms` |
| `date` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms` |
| `boolean` | `eq` `neq` `isnull` `isnotnull` |
| `object` | `eq` `neq` `contains` `isnull` `isnotnull` |
| `array` + scalar `elementType` | element ops (see below) + `containsall` + `isnull` `isnotnull` |
| `array` + `elementType: 'object'` | `elemmatch` |

`range` takes a 2-element `[lo, hi]` value; `terms` takes a non-empty array.

### Nested objects

Dot paths reach nested scalars (`profile.vip`). `dataType: 'object'` compares the
object value itself — `eq`/`neq` are structural jsonb equality, `contains` is
jsonb containment (`@>`):

```typescript
{ field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } }
// legacy & jsonpath: (("data" #> $1) @> $2::jsonb)   values: [['profile'], '{"vip":true}']
```

Object conditions render the same SQL in both dialects (SQL/JSON path predicates
cannot compare non-scalar values), and `@>` is GIN-indexable.

### JSON arrays (scalar elements)

Declare `dataType: 'array'` with the element type in `elementType`. Scalar
operators match with **"some element matches"** (∃) semantics; `isnull`/
`isnotnull` test the array field itself; `containsall` (string/numeric elements)
requires every listed value to be present. `neq` is not allowed on elements
(exists-vs-forall ambiguity).

```typescript
{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }
// legacy:   (exists (select 1 from jsonb_array_elements_text(...) as e1(v) where (e1.v = $2)))
// jsonpath: $."tags"[*] ? (@ == $v)

{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a', 'b'] }
// both: (("data" #> $1) @> $2::jsonb)
```

Element operators: string → `eq contains startswith endswith terms`;
numeric → `eq gt gte lt lte range terms`; date → `eq gt gte lt lte range terms`;
boolean → `eq`.

### Arrays of objects (`elemmatch`)

All sub-conditions must hold on the **same element**. Sub-`field`s are relative
to the element; nested `and`/`or` groups and nested `elemmatch` are supported.
Object-valued and scalar-array conditions inside `elemmatch` are not supported
yet (rejected in both dialects).

```typescript
{
  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
  filters: {
    logic: 'and',
    filters: [
      { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
      { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
    ],
  },
}
// legacy:   (exists (select 1 from jsonb_array_elements(...) as e1
//             where ((e1.value #>> $2) = $3) and ((e1.value #>> $4)::numeric > $5)))
// jsonpath: $."items"[*] ? (@."sku" == $v0 && @."qty" > $v1)
```

### Semantics notes

- Array element values destined for `::jsonb` parameters are `JSON.stringify`-ed
  by the builder; pass plain JS values as usual.
- When the stored value is **not** an array: the legacy dialect treats it as an
  empty array (no match); the jsonpath dialect (lax mode) auto-wraps a scalar as
  a one-element array. Keep stored shapes consistent to avoid the divergence.
- `containsall` on `date` elements is rejected: jsonb containment would compare
  ISO text, not datetimes.
````

Also update the Dialects section sentence "Both dialects accept the same filter metadata." → unchanged (still true), and the result-shape note if present: `from` is always `[]`; array queries are self-contained in `where`.

- [ ] **Step 2: Update `README.zh-TW.md`** — mirror the same sections in Traditional Chinese (same code blocks):

````markdown
## 支援的型別與運算子

| dataType | operators |
|----------|-----------|
| `string` | `eq` `neq` `isnull` `isnotnull` `contains` `startswith` `endswith` `terms` |
| `numeric` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms` |
| `date` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms` |
| `boolean` | `eq` `neq` `isnull` `isnotnull` |
| `object` | `eq` `neq` `contains` `isnull` `isnotnull` |
| `array` + 純量 `elementType` | 元素運算子（見下方）+ `containsall` + `isnull` `isnotnull` |
| `array` + `elementType: 'object'` | `elemmatch` |

`range` 接受 2 個元素的 `[lo, hi]` 陣列；`terms` 接受非空陣列。

### 巢狀物件

點記號路徑可存取巢狀純量（`profile.vip`）。`dataType: 'object'` 則比較物件值
本身 — `eq`/`neq` 為 jsonb 結構相等比較，`contains` 為 jsonb 包含（`@>`）：

```typescript
{ field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } }
// legacy 與 jsonpath 皆為: (("data" #> $1) @> $2::jsonb)   values: [['profile'], '{"vip":true}']
```

物件條件在兩種方言中產生相同 SQL（SQL/JSON path 述詞無法比較非純量值），
且 `@>` 可使用 GIN 索引。

### JSON 陣列（純量元素）

宣告 `dataType: 'array'` 並以 `elementType` 指定元素型別。純量運算子採
**「任一元素符合」**（∃）語意；`isnull`/`isnotnull` 檢查陣列欄位本身；
`containsall`（限 string/numeric 元素）要求所有列出的值皆存在。
元素不支援 `neq`（存在 ∃ 與全稱 ∀ 語意混淆）。

```typescript
{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }
// legacy:   (exists (select 1 from jsonb_array_elements_text(...) as e1(v) where (e1.v = $2)))
// jsonpath: $."tags"[*] ? (@ == $v)

{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a', 'b'] }
// 兩種方言皆為: (("data" #> $1) @> $2::jsonb)
```

元素運算子：string → `eq contains startswith endswith terms`；
numeric → `eq gt gte lt lte range terms`；date → `eq gt gte lt lte range terms`；
boolean → `eq`。

### 物件陣列（`elemmatch`）

所有子條件必須在**同一個元素**上成立。子條件的 `field` 為相對於元素的路徑；
支援巢狀 `and`/`or` 群組與巢狀 `elemmatch`。`elemmatch` 內尚不支援物件條件與
純量陣列條件（兩種方言皆會拒絕）。

```typescript
{
  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
  filters: {
    logic: 'and',
    filters: [
      { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
      { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
    ],
  },
}
// legacy:   (exists (select 1 from jsonb_array_elements(...) as e1
//             where ((e1.value #>> $2) = $3) and ((e1.value #>> $4)::numeric > $5)))
// jsonpath: $."items"[*] ? (@."sku" == $v0 && @."qty" > $v1)
```

### 語意注意事項

- 進入 `::jsonb` 參數的陣列／物件值會由建構器自動 `JSON.stringify`；照常傳入
  一般 JS 值即可。
- 當儲存的值**不是**陣列時：legacy 方言視為空陣列（不符合）；jsonpath 方言
  （lax 模式）會把純量自動包裝成單元素陣列。請保持資料形狀一致以避免差異。
- `date` 元素不支援 `containsall`：jsonb 包含比較的是 ISO 文字而非時間值。
````

(Both files: delete the trailing "planned for a later release" blockquote.)

- [ ] **Step 3: Verify formatting and suite**

Run: `pnpm -F @rfjs/jsonb-query vitest:run && pnpm format`
Expected: tests pass; prettier reformats nothing unexpected outside the two READMEs.

- [ ] **Step 4: Commit**

```bash
git add packages/jsonb-query/README.md packages/jsonb-query/README.zh-TW.md
git commit -m "docs(jsonb-query): document phase-2 object/array/elemmatch queries"
```

---

### Task 15: Final verification (no release steps)

**Files:** none

- [ ] **Step 1: Full package verification**

```bash
pnpm -F @rfjs/jsonb-query vitest:run
pnpm -F @rfjs/jsonb-query typecheck
pnpm -F @rfjs/jsonb-query lint
pnpm -F @rfjs/jsonb-query build
```

Expected: all green; tsdown build succeeds.

- [ ] **Step 2: Confirm release guardrails were untouched**

```bash
git diff main -- packages/jsonb-query/package.json .changeset/config.json
```

Expected: **empty diff** (`"private": true` intact, changeset `ignore` intact, no changeset files added).

- [ ] **Step 3: Confirm monorepo-level checks**

```bash
pnpm -F @rfjs/jsonb-query test
git status
```

Expected: clean tree, all commits on `feat/jsonb-query-phase2`.

- [ ] **Step 4: STOP — hand back to the user**

Do **not** merge, do not open a PR, do not add a changeset, do not modify `private`/`ignore`. The user reviews the branch first; release wiring (changeset → un-private → un-ignore → release flow, first publish 0.1.0) is an explicitly separate follow-up after sign-off.

---

## Self-review

1. **Spec coverage:** nested objects (Task 6 + 13), JSON arrays (Tasks 8, 11, 13), arrays of objects (Tasks 9, 12, 13), both dialects throughout, parameterization preserved (validated/quoted identifiers + generated aliases are the only SQL-text inputs; hostile-value tests in Tasks 6, 12, 13), spec tests per task, README both languages (Task 14), release guardrails (Task 15). ✓
2. **Placeholder scan:** none — every step carries full code/commands. ✓
3. **Type consistency:** `JsonbQueryDialect.renderArray/renderElemMatch(column, condition, ctx)` used identically in Tasks 5, 8, 9, 11, 12, 13; `RenderContext { params, nextAlias, renderGroup }` consistent; `assertCondition(node, scope)` consistent; error strings in implementations match every regex asserted in specs (checked pairwise). ✓
