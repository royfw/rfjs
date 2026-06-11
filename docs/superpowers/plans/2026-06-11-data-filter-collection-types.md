# data-filter object / array / elemmatch dataTypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add purely-additive `object`, `array` (scalar elementTypes), and `array`+`elementType:'object'` (`elemmatch`) dataTypes to `@rfjs/data-filter`'s in-memory matcher.

**Architecture:** New internal matchers (`ObjectMatch`, `ArrayMatch`, `ElemMatch`) + pure `objectCompare` helpers (`deepEqual`/`contains`). `createMatchQuery`'s switch gains `case 'object'`/`case 'array'` (array dispatches by `elementType`; `'object'` → `ElemMatch` with `matchQuery` **injected** to avoid an import cycle). Existing scalar matchers, `resolvePath`, and the scalar API are untouched. A wildcard `field` on these dataTypes throws. Spec: `docs/superpowers/specs/2026-06-11-data-filter-collection-types-design.md`.

**Tech Stack:** TypeScript 5.7 (strict, `noUnusedLocals`, `noFallthroughCasesInSwitch`), Vitest 3, tsdown. Branch: `feat/data-filter-collection-types` (already created off main; spec already committed there).

**Conventions for every task:**
- Run one spec: `pnpm -F @rfjs/data-filter exec vitest run <path>` · whole suite: `pnpm -F @rfjs/data-filter test` · typecheck: `pnpm -F @rfjs/data-filter typecheck` · lint: `pnpm -F @rfjs/data-filter lint` · build: `pnpm -F @rfjs/data-filter build`.
- Pre-commit hook runs tests; the tree must be green before committing. Commit subjects lowercase (commitlint).
- The matchers are **internal** (NOT added to `src/match/index.ts` / the public barrel). Only the new metadata **types** become public (Task 6). They take loosely-typed params (`operator: string`) validated at runtime by `assertOperator`; compile-time operator safety lives in the `MatchQueryMetadata` union (Task 6).
- `tsconfig.json` excludes `**/*(spec|test).ts` from `tsc`, so the compile-time type test (Task 6) is a **non-spec** `.ts` file (`filter.typetest.ts`).

---

## File Structure

- **Modify** `src/path/resolve.ts` — export `hasWildcardSyntax` (Task 1).
- **Create** `src/match/objectCompare.ts` (+ `.spec.ts`) — `deepEqual`, `contains`, `isPlainObject` (Task 2).
- **Create** `src/match/ObjectMatch.ts` (+ `.spec.ts`); **modify** `src/match/operators.ts` (+`OBJECT_OPERATORS`) (Task 3).
- **Create** `src/match/ArrayMatch.ts` (+ `.spec.ts`); **modify** `src/match/operators.ts` (+ array allow-lists) (Task 4).
- **Create** `src/match/ElemMatch.ts` (+ `.spec.ts`) (Task 5).
- **Modify** `src/types/filter.ts` (union + operator/condition types), `src/filter/matchQuery.ts` (dispatch + guard + return type), `src/types/filter.typetest.ts` (compile test); **create** `src/filter/collectionTypes.spec.ts` (matchQuery-level e2e) (Task 6).
- **Modify** `README.md`, `README.zh-TW.md`; **create** `.changeset/data-filter-collection-types.md` (Task 7).

---

## Task 1: Export `hasWildcardSyntax`

**Files:** Modify `src/path/resolve.ts:9`; Create `src/path/hasWildcardSyntax.spec.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/data-filter/src/path/hasWildcardSyntax.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hasWildcardSyntax } from './resolve';

describe('hasWildcardSyntax', () => {
  it('detects wildcard / multi-value syntax', () => {
    expect(hasWildcardSyntax('users[*].name')).toBe(true);
    expect(hasWildcardSyntax('$..name')).toBe(true);
    expect(hasWildcardSyntax('items[?(@.x)]')).toBe(true);
    expect(hasWildcardSyntax('items[0:2]')).toBe(true);
    expect(hasWildcardSyntax('items[0,1]')).toBe(true);
  });
  it('treats plain dotted / single-index paths as non-wildcard', () => {
    expect(hasWildcardSyntax('a.b')).toBe(false);
    expect(hasWildcardSyntax('users[0].tags')).toBe(false);
    expect(hasWildcardSyntax('tags')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/path/hasWildcardSyntax.spec.ts`
Expected: FAIL — `hasWildcardSyntax` is not exported (import is `undefined`).

- [ ] **Step 3: Export it**

