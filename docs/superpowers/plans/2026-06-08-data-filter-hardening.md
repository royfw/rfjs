# @rfjs/data-filter Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed correctness bugs, hot-path performance issues, silent-failure footguns, and public-type holes in the published `@rfjs/data-filter@0.1.0`, while keeping its scalar API stable and aligned with `@rfjs/jsonb-query`.

**Architecture:** `@rfjs/data-filter` turns a filter-metadata tree into a boolean match in memory. A `FilterMatchQuery` group (`and`/`or`/`nor`/`not`) holds `MatchQueryMetadata` conditions; `createMatchQuery` dispatches each condition by `dataType` to one of four Match classes (`TextMatch`/`NumericMatch`/`BooleanMatch`/`DateMatch`), which resolve the field via `resolvePath` (JSONPath + lodash fallback) and apply the operator. This plan changes those classes' operator semantics, the dispatcher, the path resolver, the `matchAndMap` pipeline, the alias helpers, and the public types — no new dataTypes (object/array/elemmatch parity is a separate future plan).

**Tech Stack:** TypeScript 5.7 (strict, `noUnusedLocals`, `noFallthroughCasesInSwitch`), Vitest 3, tsdown (bundles `src/index.ts` only), lodash, jsonpath-plus, `@rfjs/object-utils`.

