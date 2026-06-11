# data-filter `=`-Expression Integration + jsonpath Removal (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed `@rfjs/data-expr` computed `=`-slots into `@rfjs/data-filter` (async compiled matching + `matchAndMapAsync`) and remove `jsonpath-plus` (resolvePath becomes `_.get`-only with fail-fast guards). Breaking wave, per the approved spec.

**Architecture:** New async entry points (`compileMatchQuery`/`matchQueryAsync`/`matchAndMapAsync`) compile `=`-expressions **once** via `data-expr.compile` and reuse the existing sync `createMatchQuery` machinery per row (an `=`-field's computed value is fed through a synthetic `{ __expr__: value }` object — the same trick `ArrayMatch` uses). The sync APIs **throw** on `=`-slots (fail-fast, pointing at the async API). `resolve.ts` drops the jsonpath engine: plain paths via `_.get`, wildcard/`$`-prefix/script paths throw with guidance; `resolvePathDetail` and the `fallbackToLodash` option are deleted; the legacy wildcard test blocks are removed. Spec: `docs/superpowers/specs/2026-06-11-data-expr-design.md`.

**Tech Stack:** TypeScript 5.7 (strict), Vitest 3, `@rfjs/data-expr` (workspace), lodash. Branch: `feat/data-filter-expr` (already created off main, which contains data-expr via PR #134).

**Locked API decisions (from the spec; concrete names chosen here):**
- `compileMatchQuery(filterQuery, options?) → (data) => Promise<boolean>` — compile-once predicate.
- `matchQueryAsync(data, filterQuery, options?)` — one-shot convenience.
- `matchAndMapAsync(filterData, metadatas, exData?, dataKey?, options?)` — mapping `=`-values are compiled **once per metadata** (outside the row loop); the filter is matched per row via `matchQueryAsync` (it still goes through per-row `${}` alias substitution, so per-row compilation there is accepted for v1).
- Sync `matchQuery`/`createMatchQuery`/`matchAndMap` **throw** on `=`-slots.
- `=` inside **elemmatch sub-filters is unsupported in v1** — it reaches the sync guard and throws the same clear error (documented).
- A literal string value that must START with `=` is written as a JSONata string expression: `value: "='=foo'"`.
- New `resolvePath` guard message: `[data-filter] unsupported path syntax '<path>': wildcard/jsonpath forms were removed — use dataType 'array'/'elemmatch', or an '=' expression`.

**Conventions for every task:**
- One spec: `pnpm -F @rfjs/data-filter exec vitest run <path>` · whole package: `pnpm -F @rfjs/data-filter test` · typecheck/lint/build: `pnpm -F @rfjs/data-filter typecheck|lint|build`.
- Pre-commit hook runs tests — every commit must be green. Commit subjects lowercase.
- Only Task 6 adds a changeset.

---

## File Structure

- **Modify** `package.json` (+`@rfjs/data-expr`, −`jsonpath-plus`), `pnpm-lock.yaml` (Tasks 1, 2).
- **Replace** `src/path/resolve.ts` and `src/path/resolve.spec.ts` (Task 2).
- **Modify** `src/types/filter.ts` (drop `fallbackToLodash`, delete `PathResolveResult`) (Task 2).
- **Delete blocks** in `src/match/TextMatch.spec.ts`, `src/match/NumericMatch.spec.ts`, `src/match/BooleanMatch.spec.ts`, `src/filter/matchQueryArray.spec.ts` (Task 2).
- **Modify** `src/filter/matchQuery.ts` (export `logicMatchQuery`; `=`-slot guard in `createMatchQuery`) and `src/filter/matchAndMap.ts` (`=`-mapping guard) (Task 3).
- **Create** `src/filter/compileMatchQuery.ts` (+ `.spec.ts`) (Task 4).
- **Create** `src/filter/matchAndMapAsync.ts` (+ `.spec.ts`) (Task 5).
- **Modify** `src/filter/index.ts` (barrel) (Tasks 4–5), `README.md` + `README.zh-TW.md`, `.changeset/data-filter-expr-slots.md` (Task 6).

---

## Task 1: Add the `@rfjs/data-expr` dependency

- [ ] **Step 1: Edit `packages/data-filter/package.json` dependencies**

Change the `dependencies` block from:
```json
  "dependencies": {
    "@rfjs/object-utils": "workspace:*",
    "jsonpath-plus": "^10.0.0",
    "lodash": "^4.17.21"
  }
```
to:
```json
  "dependencies": {
    "@rfjs/data-expr": "workspace:*",
    "@rfjs/object-utils": "workspace:*",
    "jsonpath-plus": "^10.0.0",
    "lodash": "^4.17.21"
  }
```
(`jsonpath-plus` is removed in Task 2, not here — keeps each commit green and reviewable.)

- [ ] **Step 2: Install + sanity**

Run (repo root): `pnpm install`
Expected: `packages/data-filter/node_modules/@rfjs/data-expr` is symlinked. If `packages/data-expr/dist` does not exist, run `pnpm -F @rfjs/data-expr build` first (data-filter consumes its dist).
Run: `pnpm -F @rfjs/data-filter typecheck && pnpm -F @rfjs/data-filter test`
Expected: clean / all green (no behavior change yet).

- [ ] **Step 3: Commit**

```bash
git add packages/data-filter/package.json pnpm-lock.yaml
git commit -m "chore(data-filter): add data-expr dependency"
```

---

## Task 2: Remove jsonpath — `_.get`-only `resolvePath` + test migration

One atomic commit: the engine removal and the legacy-test removal must land together (the hook runs tests).

- [ ] **Step 1: Replace the ENTIRE contents of `packages/data-filter/src/path/resolve.ts`**

```ts
import _ from 'lodash';
import type { PathResolveOptions } from '../types';

export function hasWildcardSyntax(path: string): boolean {
  return (
    path.includes('*') ||
    /\[[^\]]*,/.test(path) ||
    path.includes('..') ||
    /\[[^\]]*:/.test(path) ||
    /\[\?/.test(path)
  );
}

/**
 * Throw on path forms the removed jsonpath engine used to handle: wildcard
 * syntax, `$`-prefixed roots (which `_.get` would silently resolve to
 * undefined), and `[(...)]` script expressions.
 */
export function assertSupportedPath(path: string): void {
  if (hasWildcardSyntax(path) || path.startsWith('$') || /\[\(/.test(path)) {
    throw new Error(
      `[data-filter] unsupported path syntax '${path}': wildcard/jsonpath forms were removed — use dataType 'array'/'elemmatch', or an '=' expression`,
    );
  }
}

/**
 * Resolve a plain dot/bracket path with lodash `_.get`. A literal key that
 * contains a dot or comma still resolves when it exists directly on the object
 * (lodash checks the direct key first). With `fallbackOnEmpty: false`, a
 * missing path yields `null` instead of `undefined`.
 */
export function resolvePath(
  data: unknown,
  path: string,
  options: PathResolveOptions = {},
): unknown {
  const { fallbackOnEmpty = true } = options;
  assertSupportedPath(path);
  const value: unknown = _.get(data, path);
  return fallbackOnEmpty ? value : value ?? null;
}
```
(`resolvePathDetail` is deleted; the jsonpath-plus import is gone.)

- [ ] **Step 2: Update `packages/data-filter/src/types/filter.ts`**

Replace:
```ts
export interface PathResolveOptions {
  fallbackToLodash?: boolean;
  fallbackOnEmpty?: boolean;
}

export interface PathResolveResult {
  value: unknown;
  usedJsonPath: boolean;
  isWildcardResult: boolean;
}
```
with:
```ts
export interface PathResolveOptions {
  /** When false, a missing path resolves to null instead of undefined. */
  fallbackOnEmpty?: boolean;
}
```

- [ ] **Step 3: Replace the ENTIRE contents of `packages/data-filter/src/path/resolve.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { resolvePath, assertSupportedPath } from './resolve';

const testData = {
  user: { name: 'Alice' },
  users: [
    { name: 'Alice', tags: ['a'] },
    { name: 'Bob', tags: ['b', 'c'] },
  ],
  metadata: { 'tag,version': 'v1' },
  'a.b': 'literal-dot-key',
};

describe('resolvePath (plain paths via _.get)', () => {
  it('resolves dotted paths and single indexes', () => {
    expect(resolvePath(testData, 'user.name')).toBe('Alice');
    expect(resolvePath(testData, 'users[0].name')).toBe('Alice');
    expect(resolvePath(testData, 'users[1].tags[0]')).toBe('b');
  });
  it('resolves literal keys containing a comma or dot (direct-key check)', () => {
    expect(resolvePath(testData, 'metadata.tag,version')).toBe('v1');
    expect(resolvePath(testData, 'a.b')).toBe('literal-dot-key');
  });
  it('missing path: undefined by default, null with fallbackOnEmpty=false', () => {
    expect(resolvePath(testData, 'user.nope')).toBeUndefined();
    expect(resolvePath(testData, 'user.nope', { fallbackOnEmpty: false })).toBeNull();
  });
  it('nullish data resolves to undefined', () => {
    expect(resolvePath(null, 'a.b')).toBeUndefined();
    expect(resolvePath(undefined, 'a')).toBeUndefined();
  });
  it('preserves stored null values', () => {
    expect(resolvePath({ value: null }, 'value')).toBeNull();
  });
});

describe('removed jsonpath forms throw with guidance', () => {
  const removed = [
    'users[*].name',
    '$..name',
    'users[?(@.age > 25)].name',
    'users[0:2].name',
    'users[0,1].name',
    '$.user.name',
    'users[(@.length-1)].name',
  ];
  for (const path of removed) {
    it(`throws for '${path}'`, () => {
      expect(() => resolvePath(testData, path)).toThrow(/unsupported path syntax/);
    });
  }
  it('assertSupportedPath accepts plain paths', () => {
    expect(() => assertSupportedPath('a.b[0].c')).not.toThrow();
  });
});
```

- [ ] **Step 4: Delete the legacy wildcard describe-blocks (exact ranges, verified against current files)**

For each deletion: the range starts at the `describe(` line and ends at that block's own closing `});` — the boundary context is given so you can confirm before cutting. After each file, run the verification grep.

(a) `src/match/TextMatch.spec.ts` (955 lines):
   - Delete `describe('萬用字元查詢支援', …)` — lines **548–725** (the block's `});` at 725; KEEP line 726 `    });`, which closes `describe('TextMatch')`).
   - Then delete `describe('JSONPath 進階查詢測試', …)` — originally lines **728–896** (after the first deletion the numbers shift up by 178; locate by name).
(b) `src/match/NumericMatch.spec.ts` (726 lines):
   - Delete `describe('萬用字元查詢支援', …)` — lines **405–522** (KEEP line 523 `    });`, closing `describe('NumericMatch')`).
   - Delete `describe('JSONPath 進階查詢測試', …)` — originally lines **543–698** (locate by name after the shift; the block sits between `describe('neq (value-absent semantics)')` and `describe('range arity')`).
(c) `src/match/BooleanMatch.spec.ts` (423 lines):
   - Delete `describe('萬用字元查詢支援', …)` — lines **216–311**.
   - Delete `describe('JSONPath 進階查詢測試', …)` — originally lines **313–409** (KEEP the `describe('operator validation')` block that follows).
(d) `src/filter/matchQueryArray.spec.ts` (719 lines):
   - Delete the top-level `describe('JSONPath 進階查詢測試', …)` — lines **539–719** (through end of file; 540 is the describe, 539 is its preceding blank line).

Verification for each of the four files:
```bash
grep -n "\[\*\]\|\\$\.\.\|\[?(\|\[0:\|\[-1:\|\[0," <file>
```
Expected: **no output** for all four.

- [ ] **Step 5: Remove the `jsonpath-plus` dependency**

In `packages/data-filter/package.json`, delete the line `"jsonpath-plus": "^10.0.0",` from `dependencies`. Run (repo root): `pnpm install`.
Verify it is gone from the tree: `grep -rn "jsonpath-plus" packages/data-filter/src packages/data-filter/package.json` → no output, and `ls packages/data-filter/node_modules/jsonpath-plus` → not found.

- [ ] **Step 6: Full suite — expect PASS**

Run: `pnpm -F @rfjs/data-filter test && pnpm -F @rfjs/data-filter typecheck && pnpm -F @rfjs/data-filter lint`
Expected: all green. The surviving suites (scalar matchers minus wildcard blocks, collection types incl. its wildcard-throws test, hasWildcardSyntax, the new resolve.spec) pass. If any remaining test still uses a wildcard path, it throws — fix by deleting that test (it belongs to the removed capability); record it in notes.

- [ ] **Step 7: Commit**

```bash
git add -A packages/data-filter pnpm-lock.yaml
git commit -m "feat(data-filter)!: remove jsonpath engine — plain paths only, wildcard throws"
```

---

## Task 3: Sync-API guards for `=`-slots (+ export `logicMatchQuery`)

- [ ] **Step 1: Write the failing tests**

Create `packages/data-filter/src/filter/exprGuards.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchQuery } from './matchQuery';
import { matchAndMap } from './matchAndMap';
import type { FilterMatchQuery } from '../types';

const wrap = (cond: unknown): FilterMatchQuery =>
  ({ logic: 'and', filters: [cond] } as FilterMatchQuery);

describe('sync apis reject "=" expression slots', () => {
  it('matchQuery throws on an "=" field', () => {
    expect(() =>
      matchQuery({ items: [] }, wrap({ field: '=$sum(items.amount)', dataType: 'numeric', operator: 'gt', value: 1 })),
    ).toThrow(/async api/);
  });
  it('matchQuery throws on an "=" value', () => {
    expect(() =>
      matchQuery({ n: 1 }, wrap({ field: 'n', dataType: 'numeric', operator: 'gt', value: '=$count(items)' })),
    ).toThrow(/async api/);
  });
  it('matchAndMap throws on an "=" mapping value', () => {
    expect(() =>
      matchAndMap(
        [{ name: 'alice', qty: 3 }],
        [{
          filter: wrap({ field: 'data.name', dataType: 'string', operator: 'eq', value: 'alice' }),
          mappings: [{ key: 'bonus', type: 'value', value: '=500 * data.qty' }],
        }],
      ),
    ).toThrow(/async api/);
  });
  it('a plain "="-free filter still works synchronously', () => {
    expect(matchQuery({ n: 5 }, wrap({ field: 'n', dataType: 'numeric', operator: 'gt', value: 1 }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/filter/exprGuards.spec.ts`
Expected: the three throw-tests FAIL (no guards yet — the `=` strings are treated as a literal path/value today).

- [ ] **Step 3: Implement the guards**

In `packages/data-filter/src/filter/matchQuery.ts`:

(a) Add the import after the existing imports:
```ts
import { isExpression } from '@rfjs/data-expr';
```
(b) Change `function logicMatchQuery(` to `export function logicMatchQuery(` (needed by Task 4).
(c) At the TOP of `createMatchQuery`'s body (before the `switch`), insert:
```ts
  if (
    isExpression(metadata.field) ||
    (typeof metadata.value === 'string' && isExpression(metadata.value))
  ) {
    throw new Error(
      `[data-filter] '=' expression slots require the async api — use compileMatchQuery or matchQueryAsync`,
    );
  }
```

In `packages/data-filter/src/filter/matchAndMap.ts`:

(a) Add the import after the existing imports:
```ts
import { isExpression } from '@rfjs/data-expr';
```
(b) In `matchAndMap`, right after the `if (filterMetadatas.length === 0)` early return, insert:
```ts
  for (const metadata of filterMetadatas) {
    const hasExprMapping = (metadata.mappings ?? []).some(
      (mapping) => typeof mapping.value === 'string' && isExpression(mapping.value),
    );
    if (hasExprMapping) {
      throw new Error(
        `[data-filter] '=' expression mapping values require the async api — use matchAndMapAsync`,
      );
    }
  }
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/filter/exprGuards.spec.ts`
Then the full suite + typecheck: `pnpm -F @rfjs/data-filter test && pnpm -F @rfjs/data-filter typecheck`
Expected: all green (no existing test uses a leading-`=` string).

- [ ] **Step 5: Commit**

```bash
git add packages/data-filter/src/filter/matchQuery.ts packages/data-filter/src/filter/matchAndMap.ts packages/data-filter/src/filter/exprGuards.spec.ts
git commit -m "feat(data-filter): reject expression slots in sync apis"
```

---

## Task 4: `compileMatchQuery` + `matchQueryAsync`

- [ ] **Step 1: Write the failing tests**

Create `packages/data-filter/src/filter/compileMatchQuery.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { compileMatchQuery, matchQueryAsync } from './compileMatchQuery';
import type { FilterMatchQuery } from '../types';

const wrap = (cond: unknown): FilterMatchQuery =>
  ({ logic: 'and', filters: [cond] } as FilterMatchQuery);

const order = {
  items: [
    { status: 'paid', amount: 400 },
    { status: 'open', amount: 700 },
    { status: 'paid', amount: 700 },
  ],
  paidTarget: 2,
};

describe('compileMatchQuery / matchQueryAsync', () => {
  it('computed "=" field compared by the normal operator machinery', async () => {
    const matches = compileMatchQuery(
      wrap({ field: '=$sum(items.amount)', dataType: 'numeric', operator: 'gt', value: 1000 }),
    );
    expect(await matches(order)).toBe(true);
    expect(await matches({ items: [{ amount: 1 }] })).toBe(false);
  });
  it('computed "=" value (count-where on the RHS)', async () => {
    expect(
      await matchQueryAsync(order, wrap({
        field: 'paidTarget', dataType: 'numeric', operator: 'eq',
        value: "=$count(items[status='paid'])",
      })),
    ).toBe(true);
  });
  it('plain conditions and group logic behave exactly like the sync api', async () => {
    const filter: FilterMatchQuery = {
      logic: 'or',
      filters: [
        { field: 'paidTarget', dataType: 'numeric', operator: 'gt', value: 99 },
        { field: '=$count(items)', dataType: 'numeric', operator: 'eq', value: 3 },
      ] as never,
    };
    expect(await matchQueryAsync(order, filter)).toBe(true);
  });
  it('an undefined expression result is a no-match (and fires onUndefined)', async () => {
    const seen: string[] = [];
    const matches = compileMatchQuery(
      wrap({ field: '=nope.nothing', dataType: 'numeric', operator: 'gt', value: 0 }),
      { onUndefined: (e) => seen.push(e) },
    );
    expect(await matches(order)).toBe(false);
    expect(seen).toEqual(['nope.nothing']);
  });
  it('a malformed expression throws at COMPILE time (kind compile)', () => {
    expect(() =>
      compileMatchQuery(wrap({ field: '=$sum((', dataType: 'numeric', operator: 'gt', value: 0 })),
    ).toThrow(/invalid expression/);
  });
  it('"=" inside an elemmatch sub-filter is unsupported and throws clearly', async () => {
    const matches = compileMatchQuery(
      wrap({
        field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
        filters: wrap({ field: '=amount * 2', dataType: 'numeric', operator: 'gt', value: 100 }),
      }),
    );
    await expect(matches(order)).rejects.toThrow(/async api/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/filter/compileMatchQuery.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/data-filter/src/filter/compileMatchQuery.ts`:
```ts
import { compile, isExpression, stripExpressionPrefix } from '@rfjs/data-expr';
import type { CompiledExpr, ExprOptions } from '@rfjs/data-expr';
import { createMatchQuery, logicMatchQuery } from './matchQuery';
import type { FilterMatchQuery, MatchQueryMetadata, ObjectData } from '../types';

/** Synthetic path under which a computed "="-field value is fed to the matchers. */
const EXPR_FIELD = '__expr__';

export type CompiledMatchQuery = (data: ObjectData) => Promise<boolean>;

/**
 * Compile a filter tree once: every "="-expression is parsed a single time
 * (data-expr compile-once contract); plain conditions reuse the sync matcher
 * machinery per row. Throws DataExprError(kind 'compile') immediately on a
 * malformed expression. NOTE: "=" inside elemmatch sub-filters is unsupported
 * (they evaluate through the sync matcher, whose guard throws).
 */
export function compileMatchQuery(
  filterQuery: FilterMatchQuery,
  options?: ExprOptions,
): CompiledMatchQuery {
  const children = filterQuery.filters.map((node) =>
    'logic' in node
      ? compileMatchQuery(node, options)
      : compileCondition(node, options),
  );
  return async (data) => {
    const results: boolean[] = [];
    for (const child of children) {
      results.push(await child(data));
    }
    return logicMatchQuery(filterQuery.logic, results);
  };
}

/** One-shot convenience: compile + evaluate once. Prefer compileMatchQuery for row loops. */
export async function matchQueryAsync(
  data: ObjectData,
  filterQuery: FilterMatchQuery,
  options?: ExprOptions,
): Promise<boolean> {
  return compileMatchQuery(filterQuery, options)(data);
}

function compileCondition(
  metadata: MatchQueryMetadata,
  options?: ExprOptions,
): CompiledMatchQuery {
  const rawValue = (metadata as { value?: unknown }).value;
  const fieldExpr: CompiledExpr | null = isExpression(metadata.field)
    ? compile(stripExpressionPrefix(metadata.field), options)
    : null;
  const valueExpr: CompiledExpr | null =
    typeof rawValue === 'string' && isExpression(rawValue)
      ? compile(stripExpressionPrefix(rawValue), options)
      : null;

  if (!fieldExpr && !valueExpr) {
    return (data) => Promise.resolve(createMatchQuery(data, metadata).isMatch);
  }

  return async (data) => {
    // Computed results replace the slot before the (sync) matcher runs; the
    // casts are unavoidable — expression results are only known at runtime.
    const value = valueExpr ? await valueExpr.evaluate(data) : rawValue;
    if (fieldExpr) {
      const target = await fieldExpr.evaluate(data);
      const synthetic = { [EXPR_FIELD]: target } as ObjectData;
      const substituted = { ...metadata, field: EXPR_FIELD, value } as MatchQueryMetadata;
      return createMatchQuery(synthetic, substituted).isMatch;
    }
    const substituted = { ...metadata, value } as MatchQueryMetadata;
    return createMatchQuery(data, substituted).isMatch;
  };
}
```

- [ ] **Step 4: Export from the filter barrel**

`packages/data-filter/src/filter/index.ts` — add a line so it reads:
```ts
export * from './matchQuery';
export * from './matchAndMap';
export * from './compileMatchQuery';
```

- [ ] **Step 5: Run — expect PASS + typecheck + lint**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/filter/compileMatchQuery.spec.ts`
Then: `pnpm -F @rfjs/data-filter test && pnpm -F @rfjs/data-filter typecheck && pnpm -F @rfjs/data-filter lint`
Expected: all green, lint 0 errors.

- [ ] **Step 6: Commit**

```bash
git add packages/data-filter/src/filter/compileMatchQuery.ts packages/data-filter/src/filter/compileMatchQuery.spec.ts packages/data-filter/src/filter/index.ts
git commit -m "feat(data-filter): add compilematchquery and matchqueryasync for expression slots"
```

---

## Task 5: `matchAndMapAsync`

- [ ] **Step 1: Write the failing tests**

Create `packages/data-filter/src/filter/matchAndMapAsync.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchAndMapAsync } from './matchAndMapAsync';
import type { FilterMappingMetadata } from './matchAndMap';

const aliceFilter: FilterMappingMetadata['filter'] = {
  logic: 'and',
  filters: [{ field: 'data.name', dataType: 'string', operator: 'eq', value: 'alice' }],
};

describe('matchAndMapAsync', () => {
  it('computes an "=" mapping value (the BPM times case)', async () => {
    const result = await matchAndMapAsync<{ name: string; bonus: number }>(
      [{ name: 'alice', qty: 3 }],
      [{ filter: aliceFilter, mappings: [{ key: 'bonus', type: 'value', value: '=500 * data.qty' }] }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].bonus).toBe(1500);
  });
  it('computes aggregates over the row', async () => {
    const result = await matchAndMapAsync<{ name: string; total: number }>(
      [{ name: 'alice', items: [{ amount: 100 }, { amount: 250 }] }],
      [{ filter: aliceFilter, mappings: [{ key: 'total', type: 'value', value: '=$sum(data.items.amount) * 2' }] }],
    );
    expect(result[0].total).toBe(700);
  });
  it('plain literal mappings and legacy ${} aliases still work', async () => {
    const result = await matchAndMapAsync<{ name: string; tag: string; copy: unknown }>(
      [{ name: 'alice', qty: 9 }],
      [{ filter: aliceFilter, mappings: [
        { key: 'tag', type: 'value', value: 'fixed' },
        { key: 'copy', type: 'value', value: '${data.qty}' },
      ] }],
    );
    expect(result[0].tag).toBe('fixed');
    expect(result[0].copy).toBe(9);
  });
  it('supports an "=" slot inside the FILTER too', async () => {
    const result = await matchAndMapAsync<{ name: string }>(
      [
        { name: 'a', items: [{ amount: 900 }, { amount: 200 }] },
        { name: 'b', items: [{ amount: 1 }] },
      ],
      [{ filter: {
        logic: 'and',
        filters: [{ field: '=$sum(data.items.amount)', dataType: 'numeric', operator: 'gt', value: 1000 } as never],
      } }],
    );
    expect(result.map((r) => r.name)).toEqual(['a']);
  });
  it('does not mutate caller input and dedupes by source row', async () => {
    const input = [{ name: 'alice', qty: 1 }];
    const result = await matchAndMapAsync(
      input,
      [
        { filter: aliceFilter, mappings: [{ key: 'bonus', type: 'value', value: '=1 * data.qty' }] },
        { filter: aliceFilter, mappings: [{ key: 'bonus', type: 'value', value: '=2 * data.qty' }] },
      ],
    );
    expect(input[0]).toEqual({ name: 'alice', qty: 1 });
    expect(result).toHaveLength(1);
    expect((result[0] as { bonus: number }).bonus).toBe(2); // last mapping wins
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/filter/matchAndMapAsync.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/data-filter/src/filter/matchAndMapAsync.ts`:
```ts
import _ from 'lodash';
import { compile, isExpression, stripExpressionPrefix } from '@rfjs/data-expr';
import type { CompiledExpr, ExprOptions } from '@rfjs/data-expr';
import { matchQueryAsync } from './compileMatchQuery';
import { aliasData } from '../alias/aliasData';
import type { FilterMatchQuery } from '../types';
import type { FilterMappingMetadata, MappingValue } from './matchAndMap';

type AnyObjectData = { [key: string]: any };

/**
 * Async variant of matchAndMap: mapping values (and filter slots) may be
 * "="-expressions. Mapping expressions are compiled ONCE per metadata (outside
 * the row loop); the filter still goes through per-row ${} alias substitution
 * and is matched via matchQueryAsync. Same contracts as matchAndMap otherwise:
 * caller input is never mutated, rows are deduped by source reference, the
 * last matching metadata's mapping wins.
 */
export async function matchAndMapAsync<T>(
  filterData: AnyObjectData[],
  filterMetadatas: FilterMappingMetadata[],
  exData: AnyObjectData = {},
  dataKey = 'data',
  options?: ExprOptions,
): Promise<T[]> {
  if (filterMetadatas.length === 0) {
    return filterData as T[];
  }

  const compiledMappings = filterMetadatas.map((metadata) =>
    (metadata.mappings ?? []).map((mapping) =>
      typeof mapping.value === 'string' && isExpression(mapping.value)
        ? compile(stripExpressionPrefix(mapping.value), options)
        : null,
    ),
  );

  const matched = new Map<AnyObjectData, T>();
  for (let m = 0; m < filterMetadatas.length; m += 1) {
    const { filter, mappings } = filterMetadatas[m];
    for (const item of filterData) {
      const source: AnyObjectData = { ...exData, [dataKey]: item };
      const convertFilter = aliasData<FilterMatchQuery>(filter, source);
      if (!(await matchQueryAsync(source, convertFilter, options))) continue;

      const clonedItem = _.cloneDeep(item);
      const mapped: AnyObjectData = { ...exData, [dataKey]: clonedItem };
      const convertMapping = aliasData<MappingValue[]>(mappings ?? [], mapped);
      for (let i = 0; i < convertMapping.length; i += 1) {
        const expr: CompiledExpr | null = compiledMappings[m][i];
        const { key, value } = convertMapping[i];
        mapped[dataKey][key] = expr ? await expr.evaluate(mapped) : value;
      }
      matched.set(item, _.get(mapped, dataKey) as T);
    }
  }
  return Array.from(matched.values());
}
```

- [ ] **Step 4: Export from the filter barrel**

`packages/data-filter/src/filter/index.ts` — append:
```ts
export * from './matchAndMapAsync';
```

- [ ] **Step 5: Run — expect PASS + full gate**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/filter/matchAndMapAsync.spec.ts`
Then: `pnpm -F @rfjs/data-filter test && pnpm -F @rfjs/data-filter typecheck && pnpm -F @rfjs/data-filter lint`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/data-filter/src/filter/matchAndMapAsync.ts packages/data-filter/src/filter/matchAndMapAsync.spec.ts packages/data-filter/src/filter/index.ts
git commit -m "feat(data-filter): add matchandmapasync with expression mapping values"
```

---

## Task 6: README updates + changeset + full gate

- [ ] **Step 1: Update `packages/data-filter/README.md`**

(a) Locate the `### Path Resolution` section (it documents `resolvePath` with a `users[*].name` wildcard example) and REPLACE that whole section with:
````markdown
### Path Resolution

#### `resolvePath(data, path, options)`

Resolve a plain dot/bracket path (lodash `_.get`). Wildcard/jsonpath forms
(`users[*].name`, `$..x`, `[?(...)]`, slices, unions, `$.` roots) are **not
supported and throw** — use `dataType: 'array'` / `elemmatch`, or an `=`
expression instead.

```typescript
import { resolvePath } from '@rfjs/data-filter';

resolvePath(data, 'a.b.c');
resolvePath(data, 'users[0].name');
resolvePath(data, 'user.missing', { fallbackOnEmpty: false }); // null instead of undefined
```
````

(b) Add a new section right before the `## Types` section:
````markdown
### Computed `=` expression slots (async)

A condition `field`/`value` — or a `matchAndMap` mapping `value` — that starts
with `=` is a computed [JSONata](https://jsonata.org) expression, powered by
[`@rfjs/data-expr`](../data-expr) (safe: no `eval`; DoS guards on by default).
Expressions require the **async** APIs; the sync APIs throw on `=`-slots.

```typescript
import { compileMatchQuery, matchQueryAsync, matchAndMapAsync } from '@rfjs/data-filter';

// compile once, run per row
const matches = compileMatchQuery({
  logic: 'and',
  filters: [{ field: '=$sum(items.amount)', dataType: 'numeric', operator: 'gt', value: 1000 }],
});
await matches(order);

// count-where on the value side
await matchQueryAsync(order, {
  logic: 'and',
  filters: [{ field: 'paidTarget', dataType: 'numeric', operator: 'eq', value: "=$count(items[status='paid'])" }],
});

// computed mapping values (replaces per-op mapping types like "times")
await matchAndMapAsync(rows, [{
  filter,
  mappings: [{ key: 'bonus', type: 'value', value: '=500 * data.qty' }],
}]);
```

Notes: inside an `=` expression use JSONata paths (not `${}` aliases); an
`undefined` result is a no-match (pass `onUndefined`/`strict` via the options
to observe or throw); `=` inside `elemmatch` sub-filters is not supported; a
literal value that must start with `=` can be written as `"='=foo'"`. See the
`@rfjs/data-expr` README for the JSONPath → JSONata mapping table.
````

(c) If any other wildcard examples remain in the README (search for `[*]`), remove or rewrite them the same way.

- [ ] **Step 2: Mirror both changes in `packages/data-filter/README.zh-TW.md`**

Same two sections in zh-TW (keep code blocks identical):
- 路徑解析改為「純路徑(`_.get`);wildcard/jsonpath 形式**不支援、會丟錯**——改用 `dataType:'array'`/`elemmatch` 或 `=` 運算式」。
- 新章節「計算型 `=` 運算式槽位(async)」:`field`/`value`/mapping `value` 以 `=` 開頭即為 JSONata 運算式(由 `@rfjs/data-expr` 驅動;無 eval、護欄預設開);必須用 async API(`compileMatchQuery`/`matchQueryAsync`/`matchAndMapAsync`),sync API 遇 `=` 丟錯;`=` 內用 JSONata 路徑(不用 `${}`);`undefined` 結果=不匹配(可用 `onUndefined`/`strict`);elemmatch 子條件內不支援 `=`;字面值要以 `=` 開頭寫成 `"='=foo'"`;對照表見 `@rfjs/data-expr` README。

- [ ] **Step 3: Add the changeset**

Create `.changeset/data-filter-expr-slots.md`:
```markdown
---
"@rfjs/data-filter": minor
---

Computed `=` expression slots + jsonpath removal (breaking — pre-1.0 minor).

**New:** a condition `field`/`value` or a `matchAndMap` mapping `value` starting with `=` is a
computed JSONata expression (via `@rfjs/data-expr`; no eval, DoS guards default-on). New async
APIs: `compileMatchQuery` (compile-once predicate), `matchQueryAsync`, `matchAndMapAsync`.
Sync APIs throw on `=`-slots.

**Breaking:** the jsonpath engine is removed. Wildcard/jsonpath `field` forms (`users[*].x`,
`$..x`, `[?(...)]`, slices, unions, `$.` roots) now **throw** — use `dataType: 'array'`/
`elemmatch`, or an `=` expression. `resolvePathDetail` and the `fallbackToLodash` option are
removed; `jsonpath-plus` is no longer a dependency.
```

- [ ] **Step 4: Full gate**

```bash
pnpm -F @rfjs/data-filter lint && pnpm -F @rfjs/data-filter typecheck && pnpm -F @rfjs/data-filter test && pnpm -F @rfjs/data-filter build
```
Expected: all green; `dist/index.d.ts` exports `compileMatchQuery`, `matchQueryAsync`,
`matchAndMapAsync` (plus the existing surface, minus `resolvePathDetail`/`PathResolveResult`).
`pnpm changeset status` lists `@rfjs/data-filter`. Do NOT run `changeset version`/`publish`.

- [ ] **Step 5: Commit**

```bash
git add packages/data-filter/README.md packages/data-filter/README.zh-TW.md .changeset/data-filter-expr-slots.md
git commit -m "docs(data-filter): document expression slots and jsonpath removal; add changeset"
```

---

## Self-Review

**Spec coverage (Phase 2 scope):**
- `=` field/value embedding with existing dataType/operator machinery → Task 4 (synthetic `__expr__` substitution) ✓
- mapping `=` values (Track B resolution, compile-once per metadata) → Task 5 ✓
- compile-once contract (expressions parsed at compileMatchQuery time; malformed → throws at compile) → Task 4 ✓
- sync APIs throw on `=` (fail-fast) → Task 3 ✓; `=`-in-elemmatch unsupported + clear throw → Task 4 test ✓
- `undefined` → no-match + `onUndefined` passthrough (decision 7) → Task 4 test ✓
- jsonpath removal: `_.get`-only resolvePath + wildcard/`$`/`[(` guard + `resolvePathDetail`/`fallbackToLodash` deletion + dep removal + wildcard-test migration (delete-by-block + guard tests) → Task 2 ✓
- plain slots keep the sync fast path untouched (Match classes unmodified) ✓
- README (both languages) + breaking changeset → Task 6 ✓

**Placeholder scan:** none — full code/ranges/commands everywhere; deletion ranges carry boundary context + verification greps.

**Type/name consistency:** `logicMatchQuery` exported in Task 3 and imported in Task 4; `compileMatchQuery`/`matchQueryAsync` (Task 4) used by Task 5; `FilterMappingMetadata`/`MappingValue` imported from `./matchAndMap` (existing exports); `assertSupportedPath`/`resolvePath` signatures consistent between Task 2 code and its spec; guard messages match the test regexes (`/async api/`, `/unsupported path syntax/`).

**Risk note:** Task 2's deletion line ranges were verified against the current files, but ranges shift after the first cut — each subsequent deletion is located **by describe name**, and every file gets a no-wildcard-left grep + a green test run before commit.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-11-data-filter-expr.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review.

**2. Inline Execution** — this session via executing-plans with checkpoints.

**Which approach?**
