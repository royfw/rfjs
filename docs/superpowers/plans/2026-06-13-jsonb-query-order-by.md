# jsonb-query ORDER BY Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dialect-independent `ORDER BY` builder to `@rfjs/jsonb-query` — `buildJsonbOrderBy` (positional `$N`) and `buildNamedJsonbOrderBy` (`:pN`) — that turns sort metadata into a parameterized `ORDER BY` fragment reusing the package's path-extraction and casting.

**Architecture:** A new isolated `src/order-by.ts` module renders each sort spec as `(col #>> $N)<cast> <dir> [nulls first|last]`, joined with `, `. It is dialect-independent (ordering always extracts a scalar; `jsonpath` has no ordering construct). Two small behavior-preserving refactors first put the scalar CAST map and the positional→named rewrite in shared, reusable spots.

**Tech Stack:** TypeScript 5.7, Vitest (co-located `src/**/*.spec.ts`), pnpm + Turborepo, Changesets.

**Spec:** `docs/superpowers/specs/2026-06-13-jsonb-query-order-by-design.md`

**Working directory:** `packages/jsonb-query` inside the `feat/jsonb-query-order-by` worktree (off post-operator-expansion main). Commands assume repo root unless noted. Per-file test: `pnpm -F @rfjs/jsonb-query vitest:run <path>`. Full gate: `pnpm -F @rfjs/jsonb-query lint && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query test`.

---

## File Structure

**Created:**
- `src/order-by.ts` — `JsonbSortSpec`, `buildJsonbOrderBy`, `buildNamedJsonbOrderBy`, validation.
- `src/order-by.spec.ts` — unit tests.

**Modified:**
- `src/dialect/base.ts` — export `SCALAR_CASTS` (extracted from legacy.ts).
- `src/dialect/legacy.ts` — import `SCALAR_CASTS` instead of a local `CASTS`.
- `src/named-params.ts` — extract a reusable `positionalToNamed` helper (export internally).
- `src/errors.ts` — add `INVALID_SORT` to the code union.
- `src/index.ts` — export the order-by public surface.
- `README.md`; `.changeset/<slug>.md` (new).
- `test/jsonb-query.e2e.spec.ts` — one ordering case.

**Build order:** refactors first (behavior-preserving, existing suite stays green) → `INVALID_SORT` → `buildJsonbOrderBy` → `buildNamedJsonbOrderBy` + exports → docs/changeset → E2E.

---

## Task 1: Shared refactors (SCALAR_CASTS + positionalToNamed)

Both are behavior-preserving; the existing suite is the regression check.

**Files:**
- Modify: `src/dialect/base.ts`, `src/dialect/legacy.ts`, `src/named-params.ts`

- [ ] **Step 1: Export `SCALAR_CASTS` from `src/dialect/base.ts`**

Add near the top of `base.ts` (after the imports), exporting the scalar cast map so both `legacy.ts` and the new `order-by.ts` share one source of truth:
```ts
/** Scalar `#>>`-text cast suffixes shared by the legacy dialect and ORDER BY. */
export const SCALAR_CASTS: Record<JsonbScalarType, string> = {
  string: '',
  numeric: '::numeric',
  date: '::timestamptz',
  boolean: '::boolean',
};
```
(`JsonbScalarType` is already imported in `base.ts`.)

- [ ] **Step 2: Use `SCALAR_CASTS` in `src/dialect/legacy.ts`**

Remove the local `CASTS` constant:
```ts
const CASTS: Record<JsonbScalarType, string> = {
  string: '',
  numeric: '::numeric',
  date: '::timestamptz',
  boolean: '::boolean',
};
```
Add `SCALAR_CASTS` to the import from `'./base'` (alongside the existing names). Replace the one usage in `renderScalarOp`:
```ts
  const Fc = `${F}${CASTS[dataType]}`;
```
with:
```ts
  const Fc = `${F}${SCALAR_CASTS[dataType]}`;