**Decisions locked with the maintainer (2026-06-08):**
- **Q1 `neq` on array/wildcard targets → "value-absent" semantics.** `neq` matches only when the value is absent from the resolved targets. Single-value fields are unaffected. This rewrites 5 existing `BooleanMatch.spec` array-`neq` assertions (they encoded the opposite `∃`-intent).
- **Q2 invalid/mismatched operator → throw.** Unknown operators (typos), operators not valid for the `dataType`, and inherited prototype names (`toString`, `constructor`) all throw instead of silently returning `false` (or crashing).
- **Q3 scope → review priorities 1–5:** correctness (#1, #2, #3, #4, #8) + performance (P1, P2, P3, #5) + robustness guards (R1, R2) + nested-data type (T1) + discriminated-union metadata (T2). The discriminated union is shaped so `object`/`array`/`elemmatch` variants can be added later without breaking existing ones.

**Conventions for every task:**
- Run a single spec file with: `pnpm -F @rfjs/data-filter exec vitest run <path>`
- Run the whole package suite with: `pnpm -F @rfjs/data-filter test`
- Type-check with: `pnpm -F @rfjs/data-filter typecheck`
- Lint with: `pnpm -F @rfjs/data-filter lint`
- The repo pre-commit hook runs `turbo run lint-staged test --affected`, so each commit must be green. Commit subjects are lowercase (commitlint).

---

## File Structure

**Modified source:**
- `packages/data-filter/src/match/TextMatch.ts` — `neq` → value-absent (Task 1); operator validation (Task 8)
- `packages/data-filter/src/match/NumericMatch.ts` — `neq` value-absent (Task 1); `range` arity (Task 3); operator validation (Task 8)
- `packages/data-filter/src/match/BooleanMatch.ts` — `neq` value-absent (Task 1); operator validation (Task 8)
- `packages/data-filter/src/match/DateMatch.ts` — NaN-safe `eq`/`terms`/`neq` (Task 2); `range` arity (Task 3); operator validation (Task 8)
- `packages/data-filter/src/filter/matchQuery.ts` — boolean coercion in `typeTransfer` (Task 4); `createMatchQuery` switch + dataType throw, casts removed (Task 10)
- `packages/data-filter/src/filter/matchAndMap.ts` — loop-invariant clones, deferred row clone, dedup-by-source, `Map` type (Task 6)
- `packages/data-filter/src/path/resolve.ts` — non-wildcard fast-path in `resolvePath` (Task 5)
- `packages/data-filter/src/alias/aliasValue.ts` — optional precomputed lookup + `buildAliasLookup` (Task 7)
- `packages/data-filter/src/alias/aliasData.ts` — hoist lookup table (Task 7)
- `packages/data-filter/src/alias/index.ts` — export `buildAliasLookup` (Task 7)
- `packages/data-filter/src/types/filter.ts` — widen `ObjectData` (Task 9); discriminated `MatchQueryMetadata` (Task 10)

**Created source:**
- `packages/data-filter/src/match/operators.ts` — per-dataType operator allow-lists + `assertOperator` (Task 8)
- `packages/data-filter/src/types/filter.typetest.ts` — compile-time type assertions, checked by `tsc --noEmit`, never bundled (not imported by `index.ts`) nor published (Tasks 9, 10)

**Modified tests:**
- `packages/data-filter/src/match/BooleanMatch.spec.ts` — flip 5 array-`neq` assertions, add value-absent positive case (Task 1)

**Created tests:**
- `packages/data-filter/src/filter/matchQuery.spec.ts` — `typeTransfer` boolean (Task 4); `createMatchQuery` dataType throw (Task 10)
- `packages/data-filter/src/alias/aliasValue.spec.ts` — alias resolution + lookup (Task 7)
- New `describe` blocks appended to `TextMatch.spec.ts`, `NumericMatch.spec.ts`, `DateMatch.spec.ts` (Tasks 1, 2, 3, 8)

---

# Part A — Correctness

## Task 1: `neq` value-absent semantics (Text / Numeric / Boolean)

Fixes review #1 (high): on array/wildcard targets the old `neq = !eq()` (forall) wrongly kept rows that DO contain the value. New definition: **`neq` matches only when none of the filter values is present among the resolved targets.** Single-value fields are unchanged.

**Files:**
- Modify: `packages/data-filter/src/match/TextMatch.ts:58-63`
- Modify: `packages/data-filter/src/match/NumericMatch.ts:59-64`
- Modify: `packages/data-filter/src/match/BooleanMatch.ts:62-67`
- Modify (test): `packages/data-filter/src/match/BooleanMatch.spec.ts` (5 assertions + 1 new test)
- Test: append `describe` to `packages/data-filter/src/match/TextMatch.spec.ts`
- Test: append `describe` to `packages/data-filter/src/match/NumericMatch.spec.ts`

- [ ] **Step 1: Update the existing BooleanMatch array-`neq` assertions to the new semantics**

Five existing tests assert the OLD `∃` behavior. Under value-absent semantics, `neq false` on an array that CONTAINS `false` must now be `false`.

Edit `packages/data-filter/src/match/BooleanMatch.spec.ts`.

Replace the `booleanArray` test (around line 99):
```ts
            it('booleanArray bool: true', () => {
                const query = new BooleanMatch(
                    'a1.booleanArray',
                    'neq',
                    false,
                    testData1,
                );
                expect(query.isMatch).toEqual(true);
            });
```
with:
```ts
            it('booleanArray neq false: false (value present)', () => {
                // booleanArray = [true, false, true, false, false] contains
                // false, so "not equal to false" (value-absent) is false.
                const query = new BooleanMatch(
                    'a1.booleanArray',
                    'neq',
                    false,
                    testData1,
                );
                expect(query.isMatch).toEqual(false);
            });

            it('booleanArray neq false: true (value absent)', () => {
                const query = new BooleanMatch(
                    'a1.allTrue',
                    'neq',
                    false,
                    { a1: { allTrue: [true, true] } },
                );
                expect(query.isMatch).toEqual(true);
            });
```

Replace the `organizations[0].members[*].isAdmin` test (around line 264):
```ts
            const query = new BooleanMatch('organizations[0].members[*].isAdmin', 'neq', false, data);
            // 應該找到至少一個不是 false 的(即 true)
            expect(query.isMatch).toBe(true);
```
with:
```ts
            const query = new BooleanMatch('organizations[0].members[*].isAdmin', 'neq', false, data);
            // value-absent: members contain isAdmin=false, so neq false is false
            expect(query.isMatch).toBe(false);
```

Replace the `departments[*].teams[*].active` test (around line 287):
```ts
            const query = new BooleanMatch('departments[*].teams[*].active', 'neq', false, data);
            // 應該找到至少一個不是 false 的(即 true)
            expect(query.isMatch).toBe(true);
```
with:
```ts
            const query = new BooleanMatch('departments[*].teams[*].active', 'neq', false, data);
            // value-absent: an active=false exists, so neq false is false
            expect(query.isMatch).toBe(false);
```

Replace the `$..active` test (around line 321):
```ts
            const query = new BooleanMatch('$..active', 'neq', false, data);
            expect(query.isMatch).toBe(true);
```
with:
```ts
            const query = new BooleanMatch('$..active', 'neq', false, data);
            // value-absent: an active=false exists in the tree, so neq false is false
            expect(query.isMatch).toBe(false);
```

Replace the `departments[*].users[*].active` test (around line 369):
```ts
            const query = new BooleanMatch('departments[*].users[*].active', 'neq', false, data);
            expect(query.isMatch).toBe(true);
```
with:
```ts
            const query = new BooleanMatch('departments[*].users[*].active', 'neq', false, data);
            // value-absent: an active=false exists, so neq false is false
            expect(query.isMatch).toBe(false);
```

- [ ] **Step 2: Add value-absent `neq` tests for Text and Numeric (they currently have none)**

Append to `packages/data-filter/src/match/TextMatch.spec.ts` (inside the top-level `describe`, before its closing `});`):
```ts
    describe('neq (value-absent semantics)', () => {
        it('scalar: matches when the value differs', () => {
            expect(new TextMatch('name', 'neq', 'Bob', { name: 'Alice' }).isMatch).toBe(true);
        });
        it('scalar: no match when the value equals', () => {
            expect(new TextMatch('name', 'neq', 'Alice', { name: 'Alice' }).isMatch).toBe(false);
        });
        it('array: no match when the value is present', () => {
            expect(new TextMatch('tags', 'neq', 'B', { tags: ['A', 'B'] }).isMatch).toBe(false);
        });
        it('array: matches when the value is absent', () => {
            expect(new TextMatch('tags', 'neq', 'Z', { tags: ['A', 'B'] }).isMatch).toBe(true);
        });
    });
```
(Confirm the file imports `TextMatch` at the top; it does: `import { TextMatch } from './TextMatch';`.)

Append to `packages/data-filter/src/match/NumericMatch.spec.ts` (inside the top-level `describe`, before its closing `});`):
```ts
    describe('neq (value-absent semantics)', () => {
        it('scalar: matches when the value differs', () => {
            expect(new NumericMatch('n', 'neq', 5, { n: 3 }).isMatch).toBe(true);
        });
        it('scalar: no match when the value equals', () => {
            expect(new NumericMatch('n', 'neq', 3, { n: 3 }).isMatch).toBe(false);
        });
        it('array: no match when the value is present', () => {
            expect(new NumericMatch('a', 'neq', 2, { a: [1, 2, 3] }).isMatch).toBe(false);
        });
        it('array: matches when the value is absent', () => {
            expect(new NumericMatch('a', 'neq', 9, { a: [1, 2, 3] }).isMatch).toBe(true);
        });
    });
```

- [ ] **Step 3: Run the new/updated tests — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/TextMatch.spec.ts src/match/NumericMatch.spec.ts src/match/BooleanMatch.spec.ts`
Expected: the `array: no match when the value is present` cases FAIL (old `neq` returns `true`), and the flipped Boolean assertions FAIL.

- [ ] **Step 4: Implement value-absent `neq` in TextMatch**

In `packages/data-filter/src/match/TextMatch.ts`, replace:
```ts
    private neq() {
        const isMatch = !this.eq();
        const neqMatchs = this.values.filter((i) => !this.matchs.includes(i));
        this.matchs = neqMatchs;
        return isMatch;
    }
```
with:
```ts
    private neq() {
        // Matches only when every filter value is ABSENT from the resolved
        // targets. On a single-value field this is a plain "not equal"; on an
        // array/wildcard field it correctly rejects rows that contain the value
        // (the old `!eq()` used forall semantics and wrongly matched a present
        // value). Consistent with the other Match classes.
        this.matchs = this.values.filter(
            (value) => !this.targets.includes(value),
        );
        return this.matchs.length === this.values.length;
    }
```

- [ ] **Step 5: Implement value-absent `neq` in NumericMatch**

In `packages/data-filter/src/match/NumericMatch.ts`, replace:
```ts
    private neq() {
        const neq = !this.eq();
        const neqMatchs = this.values.filter((i) => !this.matchs.includes(i));
        this.matchs = neqMatchs;
        return neq;
    }
```
with:
```ts
    private neq() {
        this.matchs = this.values.filter(
            (value) => !this.targets.includes(value),
        );
        return this.matchs.length === this.values.length;
    }
```

- [ ] **Step 6: Implement value-absent `neq` in BooleanMatch**

In `packages/data-filter/src/match/BooleanMatch.ts`, replace:
```ts
    private neq() {
        const neq = !this.eq();
        const neqMatchs = this.values.filter((i) => !this.matchs.includes(i));
        this.matchs = neqMatchs;
        return neq;
    }
```
with:
```ts
    private neq() {
        this.matchs = this.values.filter(
            (value) => !this.targets.includes(value),
        );
        return this.matchs.length === this.values.length;
    }
```

- [ ] **Step 7: Run the suite — expect PASS**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/TextMatch.spec.ts src/match/NumericMatch.spec.ts src/match/BooleanMatch.spec.ts`
Expected: PASS. Then `pnpm -F @rfjs/data-filter test` — all green.

- [ ] **Step 8: Commit**

```bash
git add packages/data-filter/src/match/TextMatch.ts packages/data-filter/src/match/NumericMatch.ts packages/data-filter/src/match/BooleanMatch.ts packages/data-filter/src/match/TextMatch.spec.ts packages/data-filter/src/match/NumericMatch.spec.ts packages/data-filter/src/match/BooleanMatch.spec.ts
git commit -m "fix(data-filter): value-absent neq semantics on array targets"
```

---

## Task 2: NaN-safe DateMatch `eq` / `terms` / `neq`

Fixes review #2 (high) and #8 (low): `eq`/`terms` used `Array.includes`, where `[NaN].includes(NaN) === true`, so two unparseable dates compared equal; `neq` silently passed an unparseable filter value. Invalid dates (`NaN` timestamps) must never match.

**Files:**
- Modify: `packages/data-filter/src/match/DateMatch.ts:45-48` (eq), `:50-54` (neq), `:92-95` (terms)
- Test: append `describe` to `packages/data-filter/src/match/DateMatch.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/data-filter/src/match/DateMatch.spec.ts` (inside the top-level `describe('DateMatch', ...)`, before its closing `});`):
```ts
  describe('NaN / invalid dates', () => {
    it('eq: two unparseable dates do NOT match', () => {
      const q = new DateMatch('d', 'eq', 'garbage', { d: 'garbage' });
      expect(q.isMatch).toBe(false);
    });
    it('terms: an unparseable value does not match a valid date', () => {
      const q = new DateMatch('createdAt', 'terms', 'garbage', data);
      expect(q.isMatch).toBe(false);
    });
    it('neq: an unparseable filter value does not silently pass', () => {
      const q = new DateMatch('createdAt', 'neq', 'garbage', data);
      expect(q.isMatch).toBe(false);
    });
  });
```
(The `data` const at the top of the file is `{ createdAt: new Date('2024-06-15'), updatedAt: new Date('2024-01-01') }`.)

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/DateMatch.spec.ts`
Expected: `eq` and `neq` garbage cases FAIL (old code returns `true`).

- [ ] **Step 3: Implement NaN guards**

In `packages/data-filter/src/match/DateMatch.ts`, replace the `eq` method:
```ts
  private eq() {
    this.matchs = this.values.filter((cur) => this.targets.includes(cur));
    return this.matchs.length == this.values.length;
  }
```
with:
```ts
  private eq() {
    this.matchs = this.values.filter(
      (value) => !Number.isNaN(value) && this.targets.includes(value),
    );
    return this.matchs.length === this.values.length;
  }
```

Replace the `neq` method:
```ts
  private neq() {
    const eqMatchs = this.values.filter((cur) => this.targets.includes(cur));
    this.matchs = this.values.filter((i) => !eqMatchs.includes(i));
    return this.matchs.length > 0;
  }
```
with:
```ts
  private neq() {
    // value-absent + NaN-safe: an unparseable (NaN) filter value never matches.
    this.matchs = this.values.filter(
      (value) => !Number.isNaN(value) && !this.targets.includes(value),
    );
    return this.matchs.length === this.values.length;
  }
```

Replace the `terms` method:
```ts
  private terms() {
    this.matchs = this.values.filter((cur) => this.targets.includes(cur));
    return this.matchs.length > 0;
  }
```
with:
```ts
  private terms() {
    this.matchs = this.values.filter(
      (value) => !Number.isNaN(value) && this.targets.includes(value),
    );
    return this.matchs.length > 0;
  }
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/DateMatch.spec.ts`
Expected: PASS (existing eq/neq/terms date tests still pass; new NaN tests pass).

- [ ] **Step 5: Commit**

```bash
git add packages/data-filter/src/match/DateMatch.ts packages/data-filter/src/match/DateMatch.spec.ts
git commit -m "fix(data-filter): reject NaN timestamps in date eq/terms/neq"
```

---

## Task 3: `range` arity validation + no in-place mutation (Numeric / Date)

Fixes review #3 (medium): `range` assumed exactly 2 values (single value → never matched; 3+ values silently ignored) and sorted `this.values` in place. Per Q2, a wrong arity now throws.

**Files:**
- Modify: `packages/data-filter/src/match/NumericMatch.ts:158-173`
- Modify: `packages/data-filter/src/match/DateMatch.ts:84-90`
- Test: append to `packages/data-filter/src/match/NumericMatch.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/data-filter/src/match/NumericMatch.spec.ts` (inside the top-level `describe`, before its closing `});`):
```ts
    describe('range arity', () => {
        it('throws when range does not receive exactly 2 values', () => {
            expect(() => new NumericMatch('n', 'range', 5, { n: 10 })).toThrow(
                /exactly 2 values/,
            );
            expect(() => new NumericMatch('n', 'range', [1, 2, 3], { n: 10 })).toThrow(
                /exactly 2 values/,
            );
        });
        it('accepts reversed bounds via min/max', () => {
            expect(new NumericMatch('n', 'range', [120, 50], { n: 100 }).isMatch).toBe(true);
        });
    });
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/NumericMatch.spec.ts`
Expected: the `throws` test FAILS (old code returns `false`/does not throw).

- [ ] **Step 3: Implement NumericMatch.range**

In `packages/data-filter/src/match/NumericMatch.ts`, replace:
```ts
    private range() {
        const sortVals = this.values.sort((a, b) => a - b);
        const s = sortVals[0];
        const b = sortVals[1];
        const matchs = this.targets.reduce(
            (pre, cur) => {
                if (cur >= s && cur <= b) {
                    pre.push(true);
                }
                return pre;
            },
            <boolean[]>[],
        );
        const isMatchCount = matchs.length;
        return isMatchCount > 0;
    }