In `packages/data-filter/src/path/resolve.ts`, change the declaration on line 9 from:
```ts
function hasWildcardSyntax(path: string): boolean {
```
to:
```ts
export function hasWildcardSyntax(path: string): boolean {
```
(Leave the body and all call sites unchanged.)

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/path/hasWildcardSyntax.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data-filter/src/path/resolve.ts packages/data-filter/src/path/hasWildcardSyntax.spec.ts
git commit -m "feat(data-filter): export hasWildcardSyntax"
```

---

## Task 2: `objectCompare` — `deepEqual` + `contains`

**Files:** Create `src/match/objectCompare.ts`, `src/match/objectCompare.spec.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/data-filter/src/match/objectCompare.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { deepEqual, contains } from './objectCompare';

describe('deepEqual', () => {
  it('compares primitives strictly (null/false/0/NaN distinct)', () => {
    expect(deepEqual(null, false)).toBe(false);
    expect(deepEqual(0, false)).toBe(false);
    expect(deepEqual(NaN, NaN)).toBe(false);
    expect(deepEqual('a', 'a')).toBe(true);
  });
  it('compares Dates by time', () => {
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-01'))).toBe(true);
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-02'))).toBe(false);
  });
  it('compares nested objects and arrays structurally', () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });
});

describe('contains', () => {
  it('matches when every key/value in value is present (recursive)', () => {
    expect(contains({ vip: true, level: 3 }, { vip: true })).toBe(true);
    expect(contains({ a: { x: 1, y: 2 } }, { a: { x: 1 } })).toBe(true);
  });
  it('uses strict deep-equal on leaves (null is not false)', () => {
    expect(contains({ vip: null, level: 3 }, { vip: false })).toBe(false);
    expect(contains({ vip: null }, { vip: null })).toBe(true);
  });
  it('is false when a key is missing or target is not an object', () => {
    expect(contains({ level: 3 }, { vip: false })).toBe(false);
    expect(contains('nope', { vip: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/objectCompare.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/data-filter/src/match/objectCompare.ts`:
```ts
/** True only for non-null, non-array, non-Date objects (a plain record). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/** Strict structural equality. Dates compare by time; NaN is not equal to NaN. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
  );
}

/**
 * Recursive containment (the in-memory analogue of Postgres `@>`): every key in
 * `value` must exist in `target`; plain-object values recurse, everything else
 * (incl. arrays) is compared by strict `deepEqual`.
 */
export function contains(target: unknown, value: unknown): boolean {
  if (isPlainObject(value)) {
    if (!isPlainObject(target)) return false;
    return Object.keys(value).every(
      (key) =>
        Object.prototype.hasOwnProperty.call(target, key) &&
        contains(target[key], value[key]),
    );
  }
  return deepEqual(target, value);
}
```

- [ ] **Step 4: Run — expect PASS + typecheck**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/objectCompare.spec.ts`
Then: `pnpm -F @rfjs/data-filter typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/data-filter/src/match/objectCompare.ts packages/data-filter/src/match/objectCompare.spec.ts
git commit -m "feat(data-filter): add objectCompare deepEqual and contains"
```

---

## Task 3: `ObjectMatch` (+ `OBJECT_OPERATORS`)

**Files:** Modify `src/match/operators.ts`; Create `src/match/ObjectMatch.ts`, `src/match/ObjectMatch.spec.ts`.

- [ ] **Step 1: Add `OBJECT_OPERATORS` to `operators.ts`**

Append to `packages/data-filter/src/match/operators.ts` (after `BOOLEAN_OPERATORS`, before `assertOperator`):
```ts
export const OBJECT_OPERATORS = [
  'eq',
  'neq',
  'contains',
  'isnull',
  'isnotnull',
] as const;
```

- [ ] **Step 2: Write the failing test**

Create `packages/data-filter/src/match/ObjectMatch.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ObjectMatch } from './ObjectMatch';

const data = { profile: { vip: true, level: 3 } };

describe('ObjectMatch', () => {
  it('eq is strict structural equality', () => {
    expect(new ObjectMatch('profile', 'eq', { vip: true, level: 3 }, data).isMatch).toBe(true);
    expect(new ObjectMatch('profile', 'eq', { vip: true }, data).isMatch).toBe(false);
  });
  it('neq is the negation of eq', () => {
    expect(new ObjectMatch('profile', 'neq', { vip: true, level: 3 }, data).isMatch).toBe(false);
    expect(new ObjectMatch('profile', 'neq', { vip: false }, data).isMatch).toBe(true);
  });
  it('contains is recursive containment with strict leaves', () => {
    expect(new ObjectMatch('profile', 'contains', { vip: true }, data).isMatch).toBe(true);
    expect(new ObjectMatch('profile', 'contains', { vip: false }, data).isMatch).toBe(false);
  });
  it('isnull / isnotnull test the field', () => {
    expect(new ObjectMatch('settings', 'isnull', undefined, data).isMatch).toBe(true);
    expect(new ObjectMatch('profile', 'isnotnull', undefined, data).isMatch).toBe(true);
  });
  it('throws on an unsupported operator', () => {
    expect(() => new ObjectMatch('profile', 'gt', { x: 1 }, data)).toThrow(/unsupported operator/);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/ObjectMatch.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `ObjectMatch`**

Create `packages/data-filter/src/match/ObjectMatch.ts`:
```ts
import { resolvePath } from '../path/resolve';
import { assertOperator, OBJECT_OPERATORS } from './operators';
import { contains, deepEqual } from './objectCompare';

export class ObjectMatch {
  isMatch = false;
  constructor(
    field: string,
    operator: string,
    value: Record<string, unknown> | undefined,
    data: object,
  ) {
    assertOperator('object', operator, OBJECT_OPERATORS);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const target = resolvePath(data, field);
    const expected = value ?? {};
    switch (operator) {
      case 'isnull':
        this.isMatch = target === null || target === undefined;
        break;
      case 'isnotnull':
        this.isMatch = target !== null && target !== undefined;
        break;
      case 'eq':
        this.isMatch = deepEqual(target, expected);
        break;
      case 'neq':
        this.isMatch = !deepEqual(target, expected);
        break;
      case 'contains':
        this.isMatch = contains(target, expected);
        break;
    }
  }
}
```

- [ ] **Step 5: Run — expect PASS + typecheck**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/ObjectMatch.spec.ts`
Then: `pnpm -F @rfjs/data-filter typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add packages/data-filter/src/match/operators.ts packages/data-filter/src/match/ObjectMatch.ts packages/data-filter/src/match/ObjectMatch.spec.ts
git commit -m "feat(data-filter): add ObjectMatch"
```

---

## Task 4: `ArrayMatch` (scalar elementTypes) (+ array allow-lists)

**Files:** Modify `src/match/operators.ts`; Create `src/match/ArrayMatch.ts`, `src/match/ArrayMatch.spec.ts`.

- [ ] **Step 1: Add array allow-lists to `operators.ts`**

Append to `packages/data-filter/src/match/operators.ts` (after `OBJECT_OPERATORS`):
```ts
export const STRING_ARRAY_OPERATORS = [
  'eq', 'contains', 'startswith', 'endswith', 'terms', 'containsall', 'isnull', 'isnotnull',
] as const;
export const NUMERIC_ARRAY_OPERATORS = [
  'eq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'containsall', 'isnull', 'isnotnull',
] as const;
export const DATE_ARRAY_OPERATORS = NUMERIC_ARRAY_OPERATORS;
export const BOOLEAN_ARRAY_OPERATORS = ['eq', 'isnull', 'isnotnull'] as const;

export const ARRAY_OPERATORS_BY_ELEMENT: Record<string, readonly string[]> = {
  string: STRING_ARRAY_OPERATORS,
  numeric: NUMERIC_ARRAY_OPERATORS,
  date: DATE_ARRAY_OPERATORS,
  boolean: BOOLEAN_ARRAY_OPERATORS,
};
```

- [ ] **Step 2: Write the failing test**

Create `packages/data-filter/src/match/ArrayMatch.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ArrayMatch } from './ArrayMatch';

const data = { tags: ['vip', 'beta', 'staff'], scores: [60, 85, 90] };

describe('ArrayMatch (scalar elements)', () => {
  it('eq is ∃ (some element equals)', () => {
    expect(new ArrayMatch('tags', 'string', 'eq', 'vip', data).isMatch).toBe(true);
    expect(new ArrayMatch('tags', 'string', 'eq', 'nope', data).isMatch).toBe(false);
  });
  it('contains / gt / range / terms are ∃', () => {
    expect(new ArrayMatch('tags', 'string', 'contains', 'eta', data).isMatch).toBe(true);
    expect(new ArrayMatch('scores', 'numeric', 'gt', 80, data).isMatch).toBe(true);
    expect(new ArrayMatch('scores', 'numeric', 'range', [50, 70], data).isMatch).toBe(true);
    expect(new ArrayMatch('tags', 'string', 'terms', ['admin', 'staff'], data).isMatch).toBe(true);
  });
  it('containsall requires every value present', () => {
    expect(new ArrayMatch('tags', 'string', 'containsall', ['vip', 'staff'], data).isMatch).toBe(true);
    expect(new ArrayMatch('tags', 'string', 'containsall', ['vip', 'x'], data).isMatch).toBe(false);
  });
  it('containsall works on dates (timestamp compare)', () => {
    const d = { ds: [new Date('2024-01-01'), new Date('2024-06-15')] };
    expect(new ArrayMatch('ds', 'date', 'containsall', [new Date('2024-01-01')], d).isMatch).toBe(true);
    expect(new ArrayMatch('ds', 'date', 'containsall', [new Date('2025-01-01')], d).isMatch).toBe(false);
  });
  it('isnull / isnotnull test the field', () => {
    expect(new ArrayMatch('missing', 'string', 'isnull', undefined, data).isMatch).toBe(true);
    expect(new ArrayMatch('tags', 'string', 'isnotnull', undefined, data).isMatch).toBe(true);
  });
  it('a non-array stored value is treated as empty → no match', () => {
    expect(new ArrayMatch('tags', 'string', 'eq', 'vip', { tags: 'vip' }).isMatch).toBe(false);
  });
  it('throws on an unsupported operator for the elementType', () => {
    expect(() => new ArrayMatch('tags', 'boolean', 'range', [1, 2], data)).toThrow(/unsupported operator/);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/ArrayMatch.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `ArrayMatch`**

Create `packages/data-filter/src/match/ArrayMatch.ts`:
```ts
import { resolvePath } from '../path/resolve';
import { typeTransfer } from '../filter/matchQuery';
import { assertOperator, ARRAY_OPERATORS_BY_ELEMENT } from './operators';
import { TextMatch } from './TextMatch';
import { NumericMatch } from './NumericMatch';
import { DateMatch } from './DateMatch';
import type { MatchQueryDataType } from '../types';

function toTimestamp(value: unknown): number {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const d = typeTransfer(value, 'date');
  return d instanceof Date ? d.getTime() : Number(d);
}

/** Strict, transform-aware per-element equality (∃ uses this for eq/containsall). */
function eqElement(el: unknown, value: unknown, elementType: MatchQueryDataType): boolean {
  if (elementType === 'date') {
    const a = toTimestamp(el);
    return !Number.isNaN(a) && a === toTimestamp(value);
  }
  const transferType = elementType === 'numeric' ? 'number' : elementType; // 'string' | 'boolean'
  return typeTransfer(el, transferType) === typeTransfer(value, transferType);
}

/** Reuse a scalar matcher over the resolved elements for the ∃ comparison ops. */
function scalarElementMatch(
  elementType: MatchQueryDataType,
  operator: string,
  value: unknown,
  elements: unknown[],
): { isMatch: boolean } {
  const data = { __el__: elements };
  switch (elementType) {
    case 'string':
      return new TextMatch('__el__', operator as never, value as never, data);
    case 'numeric':
      return new NumericMatch('__el__', operator as never, value as never, data);
    case 'date':
      return new DateMatch('__el__', operator as never, value as never, data);
    default:
      return { isMatch: false }; // boolean has no comparison ops (only eq, handled earlier)
  }
}

export class ArrayMatch {
  isMatch = false;
  constructor(
    field: string,
    elementType: MatchQueryDataType,
    operator: string,
    value: unknown,
    data: object,
  ) {
    assertOperator(`array<${elementType}>`, operator, ARRAY_OPERATORS_BY_ELEMENT[elementType]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw = resolvePath(data, field);
    if (operator === 'isnull') {
      this.isMatch = raw === null || raw === undefined;
      return;
    }
    if (operator === 'isnotnull') {
      this.isMatch = raw !== null && raw !== undefined;
      return;
    }
    if (!Array.isArray(raw)) {
      this.isMatch = false; // non-array → empty → no match
      return;
    }
    const elements = raw as unknown[];
    if (operator === 'eq') {
      this.isMatch = elements.some((el) => eqElement(el, value, elementType));
      return;
    }
    if (operator === 'containsall') {
      const wanted = Array.isArray(value) ? value : [value];
      this.isMatch = wanted.every((w) => elements.some((el) => eqElement(el, w, elementType)));
      return;
    }
    this.isMatch = scalarElementMatch(elementType, operator, value, elements).isMatch;
  }
}
```

- [ ] **Step 5: Run — expect PASS + typecheck**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/ArrayMatch.spec.ts`
Then: `pnpm -F @rfjs/data-filter typecheck`
Expected: PASS, clean. (`ArrayMatch` imports `typeTransfer` from `matchQuery` — used only at call time, mirroring the existing `TextMatch`→`matchQuery` import, so no init-time cycle.)

- [ ] **Step 6: Commit**

```bash
git add packages/data-filter/src/match/operators.ts packages/data-filter/src/match/ArrayMatch.ts packages/data-filter/src/match/ArrayMatch.spec.ts
git commit -m "feat(data-filter): add ArrayMatch for scalar element arrays"
```

---

## Task 5: `ElemMatch` (injected evaluator)

**Files:** Create `src/match/ElemMatch.ts`, `src/match/ElemMatch.spec.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/data-filter/src/match/ElemMatch.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ElemMatch } from './ElemMatch';
import { matchQuery } from '../filter/matchQuery';
import type { FilterMatchQuery } from '../types';

const data = { items: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 5 }] };

describe('ElemMatch', () => {
  it('matches when the SAME element satisfies all sub-conditions', () => {
    const filters: FilterMatchQuery = {
      logic: 'and',
      filters: [
        { field: 'sku', dataType: 'string', operator: 'eq', value: 'A' },
        { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
      ],
    };
    expect(new ElemMatch('items', filters, data, matchQuery).isMatch).toBe(false); // A has qty 1
  });
  it('matches when one element satisfies all sub-conditions', () => {
    const filters: FilterMatchQuery = {
      logic: 'and',
      filters: [
        { field: 'sku', dataType: 'string', operator: 'eq', value: 'A' },
        { field: 'qty', dataType: 'numeric', operator: 'gt', value: 0 },
      ],
    };
    expect(new ElemMatch('items', filters, data, matchQuery).isMatch).toBe(true);
  });
  it('empty / non-array / missing → no match', () => {
    const filters: FilterMatchQuery = {
      logic: 'and',
      filters: [{ field: 'sku', dataType: 'string', operator: 'eq', value: 'A' }],
    };
    expect(new ElemMatch('items', filters, { items: [] }, matchQuery).isMatch).toBe(false);
    expect(new ElemMatch('items', filters, {}, matchQuery).isMatch).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/ElemMatch.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ElemMatch`**

Create `packages/data-filter/src/match/ElemMatch.ts`:
```ts
import { resolvePath } from '../path/resolve';
import type { FilterMatchQuery } from '../types';

/** Evaluator injected by `createMatchQuery` (the `matchQuery` function) to avoid an import cycle. */
export type ElemMatchEvaluator = (data: object, filters: FilterMatchQuery) => boolean;

export class ElemMatch {
  isMatch = false;
  constructor(
    field: string,
    filters: FilterMatchQuery,
    data: object,
    evaluate: ElemMatchEvaluator,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw = resolvePath(data, field);
    const elements = Array.isArray(raw) ? (raw as unknown[]) : [];
    this.isMatch = elements.some(
      (element) => typeof element === 'object' && element !== null && evaluate(element, filters),
    );
  }
}
```

- [ ] **Step 4: Run — expect PASS + typecheck**

Run: `pnpm -F @rfjs/data-filter exec vitest run src/match/ElemMatch.spec.ts`
Then: `pnpm -F @rfjs/data-filter typecheck`
Expected: PASS, clean. (`ElemMatch` does NOT import `matchQuery`; the evaluator is injected — no cycle.)

- [ ] **Step 5: Commit**

```bash
git add packages/data-filter/src/match/ElemMatch.ts packages/data-filter/src/match/ElemMatch.spec.ts
git commit -m "feat(data-filter): add ElemMatch with injected evaluator"
```

---

## Task 6: Wire up types + `createMatchQuery` dispatch + wildcard guard + type test

**Files:** Modify `src/types/filter.ts`, `src/filter/matchQuery.ts`, `src/types/filter.typetest.ts`; Create `src/filter/collectionTypes.spec.ts`.

- [ ] **Step 1: Add the new types to `filter.ts`**

In `packages/data-filter/src/types/filter.ts`, immediately before the `MatchQueryMetadata` union, add:
```ts
export type ObjectFilterOperator = 'eq' | 'neq' | 'contains' | 'isnull' | 'isnotnull';

export interface ObjectCondition {
  field: string;
  dataType: 'object';
  operator: ObjectFilterOperator;
  value?: Record<string, unknown>;
}

export type StringArrayOperator =
  | 'eq' | 'contains' | 'startswith' | 'endswith' | 'terms'
  | 'containsall' | 'isnull' | 'isnotnull';
export type NumericArrayOperator =
  | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'range' | 'terms'
  | 'containsall' | 'isnull' | 'isnotnull';
export type DateArrayOperator = NumericArrayOperator;
export type BooleanArrayOperator = 'eq' | 'isnull' | 'isnotnull';

export interface StringArrayCondition {
  field: string; dataType: 'array'; elementType: 'string';
  operator: StringArrayOperator; value?: ValueType;
}
export interface NumericArrayCondition {
  field: string; dataType: 'array'; elementType: 'numeric';
  operator: NumericArrayOperator; value?: ValueType;
}
export interface DateArrayCondition {
  field: string; dataType: 'array'; elementType: 'date';
  operator: DateArrayOperator; value?: ValueType;
}
export interface BooleanArrayCondition {
  field: string; dataType: 'array'; elementType: 'boolean';
  operator: BooleanArrayOperator; value?: ValueType;
}
export interface ElemMatchCondition {
  field: string; dataType: 'array'; elementType: 'object';
  operator: 'elemmatch';
  filters: FilterMatchQuery;
}
```
Then replace the union:
```ts
export type MatchQueryMetadata =
  | StringCondition
  | NumericCondition
  | DateCondition
  | BooleanCondition;
```
with:
```ts
export type MatchQueryMetadata =
  | StringCondition
  | NumericCondition
  | DateCondition
  | BooleanCondition
  | ObjectCondition
  | StringArrayCondition
  | NumericArrayCondition
  | DateArrayCondition
  | BooleanArrayCondition
  | ElemMatchCondition;
```

- [ ] **Step 2: Type-check — expect FAIL (forces the dispatch update)**

Run: `pnpm -F @rfjs/data-filter typecheck`
Expected: FAIL — `createMatchQuery`'s `default` branch `const _exhaustive: never = metadata` no longer holds (the union grew), so `metadata` is not `never`. This is the exhaustiveness guard doing its job; Step 3 adds the cases.

- [ ] **Step 3: Extend `createMatchQuery` + add the wildcard guard**

In `packages/data-filter/src/filter/matchQuery.ts`:

(a) Add imports after the existing match-class imports:
```ts
import { ObjectMatch } from '../match/ObjectMatch';
import { ArrayMatch } from '../match/ArrayMatch';
import { ElemMatch } from '../match/ElemMatch';
import { hasWildcardSyntax } from '../path/resolve';
```

(b) Replace the `createMatchQuery` signature + body. Change the return type to `{ isMatch: boolean }` and add the `object`/`array` cases:
```ts
export function createMatchQuery(
  data: ObjectData,
  metadata: MatchQueryMetadata,
): { isMatch: boolean } {
  switch (metadata.dataType) {
    case 'string':
      return new TextMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'numeric':
      return new NumericMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'boolean':
      return new BooleanMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'date':
      return new DateMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'object':
      if (hasWildcardSyntax(metadata.field)) {
        throw new Error(
          `[data-filter] wildcard field is not supported for dataType 'object'; point field at the value`,
        );
      }
      return new ObjectMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'array':
      if (hasWildcardSyntax(metadata.field)) {
        throw new Error(
          `[data-filter] wildcard field is not supported for dataType 'array'; point field at the value, or compose with elemmatch`,
        );
      }
      if (metadata.elementType === 'object') {
        return new ElemMatch(metadata.field, metadata.filters, data, matchQuery);
      }
      return new ArrayMatch(
        metadata.field,
        metadata.elementType,
        metadata.operator,
        metadata.value,
        data,
      );
    default: {
      const _exhaustive: never = metadata;
      throw new Error(
        `[data-filter] unsupported dataType '${String((_exhaustive as { dataType: unknown }).dataType)}'`,
      );
    }
  }
}
```

- [ ] **Step 4: Type-check — expect PASS**

Run: `pnpm -F @rfjs/data-filter typecheck`
Expected: clean (the switch is exhaustive again; `ElemMatch` receives `matchQuery` as the evaluator, same module so no import).

- [ ] **Step 5: Add the compile-time type test**

Append to `packages/data-filter/src/types/filter.typetest.ts`:
```ts
import type { MatchQueryMetadata as MQM } from './filter';

// valid object/array/elemmatch combos compile
export const okObject: MQM = { field: 'p', dataType: 'object', operator: 'contains', value: { a: 1 } };
export const okArray: MQM = { field: 't', dataType: 'array', elementType: 'string', operator: 'contains', value: 'x' };
export const okElem: MQM = {
  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
  filters: { logic: 'and', filters: [] },
};

// invalid combos are compile errors
export const badObjectOp: MQM = {
  field: 'p', dataType: 'object',
  // @ts-expect-error object does not support 'gt'
  operator: 'gt',
  value: { a: 1 },
};
export const badBoolArrayOp: MQM = {
  field: 'b', dataType: 'array', elementType: 'boolean',
  // @ts-expect-error boolean-array does not support 'range'
  operator: 'range',
};
```

- [ ] **Step 6: Write the matchQuery-level integration spec**

Create `packages/data-filter/src/filter/collectionTypes.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchQuery } from './matchQuery';
import type { FilterMatchQuery } from '../types';

const wrap = (cond: unknown): FilterMatchQuery =>
  ({ logic: 'and', filters: [cond] } as FilterMatchQuery);

describe('collection dataTypes via matchQuery', () => {
  it('object contains', () => {
    expect(
      matchQuery({ profile: { vip: true } }, wrap({ field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } })),
    ).toBe(true);
  });
  it('array contains (∃)', () => {
    expect(
      matchQuery({ tags: ['a', 'b'] }, wrap({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'contains', value: 'b' })),
    ).toBe(true);
  });
  it('"does not contain" via not + array eq', () => {
    const f: FilterMatchQuery = {
      logic: 'not',
      filters: [{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' } as never],
    };
    expect(matchQuery({ tags: ['a', 'b'] }, f)).toBe(false);
    expect(matchQuery({ tags: ['x'] }, f)).toBe(true);
  });
  it('elemmatch — same element', () => {
    const f = wrap({
      field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
      filters: { logic: 'and', filters: [
        { field: 'sku', dataType: 'string', operator: 'eq', value: 'A' },
        { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
      ] },
    });
    expect(matchQuery({ items: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 5 }] }, f)).toBe(false);
    expect(matchQuery({ items: [{ sku: 'A', qty: 9 }] }, f)).toBe(true);
  });
  it('elemmatch with a nested array sub-condition (decision #8)', () => {
    const f = wrap({
      field: 'users', dataType: 'array', elementType: 'object', operator: 'elemmatch',
      filters: { logic: 'and', filters: [
        { field: 'tags', dataType: 'array', elementType: 'string', operator: 'contains', value: 'x' },
      ] },
    });
    expect(matchQuery({ users: [{ tags: ['x', 'y'] }, { tags: ['z'] }] }, f)).toBe(true);
    expect(matchQuery({ users: [{ tags: ['z'] }] }, f)).toBe(false);
  });
  it('throws on a wildcard field for a collection dataType', () => {
    expect(() =>
      matchQuery({ users: [] }, wrap({ field: 'users[*].tags', dataType: 'array', elementType: 'string', operator: 'contains', value: 'x' })),
    ).toThrow(/wildcard field is not supported/);
  });
});
```

- [ ] **Step 7: Run everything — expect PASS**

Run: `pnpm -F @rfjs/data-filter typecheck` (the `@ts-expect-error` directives are consumed)
Run: `pnpm -F @rfjs/data-filter test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add packages/data-filter/src/types/filter.ts packages/data-filter/src/filter/matchQuery.ts packages/data-filter/src/types/filter.typetest.ts packages/data-filter/src/filter/collectionTypes.spec.ts
git commit -m "feat(data-filter): dispatch object/array/elemmatch + reject wildcard field"
```

---

## Task 7: README usage guidance + changeset + full gate

**Files:** Modify `README.md`, `README.zh-TW.md`; Create `.changeset/data-filter-collection-types.md`.

- [ ] **Step 1: Document the new dataTypes + usage guidance in `README.md`**

In `packages/data-filter/README.md`, add a section before the `## Types` section:
````markdown
### Collection dataTypes — object / array / elemmatch

```typescript
// object: whole-value match
matchQuery(data, wrap({ field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } }));

// array of scalars: element ops are ∃ ("some element matches"); containsall is ∀-membership
matchQuery(data, wrap({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'contains', value: 'x' }));
matchQuery(data, wrap({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a', 'b'] }));

// arrays of objects: elemmatch — the SAME element must satisfy all sub-conditions
matchQuery(data, wrap({
  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
  filters: { logic: 'and', filters: [
    { field: 'sku', dataType: 'string', operator: 'eq', value: 'A' },
    { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
  ] },
}));
```

`array` `neq` is excluded (use `not` + `eq` for "does not contain"). A **wildcard** `field`
(`users[*].x`) is **not allowed** on `object`/`array`/`elemmatch` — it throws; compose with
`elemmatch` instead.

#### When to use wildcard-scalar vs collection dataTypes

| Need | Use |
|------|-----|
| Concise "some element/row loosely matches" | wildcard + scalar (`users[*].active eq true`) — one-liner ∃; cannot express "same element" |
| Explicit, unambiguous array membership | `dataType:'array'` |
| Whole-object match / containment | `dataType:'object'` |
| "Same element satisfies multiple conditions" | `elemmatch` |
| Nested collections (some user's tags contain x) | `elemmatch` + `array` composed |
````

- [ ] **Step 2: Mirror the section in `README.zh-TW.md`**

Add the equivalent section to `packages/data-filter/README.zh-TW.md` before its `## Types` (型別) section, translating the prose to zh-TW and keeping the code blocks identical:
````markdown
### Collection dataType — object / array / elemmatch

(程式碼範例同英文版)

陣列的元素運算子是 ∃(「某元素符合」),`containsall` 是 ∀(成員全含)。`array` 的 `neq`
已排除(「不含」用 `not` + `eq`)。`object`/`array`/`elemmatch` 的 `field` **不允許 wildcard**
(`users[*].x` → throw);巢狀需求用 `elemmatch` + `array` 組合。

#### 何時用 wildcard-scalar、何時用 collection dataType

| 需求 | 用 |
|------|-----|
| 簡潔的「某元素/列鬆散符合」 | wildcard + scalar(`users[*].active eq true`)——一行 ∃;無法表達「同元素」 |
| 明確、無歧義的陣列成員判斷 | `dataType:'array'` |
| 整個物件比對 / 包含 | `dataType:'object'` |
| 「同一元素滿足多條件」 | `elemmatch` |
| 巢狀集合(某 user 的 tags 含 x) | `elemmatch` + `array` 組合 |
````
(Copy the same three code examples from Step 1 into the zh-TW section.)

- [ ] **Step 3: Add the changeset**

Create `.changeset/data-filter-collection-types.md`:
```markdown
---
"@rfjs/data-filter": minor
---

Add `object`, `array` (scalar element types), and `elemmatch` (arrays of objects) dataTypes to the matcher (purely additive; existing scalar matching is unchanged).

- `object`: `eq`/`neq` (deep-equal), `contains` (recursive `@>`-style containment), `isnull`/`isnotnull`.
- `array` + `elementType: string|numeric|date|boolean`: element operators with ∃ ("some element matches") semantics, plus `containsall` (string/numeric/date) and `isnull`/`isnotnull`. `neq` is excluded — use `not` + `eq` for "does not contain".
- `array` + `elementType: 'object'` + `elemmatch`: the same element must satisfy nested sub-conditions; supports nested groups, nested elemmatch, and nested array/object sub-conditions.

A wildcard `field` (`users[*].x`) on these dataTypes throws — compose with `elemmatch` instead. Vocabulary is aligned with `@rfjs/jsonb-query`; semantics are in-memory-natural (not result-for-result identical).
```

- [ ] **Step 4: Full gate**

```bash
pnpm -F @rfjs/data-filter lint && pnpm -F @rfjs/data-filter typecheck && pnpm -F @rfjs/data-filter test && pnpm -F @rfjs/data-filter build
```
Expected: lint 0 errors, typecheck clean, all tests pass, build clean. Confirm `changeset status` lists `@rfjs/data-filter` (minor): `pnpm changeset status`. Do NOT run `changeset version`/`publish` locally.

- [ ] **Step 5: Commit**

```bash
git add packages/data-filter/README.md packages/data-filter/README.zh-TW.md .changeset/data-filter-collection-types.md
git commit -m "docs(data-filter): document collection dataTypes and add changeset"
```

---

## Self-Review

**Spec coverage:**
- object eq/neq/contains/isnull (recursive contains, strict leaves) → Task 2 (`objectCompare`) + Task 3 (`ObjectMatch`) ✓
- array scalar element ops ∃ + containsall (incl. date) + isnull/isnotnull + non-array→no-match + neq-excluded → Task 4 ✓
- elemmatch same-element + nested groups/elemmatch + nested array/object sub-conditions → Task 5 (basic) + Task 6 (nested-array via matchQuery) ✓
- wildcard-field rejection (decision #7, reuse `hasWildcardSyntax`) → Task 1 (export) + Task 6 (guard + test) ✓
- discriminated union + compile-time operator safety + runtime `assertOperator` → Task 6 (union + typetest) + Tasks 3/4 (assertOperator) ✓
- vocabulary aligned, semantics independent; no shared package; no scalar/jsonpath change → respected (no task touches scalar matchers or `resolvePath` except the `export` keyword) ✓
- README usage guidance + changeset → Task 7 ✓
- Performance/memory (no per-element class alloc; one matcher per condition; pure functions) → ArrayMatch reuses one scalar matcher over the elements (Task 4); no global state ✓

**Placeholder scan:** none — every step has complete code/commands. (`src/types/filter.typetest.ts` already exists from the 0.2.0 work; Task 6 appends to it.)

**Type/name consistency:** `deepEqual`/`contains`/`isPlainObject` (Task 2) used by `ObjectMatch` (Task 3); `OBJECT_OPERATORS` (Task 3) + `ARRAY_OPERATORS_BY_ELEMENT` (Task 4) consumed by the matchers and consistent with the `*Operator` union types (Task 6); `ElemMatchEvaluator`/`matchQuery` injection (Task 5) wired in Task 6; `hasWildcardSyntax` exported (Task 1) used in Task 6. The matcher constructor signatures (`ObjectMatch(field, operator, value, data)`, `ArrayMatch(field, elementType, operator, value, data)`, `ElemMatch(field, filters, data, evaluate)`) match their call sites in `createMatchQuery` (Task 6).

**Import cycle:** `ElemMatch` never imports `matchQuery` (injected). `ArrayMatch` imports `typeTransfer` from `matchQuery` and the scalar matchers — call-time use only, identical to the existing `TextMatch`→`matchQuery` pattern, so no module-init cycle.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-11-data-filter-collection-types.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks.

**2. Inline Execution** — execute in this session via executing-plans with checkpoints.

**Which approach?**