```
(Leave `ARRAY_CASTS` as-is — it is legacy-only.)

- [ ] **Step 3: Extract `positionalToNamed` in `src/named-params.ts`**

Replace the body of `toNamedParams` with a call to a new reusable helper. Add the helper (module-level, exported for internal cross-module use — NOT re-exported from `src/index.ts`, so it stays out of the public API):
```ts
/**
 * Internal: rewrite positional `$N` placeholders in `sql` to `:<prefix>N` and
 * build the matching params object. Shared by toNamedParams and the ORDER BY
 * named builder. Not part of the public API.
 */
export function positionalToNamed(
  sql: string,
  values: unknown[],
  prefix: string,
): { sql: string; params: Record<string, unknown> } {
  if (!PREFIX.test(prefix)) {
    throw new JsonbQueryError(`Invalid named-parameter prefix: ${JSON.stringify(prefix)}`, 'INVALID_PREFIX');
  }
  const seen = new Set<number>();
  const rewritten = sql.replace(/(?<![A-Za-z0-9_$"])\$(\d+)/g, (_match, n: string) => {
    seen.add(Number(n));
    return `:${prefix}${n}`;
  });
  const numbers = [...seen].sort((a, b) => a - b);
  const offset = (numbers[0] ?? 1) - 1;
  const contiguous =
    numbers.length === values.length && numbers.every((n, i) => n === offset + i + 1);
  if (!contiguous) {
    throw new JsonbQueryError('placeholders do not match the values array', 'PARAM_MISMATCH');
  }
  return {
    sql: rewritten,
    params: Object.fromEntries(values.map((value, i) => [`${prefix}${offset + i + 1}`, value])),
  };
}
```
Then rewrite `toNamedParams` to delegate:
```ts
export function toNamedParams(result: JsonbQueryResult, prefix = 'p'): NamedParamsResult {
  const { sql, params } = positionalToNamed(result.where, result.values, prefix);
  return { where: sql, params };
}
```

> Note: the `PARAM_MISMATCH` message changes from `toNamedParams: placeholders do not match the values array` to `placeholders do not match the values array` (now shared). The existing `named-params.spec.ts` asserts this with `/placeholders do not match the values array/i`, which still matches.

- [ ] **Step 4: Verify the full suite stays green (regression check)**

Run: `pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query lint`
Expected: PASS, clean (no behavior change). If `named-params.spec.ts` asserts the old `toNamedParams:`-prefixed message anywhere with an exact-string match, update that one assertion to the new message.

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "refactor(jsonb-query): share SCALAR_CASTS and positionalToNamed for reuse"
```

---

## Task 2: `INVALID_SORT` error code

**Files:**
- Modify: `src/errors.ts`
- Test: `src/errors.spec.ts` (added in Task 3's tests; nothing to assert here yet)

- [ ] **Step 1: Add the code to the union**

In `src/errors.ts`, change the last union member:
```ts
  | 'PARAM_MISMATCH';       // toNamedParams: placeholders do not match the values array
```
to:
```ts
  | 'PARAM_MISMATCH'        // toNamedParams: placeholders do not match the values array
  | 'INVALID_SORT';         // sort spec has an invalid dataType / direction / nulls
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm -F @rfjs/jsonb-query typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/jsonb-query/src/errors.ts
git commit -m "feat(jsonb-query): add INVALID_SORT error code"
```

---

## Task 3: `buildJsonbOrderBy` (positional)

**Files:**
- Create: `src/order-by.ts`
- Create: `src/order-by.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/order-by.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildJsonbOrderBy } from './order-by';
import { JsonbQueryError } from './errors';

describe('buildJsonbOrderBy', () => {
  it('single column defaults to asc, casts by dataType', () => {
    expect(buildJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric' }])).toEqual({
      orderBy: '("data" #>> $1)::numeric asc',
      values: [['age']],
    });
    expect(buildJsonbOrderBy('data', [{ field: 'name', dataType: 'string' }]).orderBy).toBe(
      '("data" #>> $1) asc',
    );
  });

  it('honours direction and nulls ordering', () => {
    expect(
      buildJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric', direction: 'desc', nulls: 'last' }]).orderBy,
    ).toBe('("data" #>> $1)::numeric desc nulls last');
    expect(
      buildJsonbOrderBy('data', [{ field: 'd', dataType: 'date', direction: 'asc', nulls: 'first' }]).orderBy,
    ).toBe('("data" #>> $1)::timestamptz asc nulls first');
  });

  it('joins multiple columns with contiguous params and honours paramOffset', () => {
    expect(
      buildJsonbOrderBy('data', [
        { field: 'age', dataType: 'numeric', direction: 'desc' },
        { field: 'name', dataType: 'string' },
      ]),
    ).toEqual({
      orderBy: '("data" #>> $1)::numeric desc, ("data" #>> $2) asc',
      values: [['age'], ['name']],
    });
    expect(
      buildJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric' }], { paramOffset: 2 }).orderBy,
    ).toBe('("data" #>> $3)::numeric asc');
  });

  it('returns an empty fragment for no sorts', () => {
    expect(buildJsonbOrderBy('data', [])).toEqual({ orderBy: '', values: [] });
  });

  it('rejects invalid column / dataType / direction / nulls', () => {
    expect(() => buildJsonbOrderBy('bad-col', [{ field: 'a', dataType: 'string' }])).toThrow(/invalid jsonb column/i);
    const code = (fn: () => unknown): string => {
      try { fn(); } catch (e) { if (e instanceof JsonbQueryError) return e.code; throw e; }
      throw new Error('expected a JsonbQueryError');
    };
    expect(code(() => buildJsonbOrderBy('data', [{ field: 'a', dataType: 'bogus' as never }]))).toBe('INVALID_SORT');
    expect(code(() => buildJsonbOrderBy('data', [{ field: 'a', dataType: 'string', direction: 'up' as never }]))).toBe('INVALID_SORT');
    expect(code(() => buildJsonbOrderBy('data', [{ field: 'a', dataType: 'string', nulls: 'middle' as never }]))).toBe('INVALID_SORT');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/order-by.spec.ts`
Expected: FAIL — cannot resolve `./order-by`.

- [ ] **Step 3: Implement `src/order-by.ts`**

Create `src/order-by.ts`:
```ts
import type { JsonbScalarType } from './types';
import { ParamBuilder } from './param-builder';
import { quoteJsonbColumn } from './column';
import { fieldSegments, SCALAR_CASTS } from './dialect';
import { JsonbQueryError } from './errors';

export type JsonbSortDirection = 'asc' | 'desc';
export type JsonbNullsOrder = 'first' | 'last';

export interface JsonbSortSpec {
  field: string;
  /** Only scalar types are orderable. */
  dataType: JsonbScalarType;
  /** Default 'asc'. */
  direction?: JsonbSortDirection;
  /** Omit to use PostgreSQL's default (NULLS LAST for asc, NULLS FIRST for desc). */
  nulls?: JsonbNullsOrder;
}

export interface JsonbOrderByResult {
  orderBy: string;
  values: unknown[];
}

export interface BuildJsonbOrderByOptions {
  paramOffset?: number;
}

function renderSort(quoted: string, spec: JsonbSortSpec, params: ParamBuilder): string {
  const cast = SCALAR_CASTS[spec.dataType];
  if (cast === undefined) {
    throw new JsonbQueryError(`Invalid sort dataType: ${JSON.stringify(spec.dataType)}`, 'INVALID_SORT');
  }
  const direction = spec.direction ?? 'asc';
  if (direction !== 'asc' && direction !== 'desc') {
    throw new JsonbQueryError(`Invalid sort direction: ${JSON.stringify(direction)}`, 'INVALID_SORT');
  }
  let sql = `(${quoted} #>> ${params.add(fieldSegments(spec.field))})${cast} ${direction}`;
  if (spec.nulls !== undefined) {
    if (spec.nulls !== 'first' && spec.nulls !== 'last') {
      throw new JsonbQueryError(`Invalid sort nulls: ${JSON.stringify(spec.nulls)}`, 'INVALID_SORT');
    }
    sql += ` nulls ${spec.nulls}`;
  }
  return sql;
}

/**
 * Build a parameterized ORDER BY fragment from sort metadata. Dialect-
 * independent (ordering always extracts a scalar via `#>>` + cast). Empty
 * `sorts` yields an empty fragment. Use `paramOffset` to compose after a WHERE.
 */
export function buildJsonbOrderBy(
  column: string,
  sorts: JsonbSortSpec[],
  options: BuildJsonbOrderByOptions = {},
): JsonbOrderByResult {
  const quoted = quoteJsonbColumn(column);
  const params = new ParamBuilder(options.paramOffset ?? 0);
  const orderBy = sorts.map((spec) => renderSort(quoted, spec, params)).join(', ');
  return { orderBy, values: params.values };
}
```
(`SCALAR_CASTS` and `fieldSegments` are re-exported from `./dialect` via `export * from './base'`.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/order-by.spec.ts && pnpm -F @rfjs/jsonb-query typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/order-by.ts packages/jsonb-query/src/order-by.spec.ts
git commit -m "feat(jsonb-query): add buildJsonbOrderBy (positional ORDER BY builder)"
```

---

## Task 4: `buildNamedJsonbOrderBy` + barrel exports

**Files:**
- Modify: `src/order-by.ts`
- Modify: `src/index.ts`
- Test: `src/order-by.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/order-by.spec.ts`:
```ts
import { buildNamedJsonbOrderBy } from './order-by';

describe('buildNamedJsonbOrderBy', () => {
  it('emits :pN placeholders and a params object', () => {
    expect(
      buildNamedJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric', direction: 'desc' }]),
    ).toEqual({
      orderBy: '("data" #>> :p1)::numeric desc',
      params: { p1: ['age'] },
    });
  });

  it('honours a custom prefix and paramOffset (shifts names)', () => {
    expect(
      buildNamedJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric' }], { prefix: 'o' }),
    ).toEqual({
      orderBy: '("data" #>> :o1)::numeric asc',
      params: { o1: ['age'] },
    });
    expect(
      buildNamedJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric' }], { paramOffset: 4 }).orderBy,
    ).toBe('("data" #>> :p5)::numeric asc');
  });

  it('returns an empty fragment + empty params for no sorts', () => {
    expect(buildNamedJsonbOrderBy('data', [])).toEqual({ orderBy: '', params: {} });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/order-by.spec.ts`
Expected: FAIL — `buildNamedJsonbOrderBy` is not exported.

- [ ] **Step 3: Implement `buildNamedJsonbOrderBy` in `src/order-by.ts`**

Add the import at the top:
```ts
import { positionalToNamed } from './named-params';
```
Append at the end of the file:
```ts
export interface BuildNamedJsonbOrderByOptions extends BuildJsonbOrderByOptions {
  /** Named-parameter prefix (default "p"): `:p1`, `:p2`, … */
  prefix?: string;
}

export interface NamedOrderByResult {
  orderBy: string;
  params: Record<string, unknown>;
}

/**
 * Named-parameter variant for query layers with named bindings (TypeORM
 * QueryBuilder, Knex). `paramOffset` shifts the parameter *names* (`:p5`, …).
 */
export function buildNamedJsonbOrderBy(
  column: string,
  sorts: JsonbSortSpec[],
  options: BuildNamedJsonbOrderByOptions = {},
): NamedOrderByResult {
  const { prefix, ...buildOptions } = options;
  const { orderBy, values } = buildJsonbOrderBy(column, sorts, buildOptions);
  const { sql, params } = positionalToNamed(orderBy, values, prefix ?? 'p');
  return { orderBy: sql, params };
}
```

- [ ] **Step 4: Export the public surface from `src/index.ts`**

Append:
```ts
export {
  buildJsonbOrderBy,
  buildNamedJsonbOrderBy,
  type JsonbSortSpec,
  type JsonbSortDirection,
  type JsonbNullsOrder,
  type JsonbOrderByResult,
  type BuildJsonbOrderByOptions,
  type BuildNamedJsonbOrderByOptions,
  type NamedOrderByResult,
} from './order-by';
```

- [ ] **Step 5: Run the full suite + typecheck + lint**

Run: `pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query lint`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "feat(jsonb-query): add buildNamedJsonbOrderBy and export the order-by surface"
```

---

## Task 5: README + changeset

**Files:**
- Modify: `packages/jsonb-query/README.md`
- Create: `.changeset/jsonb-query-order-by.md`

- [ ] **Step 1: Add a "## Sorting" section to `README.md`**

Insert before "## Safety":
```
## Sorting

`buildJsonbOrderBy` turns sort metadata into a parameterized `ORDER BY` fragment,
reusing the same path extraction and casts as the `WHERE` builder. It is
**dialect-independent** (ordering always extracts a scalar; there is no jsonpath
ordering construct), so it takes no `dialect` option. Use `paramOffset` to
compose it after a `WHERE`:

```typescript
import { buildJsonbQuery, buildJsonbOrderBy } from '@rfjs/jsonb-query';

const { where, values } = buildJsonbQuery('data', filter);
const ob = buildJsonbOrderBy('data', [
  { field: 'age',  dataType: 'numeric', direction: 'desc', nulls: 'last' },
  { field: 'name', dataType: 'string' }, // direction defaults to 'asc'
], { paramOffset: values.length });
// ob.orderBy: '("data" #>> $3)::numeric desc nulls last, ("data" #>> $4) asc'
await client.query(
  `SELECT * FROM t WHERE ${where} ORDER BY ${ob.orderBy}`,
  [...values, ...ob.values],
);
```

`nulls` is optional; omit it to use PostgreSQL's default (`NULLS LAST` for `asc`,
`NULLS FIRST` for `desc`). Empty `sorts` yields an empty `orderBy` string (just
omit the `ORDER BY` clause). Only scalar `dataType`s are orderable; an invalid
`dataType` / `direction` / `nulls` throws `JsonbQueryError` with code
`INVALID_SORT`.

For named-binding query layers (TypeORM QueryBuilder, Knex), use
`buildNamedJsonbOrderBy` (`:pN` output), the ORDER BY counterpart to
`buildNamedJsonbQuery`:

```typescript
const { orderBy, params } = buildNamedJsonbOrderBy('data', [
  { field: 'age', dataType: 'numeric', direction: 'desc' },
], { prefix: 'o' });
// orderBy: '("data" #>> :o1)::numeric desc'   params: { o1: ['age'] }
qb.addOrderBy(orderBy).setParameters(params);
```
```

Also add `INVALID_SORT` to the error-code list in the existing "## Errors" section's code comment (append it to the union shown there).

- [ ] **Step 2: Create the changeset**

Create `.changeset/jsonb-query-order-by.md`:
```md
---
'@rfjs/jsonb-query': minor
---

Add an ORDER BY builder.

**Added**
- `buildJsonbOrderBy(column, sorts, options?)` — parameterized, dialect-
  independent `ORDER BY` fragment from sort metadata (per-column `direction`
  default `asc`, optional `nulls` first/last, `paramOffset` to compose after a
  WHERE).
- `buildNamedJsonbOrderBy(...)` — `:pN` variant for named-binding query layers.
- `INVALID_SORT` error code for invalid sort `dataType` / `direction` / `nulls`.
```

- [ ] **Step 3: Verify build + full suite**

Run: `pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query build`
Expected: PASS, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/jsonb-query/README.md .changeset/jsonb-query-order-by.md
git commit -m "docs(jsonb-query): document the ORDER BY builder"
```

---

## Task 6: E2E ordering case

**Files:**
- Modify: `packages/jsonb-query/test/jsonb-query.e2e.spec.ts`

- [ ] **Step 1: Add the ordering test**

At the top of the file, add `buildJsonbOrderBy` to the `'../src'` import:
```ts
import { buildJsonbQuery, buildJsonbOrderBy } from '../src';
```

Add a test inside the per-URL describe block (it is dialect-independent, so it runs once per server). Place it alongside the existing top-level `it(...)` cases (e.g. after the `honours paramOffset` test):
```ts
      it('orders by a numeric jsonb path (desc, nulls last)', async () => {
        // Seed ages: id1=30, id2=18, id3=null, ids4-8 have no age. desc nulls last
        // → 30,18 first, then the null/missing-age rows; secondary `, id` makes the
        // null group deterministic.
        const ob = buildJsonbOrderBy('data', [
          { field: 'age', dataType: 'numeric', direction: 'desc', nulls: 'last' },
        ]);
        const res = await client.query(
          `select id from e2e_t order by ${ob.orderBy}, id`,
          ob.values,
        );
        expect(res.rows.map((r: { id: number }) => Number(r.id))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      });
```
> When implementing, confirm the seed's `age` values (id 1 = 30, id 2 = 18, id 3 = null, ids 4–8 missing) and adjust the expected order if the committed seed differs.

- [ ] **Step 2: Verify it self-skips without a DB**

Run: `pnpm -F @rfjs/jsonb-query vitest:e2e:run`
Expected: PASS, all suites skipped (no `PG_E2E_URLS`).

- [ ] **Step 3 (optional, if Docker available): run against real PG**

Run:
```bash
cd packages/jsonb-query && bash scripts/e2e.sh
```
Expected: PASS on PG 11.16 and PG 16. If Docker is unavailable, skip and note it.

- [ ] **Step 4: Commit**

```bash
git add packages/jsonb-query/test/jsonb-query.e2e.spec.ts
git commit -m "test(jsonb-query): e2e for the ORDER BY builder"
```

---

## Final verification

- [ ] From repo root: `pnpm -F @rfjs/jsonb-query lint && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query build` — all PASS.
- [ ] Confirm the public surface: `buildJsonbOrderBy`, `buildNamedJsonbOrderBy`, and the `JsonbSortSpec` family are exported from `@rfjs/jsonb-query`; `JsonbQueryErrorCode` includes `INVALID_SORT`.
- [ ] Open a PR `feat/jsonb-query-order-by → main` once the user approves.

---

## Self-Review (filled in during planning)

**Spec coverage:** `buildJsonbOrderBy` → Task 3; `buildNamedJsonbOrderBy` → Task 4; per-column direction/nulls → Task 3 (render + tests); SCALAR_CASTS refactor → Task 1 Step 1-2; positionalToNamed refactor → Task 1 Step 3; `INVALID_SORT` → Task 2; barrel exports → Task 4; README "Sorting" → Task 5; changeset (minor) → Task 5; E2E ordering → Task 6. All spec sections covered.

**Placeholder scan:** none — every code/test step has complete code; the E2E step flags verifying the real seed ages (an instruction, not a placeholder).

**Type consistency:** `buildJsonbOrderBy`/`buildNamedJsonbOrderBy`/`JsonbSortSpec`/`JsonbOrderByResult`/`NamedOrderByResult` names match across order-by.ts, index.ts exports, and tests; `positionalToNamed` returns `{ sql, params }` and is consumed as such in both `toNamedParams` (Task 1) and `buildNamedJsonbOrderBy` (Task 4); `SCALAR_CASTS` name matches between base.ts (export) and legacy.ts + order-by.ts (import); `INVALID_SORT` spelling matches between errors.ts and order-by.ts throws.