```
with:
```ts
    private range() {
        if (this.values.length !== 2) {
            throw new Error(
                `[data-filter] range operator requires exactly 2 values, received ${this.values.length}`,
            );
        }
        const [lo, hi] = [...this.values].sort((a, b) => a - b);
        this.matchs = this.targets.filter(
            (target) => target >= lo && target <= hi,
        );
        return this.matchs.length > 0;
    }
```

- [ ] **Step 4: Implement DateMatch.range**

In `packages/data-filter/src/match/DateMatch.ts`, replace:
```ts
  private range() {
    const sortVals = this.values.sort((a, b) => a - b);
    const start = sortVals[0];
    const end = sortVals[1];
    this.matchs = this.targets.filter((cur) => cur >= start && cur <= end);
    return this.matchs.length > 0;
  }
```
with:
```ts
  private range() {
    if (this.values.length !== 2) {
      throw new Error(
        `[data-filter] range operator requires exactly 2 values, received ${this.values.length}`,
      );
    }
    const [lo, hi] = [...this.values].sort((a, b) => a - b);
    this.matchs = this.targets.filter((target) => target >= lo && target <= hi);
    return this.matchs.length > 0;
  }
```

- [ ] **Step 5: Run — expect PASS**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/NumericMatch.spec.ts src/match/DateMatch.spec.ts`
Expected: PASS (existing 2-value range tests still pass).

- [ ] **Step 6: Commit**

```bash
git add packages/data-filter/src/match/NumericMatch.ts packages/data-filter/src/match/DateMatch.ts packages/data-filter/src/match/NumericMatch.spec.ts
git commit -m "fix(data-filter): validate range arity and stop mutating values"
```

---

## Task 4: Boolean coercion in `typeTransfer`

Fixes review #4 (medium): only lowercase `'true'`/`'false'` were parsed; everything else went through `Boolean(value)`, so `'False'`, `'FALSE'`, `'0'`, `'no'`, `'off'` all became `true`.

**Files:**
- Modify: `packages/data-filter/src/filter/matchQuery.ts:141-145`
- Create (test): `packages/data-filter/src/filter/matchQuery.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/data-filter/src/filter/matchQuery.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { typeTransfer } from './matchQuery';

describe('typeTransfer boolean coercion', () => {
  it('parses explicit false tokens to false', () => {
    expect(typeTransfer('false', 'boolean')).toBe(false);
    expect(typeTransfer('False', 'boolean')).toBe(false);
    expect(typeTransfer('FALSE', 'boolean')).toBe(false);
    expect(typeTransfer('0', 'boolean')).toBe(false);
    expect(typeTransfer('no', 'boolean')).toBe(false);
    expect(typeTransfer('off', 'boolean')).toBe(false);
  });

  it('keeps truthy tokens true', () => {
    expect(typeTransfer('true', 'boolean')).toBe(true);
    expect(typeTransfer('1', 'boolean')).toBe(true);
    expect(typeTransfer('yes', 'boolean')).toBe(true);
  });

  it('passes through actual booleans', () => {
    expect(typeTransfer(true, 'boolean')).toBe(true);
    expect(typeTransfer(false, 'boolean')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/filter/matchQuery.spec.ts`
Expected: `'False'`/`'FALSE'`/`'0'`/`'no'`/`'off'` cases FAIL (old code returns `true`).

- [ ] **Step 3: Implement the coercion**

In `packages/data-filter/src/filter/matchQuery.ts`, replace:
```ts
    boolean: () =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ['true', 'false'].includes(value as string)
        ? JSON.parse(value as string)
        : Boolean(value),
```
with:
```ts
    boolean: () => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value).trim().toLowerCase();
      // Everything that is not an explicit falsy token is truthy. Fixes the old
      // Boolean('false')/Boolean('0') === true footgun.
      return !['false', '0', 'no', 'off', '', 'null', 'undefined'].includes(
        normalized,
      );
    },
```

- [ ] **Step 4: Run — expect PASS (and confirm no regression in BooleanMatch)**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/filter/matchQuery.spec.ts src/match/BooleanMatch.spec.ts`
Expected: PASS. (The existing `'boolean stringbool: true'` test — `'true'` → `true` — still holds.)

- [ ] **Step 5: Commit**

```bash
git add packages/data-filter/src/filter/matchQuery.ts packages/data-filter/src/filter/matchQuery.spec.ts
git commit -m "fix(data-filter): correct boolean coercion for false-like strings"
```

---

# Part B — Performance

## Task 5: `resolvePath` non-wildcard fast-path

Fixes review P1 (high): plain dotted paths went through the jsonpath-plus engine for every field of every condition of every row (~5× slower than `_.get`). Plain lookups over a real object now skip the engine. Behavior is preserved (including the `fallbackToLodash:false`-throws contract for nullish data, which falls through to the engine).

**Files:**
- Modify: `packages/data-filter/src/path/resolve.ts:19-52` (`resolvePath` only; `resolvePathDetail` unchanged)
- Test: append to `packages/data-filter/src/path/resolve.spec.ts`

- [ ] **Step 1: Write a characterization test (guards the refactor)**

This is a performance refactor with no behavior change, so the test documents the preserved contract rather than going red first. Append to `packages/data-filter/src/path/resolve.spec.ts` (inside `describe('resolvePath', ...)`, before its closing `});`):
```ts
    describe('non-wildcard fast path', () => {
        it('resolves a plain nested path', () => {
            expect(resolvePath({ a: { b: 'v' } }, 'a.b')).toBe('v');
        });
        it('returns undefined for a missing plain path (default options)', () => {
            expect(resolvePath({ a: {} }, 'a.b')).toBeUndefined();
        });
        it('returns null for a missing plain path when fallbackOnEmpty=false', () => {
            expect(
                resolvePath({ a: {} }, 'a.b', { fallbackOnEmpty: false }),
            ).toBeNull();
        });
        it('still throws for nullish data when fallbackToLodash=false', () => {
            expect(() =>
                resolvePath(null as unknown, 'some.path', {
                    fallbackToLodash: false,
                }),
            ).toThrow();
        });
    });
```

- [ ] **Step 2: Run — expect PASS before the change (characterization baseline)**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/path/resolve.spec.ts`
Expected: PASS (these all hold under the current engine-based implementation too).

- [ ] **Step 3: Add the fast-path**

In `packages/data-filter/src/path/resolve.ts`, inside `resolvePath`, locate:
```ts
  const hasWildcard = hasWildcardSyntax(path);

  try {
    const jsonPath = path.startsWith('$') ? path : `$.${path}`;
```
and insert the fast-path block between `hasWildcard` and `try` so it reads:
```ts
  const hasWildcard = hasWildcardSyntax(path);

  // Fast path: a plain (non-wildcard) lookup over a real object/array never
  // needs the jsonpath-plus engine. `_.get` is ~5x faster and returns the
  // identical value the engine path would (which falls back to `_.get` anyway).
  // Nullish `data` falls through so the engine's error contract is preserved.
  if (!hasWildcard && data != null) {
    return fallbackOnEmpty ? _.get(data, path) : _.get(data, path) ?? null;
  }

  try {
    const jsonPath = path.startsWith('$') ? path : `$.${path}`;
```

- [ ] **Step 4: Run the full suite — expect PASS**

Run: `pnpm -F @rfjs/data-filter test`
Expected: PASS — `resolve.spec.ts` (incl. the `null`-data throw test at line ~160 and the `fallbackOnEmpty` tests) and all Match specs stay green.

- [ ] **Step 5: Commit**

```bash
git add packages/data-filter/src/path/resolve.ts packages/data-filter/src/path/resolve.spec.ts
git commit -m "perf(data-filter): skip jsonpath engine for plain paths"
```

---

## Task 6: `matchAndMap` — drop redundant clones, defer row clone, fix dedup

Fixes review P2 (high), #5 (medium dedup bug), T6 (low type): the function deep-cloned the row, the filter, and the mappings for every (row × metadata) pair — and `aliasData` clones internally too, so the filter/mappings were cloned twice. The dedup `Map<number, T>` was keyed by a fresh clone per pair, so a row matched by two metadata appeared twice. New behavior: clone the row only after it matches; let `aliasData` own the filter/mapping clone; dedup by the **source row reference** (last mapping wins).

**Files:**
- Modify: `packages/data-filter/src/filter/matchAndMap.ts:8-44`
- Test: append to `packages/data-filter/src/filter/matchAndMap.spec.ts`

- [ ] **Step 1: Write the failing dedup test**

Append to `packages/data-filter/src/filter/matchAndMap.spec.ts` (inside `describe('matchAndMap', ...)`, before its closing `});`):
```ts
  it('dedupes a row matched by multiple metadata (last mapping wins)', () => {
    const filterData = [{ name: 'alice', tag: 'old' }];
    const metas: FilterMappingMetadata[] = [
      {
        filter: {
          logic: 'and',
          filters: [
            { field: 'data.name', dataType: 'string', operator: 'eq', value: 'alice' },
          ],
        },
        mappings: [{ key: 'tag', type: 'value', value: 'first' }],
      },
      {
        filter: {
          logic: 'and',
          filters: [
            { field: 'data.name', dataType: 'string', operator: 'eq', value: 'alice' },
          ],
        },
        mappings: [{ key: 'tag', type: 'value', value: 'second' }],
      },
    ];
    const result = matchAndMap<{ name: string; tag: string }>(filterData, metas);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe('second');
  });
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/filter/matchAndMap.spec.ts`
Expected: FAIL — current code returns length `2` (two distinct clone keys).

- [ ] **Step 3: Rewrite the `matchAndMap` body**

In `packages/data-filter/src/filter/matchAndMap.ts`, replace the whole function:
```ts
export function matchAndMap<T>(
  filterData: any[],
  filterMetadatas: FilterMappingMetadata[],
  exData: AnyObjectData = {},
  dataKey = 'data',
): T[] {
  if (filterMetadatas.length == 0) {
    return filterData as T[];
  }
  const matchUserOrderItemMap = filterMetadatas.reduce((pre, cur) => {
    const { filter, mappings } = cur;
    for (const item of filterData) {
      const _item = _.cloneDeep(item);
      const data: AnyObjectData = {
        ...exData,
        // Use the clone so mapping writes (genMappingDataByValue) and any
        // alias resolution never mutate the caller's original input object.
        [dataKey]: _item,
      };
      const convertFilter = aliasData<FilterMatchQuery>(
        _.cloneDeep(filter),
        data,
      );
      const convertMapping = aliasData<MappingValue[]>(
        _.cloneDeep(mappings ?? []),
        data,
      );
      if (matchQuery(data, convertFilter)) {
        const matchData = genItemMappingData(dataKey, data, convertMapping);
        pre.set(_item, matchData as T);
      }
    }
    return pre;
  }, new Map<number, T>());

  return Array.from(matchUserOrderItemMap.values());
}
```
with:
```ts
export function matchAndMap<T>(
  filterData: AnyObjectData[],
  filterMetadatas: FilterMappingMetadata[],
  exData: AnyObjectData = {},
  dataKey = 'data',
): T[] {
  if (filterMetadatas.length === 0) {
    return filterData as T[];
  }
  // Keyed by the ORIGINAL source row so a row matched by several metadata is
  // emitted once (last matching metadata's mapping wins). `aliasData` clones
  // the filter/mappings internally, so we pass them as-is (no extra clone), and
  // matching is read-only, so we only deep-clone the row once it matches.
  const matched = new Map<AnyObjectData, T>();
  for (const { filter, mappings } of filterMetadatas) {
    for (const item of filterData) {
      const source: AnyObjectData = { ...exData, [dataKey]: item };
      const convertFilter = aliasData<FilterMatchQuery>(filter, source);
      if (!matchQuery(source, convertFilter)) continue;

      const clonedItem = _.cloneDeep(item);
      const mapped: AnyObjectData = { ...exData, [dataKey]: clonedItem };
      const convertMapping = aliasData<MappingValue[]>(mappings ?? [], mapped);
      const matchData = genItemMappingData(dataKey, mapped, convertMapping);
      matched.set(item, matchData as T);
    }
  }
  return Array.from(matched.values());
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/filter/matchAndMap.spec.ts`
Expected: PASS — the two existing tests (mapping applied; caller input not mutated) and the new dedup test all pass.

- [ ] **Step 5: Type-check (the `Map`/param types changed)**

Run: `pnpm -F @rfjs/data-filter typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/data-filter/src/filter/matchAndMap.ts packages/data-filter/src/filter/matchAndMap.spec.ts
git commit -m "perf(data-filter): defer row clone and dedupe by source row in matchAndMap"
```

---

## Task 7: `aliasValue` loop-invariant lookup table

Fixes review P3 (medium): `aliasValue` rebuilt `{ ...source, ...flatten(source) }` for every aliased string leaf, even though `source` is constant across one `aliasData` call. Hoist it to a single `buildAliasLookup(source)` per call. Also creates the missing `aliasValue` spec.

**Files:**
- Modify: `packages/data-filter/src/alias/aliasValue.ts`
- Modify: `packages/data-filter/src/alias/aliasData.ts`
- Modify: `packages/data-filter/src/alias/index.ts`
- Create (test): `packages/data-filter/src/alias/aliasValue.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/data-filter/src/alias/aliasValue.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { aliasValue, buildAliasLookup } from './aliasValue';

describe('aliasValue', () => {
  it('resolves a flat ${name} placeholder', () => {
    expect(aliasValue('${name}', { name: 'Alice' })).toBe('Alice');
  });
  it('resolves a nested ${user.name} placeholder', () => {
    expect(aliasValue('${user.name}', { user: { name: 'Bob' } })).toBe('Bob');
  });
  it('resolves the $name short form', () => {
    expect(aliasValue('$age', { age: 30 })).toBe(30);
  });
  it('returns undefined when the key is missing', () => {
    expect(aliasValue('${missing}', { a: 1 })).toBeUndefined();
  });
  it('produces the same result with a precomputed lookup', () => {
    const source = { user: { name: 'Carol' } };
    const lookup = buildAliasLookup(source);
    expect(aliasValue('${user.name}', source, lookup)).toBe('Carol');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/alias/aliasValue.spec.ts`
Expected: FAIL — `buildAliasLookup` is not exported yet (import error).

- [ ] **Step 3: Add `buildAliasLookup` and the optional lookup param**

In `packages/data-filter/src/alias/aliasValue.ts`, replace the whole file:
```ts
import _ from 'lodash';
import { aliasRegex } from './aliasRegex';
import { flatten } from '@rfjs/object-utils';

export type ObjectData = { [key: string]: any };

/** Precompute the `{ ...source, ...flatten(source) }` lookup once per call. */
export const buildAliasLookup = (data: ObjectData): ObjectData => ({
  ...data,
  ...flatten(data),
});

export const aliasValue = (
  alias: string,
  data: ObjectData,
  lookup?: ObjectData,
): any => {
  const matchAll = alias.matchAll(aliasRegex);
  const aliasData: ObjectData = lookup ?? buildAliasLookup(data);
  let aliasValue = undefined;
  for (const regex of matchAll) {
    const key = regex[1] || regex[2];
    const flattenValue = aliasData[key];
    const _value = _.get(data, key);
    if (flattenValue !== undefined || _value !== undefined) {
      aliasValue = _value ?? flattenValue;
      break;
    }
  }
  return aliasValue;
};
```

- [ ] **Step 4: Hoist the lookup in `aliasData`**

In `packages/data-filter/src/alias/aliasData.ts`, replace:
```ts
import _ from 'lodash';
import { aliasValue } from './aliasValue';
import { flatten } from '@rfjs/object-utils';

export type ObjectData = { [key: string]: any };

export function aliasData<T>(
  aliasDataParam: ObjectData,
  source: ObjectData,
): T {
  // Work on a copy so the caller's input object is never mutated.
  const result = _.cloneDeep(aliasDataParam);
  const flattenAlias = flatten(result);
  for (const [key, value] of Object.entries(flattenAlias)) {
    if (!_.isString(value)) continue;
    const getAliasValue = aliasValue(value, source);
    if (_.isUndefined(getAliasValue)) continue;
    _.set(result, key, getAliasValue);
  }
  return result as T;
}
```
with:
```ts
import _ from 'lodash';
import { aliasValue, buildAliasLookup } from './aliasValue';
import { flatten } from '@rfjs/object-utils';

export type ObjectData = { [key: string]: any };

export function aliasData<T>(
  aliasDataParam: ObjectData,
  source: ObjectData,
): T {
  // Work on a copy so the caller's input object is never mutated.
  const result = _.cloneDeep(aliasDataParam);
  const flattenAlias = flatten(result);
  // `source` is constant across the loop, so build its lookup table once.
  const lookup = buildAliasLookup(source);
  for (const [key, value] of Object.entries(flattenAlias)) {
    if (!_.isString(value)) continue;
    const getAliasValue = aliasValue(value, source, lookup);
    if (_.isUndefined(getAliasValue)) continue;
    _.set(result, key, getAliasValue);
  }
  return result as T;
}
```

- [ ] **Step 5: Export `buildAliasLookup`**

In `packages/data-filter/src/alias/index.ts`, replace:
```ts
export { aliasRegex } from './aliasRegex';
export { aliasValue } from './aliasValue';
export { aliasData } from './aliasData';
```
with:
```ts
export { aliasRegex } from './aliasRegex';
export { aliasValue, buildAliasLookup } from './aliasValue';
export { aliasData } from './aliasData';
```

- [ ] **Step 6: Run — expect PASS**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/alias/aliasValue.spec.ts src/alias/aliasData.spec.ts src/filter/matchAndMap.spec.ts`
Expected: PASS (alias behavior unchanged; `matchAndMap`, which uses `aliasData`, still green).

- [ ] **Step 7: Commit**

```bash
git add packages/data-filter/src/alias/aliasValue.ts packages/data-filter/src/alias/aliasData.ts packages/data-filter/src/alias/index.ts packages/data-filter/src/alias/aliasValue.spec.ts
git commit -m "perf(data-filter): hoist alias lookup table out of per-leaf loop"
```

---

# Part C — Robustness

## Task 8: Operator allow-list + throw on invalid operator

Fixes review R1 (medium) and R2 (medium): the Match classes dispatched via `this[this.operator]()`, so a typo or type-mismatched operator silently returned `false`, and an inherited prototype name (`toString` → truthy string; `constructor` → crash) corrupted results. Per Q2, invalid operators now throw.

**Files:**
- Create: `packages/data-filter/src/match/operators.ts`
- Modify: `packages/data-filter/src/match/TextMatch.ts:30-32`
- Modify: `packages/data-filter/src/match/NumericMatch.ts:31-33`
- Modify: `packages/data-filter/src/match/BooleanMatch.ts:34-36`
- Modify: `packages/data-filter/src/match/DateMatch.ts:35-37`
- Test: append to `packages/data-filter/src/match/NumericMatch.spec.ts` and `packages/data-filter/src/match/BooleanMatch.spec.ts`

- [ ] **Step 1: Create the operator allow-lists**

Create `packages/data-filter/src/match/operators.ts`:
```ts
export const STRING_OPERATORS = [
  'eq',
  'neq',
  'isnull',
  'isnotnull',
  'contains',
  'startswith',
  'endswith',
  'terms',
] as const;

export const NUMERIC_OPERATORS = [
  'eq',
  'neq',
  'isnull',
  'isnotnull',
  'gt',
  'gte',
  'lt',
  'lte',
  'range',
  'terms',
] as const;

export const DATE_OPERATORS = NUMERIC_OPERATORS;

export const BOOLEAN_OPERATORS = [
  'eq',
  'neq',
  'isnull',
  'isnotnull',
] as const;

/**
 * Throw if `operator` is not valid for `dataType`. Guards against typos,
 * type-mismatched operators, and inherited prototype names (`toString`,
 * `constructor`, …) being dispatched as match logic.
 */
export function assertOperator(
  dataType: string,
  operator: string,
  allowed: readonly string[],
): void {
  if (!allowed.includes(operator)) {
    throw new Error(
      `[data-filter] unsupported operator '${operator}' for dataType '${dataType}'`,
    );
  }
}
```

- [ ] **Step 2: Write the failing tests**

Append to `packages/data-filter/src/match/NumericMatch.spec.ts` (inside the top-level `describe`, before its closing `});`):
```ts
    describe('operator validation', () => {
        it('throws on a type-mismatched operator', () => {
            expect(
                () => new NumericMatch('a', 'contains' as never, 1, { a: 1 }),
            ).toThrow(/unsupported operator/);
        });
        it('throws on a prototype method name used as operator', () => {
            expect(
                () => new NumericMatch('a', 'toString' as never, 1, { a: 1 }),
            ).toThrow(/unsupported operator/);
        });
    });
```

Append to `packages/data-filter/src/match/BooleanMatch.spec.ts` (inside the top-level `describe`, before its closing `});`):
```ts
        describe('operator validation', () => {
            it('throws on a type-mismatched operator', () => {
                expect(
                    () => new BooleanMatch('a1.boolean', 'range' as never, true, testData1),
                ).toThrow(/unsupported operator/);
            });
        });
```

- [ ] **Step 3: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/NumericMatch.spec.ts src/match/BooleanMatch.spec.ts`
Expected: FAIL — old code silently leaves `isMatch=false` (no throw); `'toString'` may even not throw.

- [ ] **Step 4: Add validation to TextMatch**

In `packages/data-filter/src/match/TextMatch.ts`, add the import after the existing imports:
```ts
import { STRING_OPERATORS, assertOperator } from './operators';
```
Then replace the dispatch guard:
```ts
        if (typeof this[this.operator] == 'function') {
            this.isMatch = this[this.operator]();
        }
```
with:
```ts
        assertOperator('string', this.operator, STRING_OPERATORS);
        this.isMatch = this[this.operator]();
```

- [ ] **Step 5: Add validation to NumericMatch**

In `packages/data-filter/src/match/NumericMatch.ts`, add after the existing imports:
```ts
import { NUMERIC_OPERATORS, assertOperator } from './operators';
```
Then replace:
```ts
        if (typeof this[this.operator] == 'function') {
            this.isMatch = this[this.operator]();
        }
```
with:
```ts
        assertOperator('numeric', this.operator, NUMERIC_OPERATORS);
        this.isMatch = this[this.operator]();
```

- [ ] **Step 6: Add validation to BooleanMatch**

In `packages/data-filter/src/match/BooleanMatch.ts`, add after the existing imports:
```ts
import { BOOLEAN_OPERATORS, assertOperator } from './operators';
```
Then replace:
```ts
        if (typeof this[this.operator] == 'function') {
            this.isMatch = this[this.operator]();
        }
```
with:
```ts
        assertOperator('boolean', this.operator, BOOLEAN_OPERATORS);
        this.isMatch = this[this.operator]();
```

- [ ] **Step 7: Add validation to DateMatch**

In `packages/data-filter/src/match/DateMatch.ts`, add after the existing imports:
```ts
import { DATE_OPERATORS, assertOperator } from './operators';
```
Then replace:
```ts
    if (typeof this[this.operator] == 'function') {
      this.isMatch = this[this.operator]();
    }
```
with:
```ts
    assertOperator('date', this.operator, DATE_OPERATORS);
    this.isMatch = this[this.operator]();
```

- [ ] **Step 8: Run — expect PASS**

Run: `pnpm -F @rfjs/data-filter test`
Expected: PASS — new throw tests pass; all existing valid-operator tests still pass (every operator used in the specs is in its type's allow-list).

- [ ] **Step 9: Commit**

```bash
git add packages/data-filter/src/match/operators.ts packages/data-filter/src/match/TextMatch.ts packages/data-filter/src/match/NumericMatch.ts packages/data-filter/src/match/BooleanMatch.ts packages/data-filter/src/match/DateMatch.ts packages/data-filter/src/match/NumericMatch.spec.ts packages/data-filter/src/match/BooleanMatch.spec.ts
git commit -m "fix(data-filter): throw on unsupported operator instead of silent no-match"
```

---

# Part D — Type Safety

## Task 9: Widen `ObjectData` to accept nested data (T1)

Fixes review T1 (high): the public `ObjectData = Record<string, ValueType>` cannot describe nested objects/arrays, yet `users[*].name` wildcard queries are the flagship feature — so `const data: ObjectData[] = [{ users: [{ name: 'a' }] }]` failed to compile. The compile-time gate is a type-test file checked by `tsc --noEmit` (excluded from the bundle and the published `files`).

**Files:**
- Modify: `packages/data-filter/src/types/filter.ts:77-79`
- Create: `packages/data-filter/src/types/filter.typetest.ts`

- [ ] **Step 1: Write the failing type test**

Create `packages/data-filter/src/types/filter.typetest.ts`:
```ts
// Compile-time assertions for the public types. Checked by `tsc --noEmit`;
// never imported by src/index.ts, so it is not bundled or published.
import type { ObjectData } from './filter';

// T1: nested objects and arrays of objects must be assignable to ObjectData.
export const nestedData: ObjectData[] = [
  {
    id: 1,
    active: true,
    tags: ['a', 'b'],
    users: [{ name: 'Alice', age: 30 }],
  },
];
```

- [ ] **Step 2: Type-check — expect FAIL**

Run: `pnpm -F @rfjs/data-filter typecheck`
Expected: FAIL — `users: [{ name: 'Alice', age: 30 }]` is not assignable to `Record<string, ValueType>` (`TS2322`).

- [ ] **Step 3: Widen `ObjectData`**

In `packages/data-filter/src/types/filter.ts`, replace:
```ts
export type ObjectData = {
  [key: string]: ValueType;
};
```
with:
```ts
/**
 * An input record to filter. Values may be scalars, nested records, arrays of
 * scalars, or arrays of records — JSONPath/lodash resolve arbitrary depth at
 * runtime, so the data type is intentionally permissive.
 */
export type ObjectData = {
  [key: string]: ValueType | ObjectData | ObjectData[] | null;
};
```

- [ ] **Step 4: Type-check — expect PASS**

Run: `pnpm -F @rfjs/data-filter typecheck`
Expected: no errors.

- [ ] **Step 5: Run the suite (widening must not change runtime)**

Run: `pnpm -F @rfjs/data-filter test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/data-filter/src/types/filter.ts packages/data-filter/src/types/filter.typetest.ts
git commit -m "fix(data-filter): allow nested data in public ObjectData type"
```

---

## Task 10: Discriminated-union `MatchQueryMetadata` (T2)

Fixes review T2 (medium): `operator` was a flat union accepted for every `dataType`, so `{ dataType: 'boolean', operator: 'range' }` compiled (then failed at runtime). A union discriminated by `dataType` makes each type accept only its own operators (compile error otherwise) and lets `createMatchQuery` drop its four `operator as X` casts. The union shape is additive — future `object`/`array`/`elemmatch` variants slot in without breaking these.

**Files:**
- Modify: `packages/data-filter/src/types/filter.ts:8-26`
- Modify: `packages/data-filter/src/filter/matchQuery.ts:88-124`
- Modify: `packages/data-filter/src/types/filter.typetest.ts` (append)
- Test: append to `packages/data-filter/src/filter/matchQuery.spec.ts`

- [ ] **Step 1: Write the failing type test (negative assertion)**

Append to `packages/data-filter/src/types/filter.typetest.ts`:
```ts
import type { MatchQueryMetadata } from './filter';

// T2 positive: valid type/operator combos compile.
export const numericRange: MatchQueryMetadata = {
  field: 'age',
  dataType: 'numeric',
  operator: 'range',
  value: [1, 2],
};

// T2 negative: boolean does not allow 'range'. The @ts-expect-error must be
// CONSUMED (i.e. there must really be an error here) once the union lands.
export const badBooleanRange: MatchQueryMetadata = {
  field: 'flag',
  dataType: 'boolean',
  // @ts-expect-error boolean dataType does not support the 'range' operator
  operator: 'range',
  value: true,
};
```

- [ ] **Step 2: Type-check — expect FAIL**

Run: `pnpm -F @rfjs/data-filter typecheck`
Expected: FAIL — with the current flat union `operator: 'range'` is allowed for `boolean`, so there is no error for `@ts-expect-error` to consume → `TS2578: Unused '@ts-expect-error' directive`.

- [ ] **Step 3: Replace `MatchQueryMetadata` with a discriminated union**

In `packages/data-filter/src/types/filter.ts`, replace:
```ts
export type MatchQueryMetadata = {
  field: string;
  dataType: MatchQueryDataType;
  // Any filter operator is accepted; the runtime dispatches by `dataType`.
  // Written as a flat union (rather than Text|Numeric|Date, which overlap on
  // DefaultFilterOperator + `terms`) so the type carries no redundant members.
  operator:
    | DefaultFilterOperator
    | 'contains'
    | 'startswith'
    | 'endswith'
    | 'terms'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'range';
  value: ValueType;
};
```
with:
```ts
export interface StringCondition {
  field: string;
  dataType: 'string';
  operator: TextFilterOperator;
  value: ValueType;
}

export interface NumericCondition {
  field: string;
  dataType: 'numeric';
  operator: NumericFilterOperator;
  value: ValueType;
}

export interface DateCondition {
  field: string;
  dataType: 'date';
  operator: DateFilterOperator;
  value: ValueType;
}

export interface BooleanCondition {
  field: string;
  dataType: 'boolean';
  operator: BooleanFilterOperator;
  value: ValueType;
}

/**
 * A single field condition, discriminated by `dataType` so each data type only
 * accepts its own operators. Future object/array/elemmatch variants are added
 * to this union (mirroring `@rfjs/jsonb-query`) without breaking existing ones.
 */
export type MatchQueryMetadata =
  | StringCondition
  | NumericCondition
  | DateCondition
  | BooleanCondition;
```
(`MatchQueryDataType`, `TextFilterOperator`, `NumericFilterOperator`, `DateFilterOperator`, and `BooleanFilterOperator` already exist above in this file; keep them.)

- [ ] **Step 4: Refactor `createMatchQuery` to a narrowing switch (drop the casts) + dataType throw**

In `packages/data-filter/src/filter/matchQuery.ts`, replace:
```ts
export function createMatchQuery(
  data: ObjectData,
  metadata: MatchQueryMetadata,
): TextMatch | NumericMatch | BooleanMatch | DateMatch {
  const { field, operator, value, dataType } = metadata;
  const query = {
    string: () =>
      new TextMatch(
        field,
        operator as TextFilterOperator,
        value,
        data,
      ),
    numeric: () =>
      new NumericMatch(
        field,
        operator as NumericFilterOperator,
        value,
        data,
      ),
    boolean: () =>
      new BooleanMatch(
        field,
        operator as BooleanFilterOperator,
        value,
        data,
      ),
    date: () =>
      new DateMatch(
        field,
        operator as DateFilterOperator,
        value,
        data,
      ),
  };
  return query[dataType]();
}
```
with:
```ts
export function createMatchQuery(
  data: ObjectData,
  metadata: MatchQueryMetadata,
): TextMatch | NumericMatch | BooleanMatch | DateMatch {
  switch (metadata.dataType) {
    case 'string':
      return new TextMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'numeric':
      return new NumericMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'boolean':
      return new BooleanMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'date':
      return new DateMatch(metadata.field, metadata.operator, metadata.value, data);
    default:
      throw new Error(
        `[data-filter] unsupported dataType '${String((metadata as { dataType: unknown }).dataType)}'`,
      );
  }
}
```
Then remove the now-unused operator-type imports from the top-of-file `import type { ... } from '../types';` block — delete these four names: `TextFilterOperator`, `NumericFilterOperator`, `BooleanFilterOperator`, `DateFilterOperator` (leave `DataType`, `ObjectData`, `FilterMatchQuery`, `MatchQueryMetadata`, `LogicalOperator`). This avoids `noUnusedLocals` errors.

- [ ] **Step 5: Add the runtime dataType-throw test**

Append to `packages/data-filter/src/filter/matchQuery.spec.ts`:
```ts
import { createMatchQuery } from './matchQuery';
import type { MatchQueryMetadata } from '../types';

describe('createMatchQuery dataType validation', () => {
  it('throws on an unsupported dataType', () => {
    const bad = {
      field: 'a',
      dataType: 'mystery',
      operator: 'eq',
      value: 1,
    } as unknown as MatchQueryMetadata;
    expect(() => createMatchQuery({ a: 1 }, bad)).toThrow(/unsupported dataType/);
  });
});
```

- [ ] **Step 6: Type-check and run — expect PASS**

Run: `pnpm -F @rfjs/data-filter typecheck`
Expected: no errors (the `@ts-expect-error` in the type test is now consumed; `createMatchQuery` has no casts and the switch is exhaustive).

Run: `pnpm -F @rfjs/data-filter test`
Expected: PASS — all specs (which use only valid type/operator combos) stay green; the new dataType-throw test passes.

- [ ] **Step 7: Lint the whole package**

Run: `pnpm -F @rfjs/data-filter lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/data-filter/src/types/filter.ts packages/data-filter/src/types/filter.typetest.ts packages/data-filter/src/filter/matchQuery.ts packages/data-filter/src/filter/matchQuery.spec.ts
git commit -m "refactor(data-filter): discriminated-union metadata, drop operator casts"
```

---

## Final verification

- [ ] **Run the full package gate**

```bash
pnpm -F @rfjs/data-filter lint
pnpm -F @rfjs/data-filter typecheck
pnpm -F @rfjs/data-filter test
pnpm -F @rfjs/data-filter build
```
Expected: all pass; `build` emits `dist/` with no reference to `filter.typetest.ts`.

- [ ] **Add a changeset (minor bump — new behavior + new exports, no breaking type change for valid usage)**

```bash
pnpm changeset:add
```
Choose `@rfjs/data-filter` → `minor`. Summary suggestion:
`data-filter: value-absent neq on arrays, NaN-safe dates, range/boolean fixes, throw on invalid operator, faster path resolution, nested-data type, discriminated-union metadata`.

Do NOT run `changeset version`/`publish` locally — versioning and publish go through CI (PR into `release/*`, then GitLab/`publish/npmjs`), per `CLAUDE.md`.

---

## Self-Review

**Scope coverage (review priorities 1–5, per Q3):**
- #1 array `neq` → Task 1 ✓ | #2 Date NaN → Task 2 ✓ | #3 `range` → Task 3 ✓ | #4 boolean coercion → Task 4 ✓ | #8 Date `neq` NaN → Task 2 ✓
- P1 `resolvePath` → Task 5 ✓ | P2/#5/T6 `matchAndMap` → Task 6 ✓ | P3 `aliasValue` → Task 7 ✓
- R1/R2 operator throw → Task 8 ✓
- T1 nested data → Task 9 ✓ | T2 discriminated union → Task 10 ✓

**Type/name consistency:** `assertOperator(dataType, operator, allowed)` is defined in Task 8 and called identically in all four Match classes; `buildAliasLookup` defined in Task 7 and used in `aliasData` + exported; `MatchQueryMetadata` union members (`StringCondition`/…) defined in Task 10 and consumed by the Task 10 `createMatchQuery` switch.

**Test-breakage accounted for:** the 5 `BooleanMatch.spec` array-`neq` assertions (Task 1) are the only existing tests whose expectations change; all other tasks only add tests or are behavior-preserving. No existing spec passes an out-of-allow-list operator or a non-2-arity `range`, so Tasks 3 and 8's throws break nothing.

**Deferred to a separate plan (NOT in scope):**
- M1 — `object` / `array` (+ `elementType`) / `elemmatch` dataTypes and an extracted shared `@rfjs/filter-types` package (large; the Task 10 union is pre-shaped for it).
- M2 / #6 — README documentation of array `∀`/`∃` semantics and the new `neq` (docs-only; was Q3 option C).
- M4 case-insensitive text, M5 `in`/`notin`, M6 `matchQueryExplain`, T3 dataType-vocabulary unification, T5 barrel narrowing (breaking), T4/T7 remaining `any`, P4 lodash slimming, P5/P6 minor perf, R3/R4/R5 alias/path docs, R6 empty-group alignment.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-08-data-filter-hardening.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
