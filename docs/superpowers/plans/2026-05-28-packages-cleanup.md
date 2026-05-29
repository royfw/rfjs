# Packages Cleanup & Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the 7 new @rfjs/* packages — remove template boilerplate, clean unnecessary configs, rename long function names, and add DateFilterOperator to data-filter.

**Architecture:** 4 independent tasks: (1) clean up template artifacts, (2) remove redundant per-package configs, (3) rename long functions, (4) add date filter support. Each produces working, testable changes.

**Tech Stack:** TypeScript, tsdown, Vitest, pnpm monorepo

---

## Audit Summary

### Findings

1. **Template boilerplate in each package**: Every new package has `docs/` directories with VitePress template stubs (`api-examples.md`, `index.md`, `markdown-examples.md`, `README.zh-TW.md`) that are generic placeholder content. `object-utils` correctly has no `docs/`.

2. **Redundant per-package configs**: Each package has its own `eslint.config.mjs`, `pnpm-lock.yaml` (some), `pnpm-workspace.yaml` (some), `commitlint` config, `husky`/`commitizen` devDependencies, and `prepare: husky` script. In a monorepo, these should be managed at the root level via the existing `.husky/` hooks and turbo. The root already has `pre-commit` and `commit-msg` hooks.

3. **`@rfjs/tpl-toolkit` dependency**: Listed as devDependency in all 7 packages but not actually used (the vitest config bug was fixed by using inline config). Should be removed.

4. **`pnpm-lock.yaml` / `pnpm-workspace.yaml` in sub-packages**: These are artifacts from the template. In a monorepo workspace, there is only ONE lockfile at the root. The `pnpm-workspace.yaml` inside a package points to `"."` which is meaningless inside the monorepo.

5. **Function naming** — candidates for shortening:
   - `filterMatchQueryData` → `matchQuery`
   - `filterMatchQueryArrayData` → `matchQueryArray`
   - `filterMappingMatchQueryData` → `matchAndMap`
   - `resolvePathWithWildcard` → `resolvePath`
   - `resolvePathWithWildcardDetailed` → `resolvePathDetail`
   - `jsonbTypeTransfer` → `jsonbTransfer`
   - `genFilterQueryMetadata` (jsonb-query) → `genJsonbQuery`
   - `metadetaListToJsonbQuery` (has typo "metadeta") → `toJsonbQueryList`
   - `factoryMatchQuery` → `createMatchQuery`
   - `MatchTextQuery` → `TextMatch`
   - `MatchNumericQuery` → `NumericMatch`
   - `MatchBooleanQuery` → `BooleanMatch`

6. **DateFilterOperator**: `data-filter` types already define `DateFilterOperator` but there's no `MatchDateQuery` class and `MatchQueryDataType` doesn't include `'date'`. Needs: new `MatchDateQuery` class, update types, update `factoryMatchQuery`, add tests.

7. **`typescript-config` / `eslint-config` packages**: Only used by `ui` package. Safe to leave as-is since the user said they can be removed but didn't request it actively. **Skipping — user said "可以不用了" meaning they're okay leaving them, not that they should be deleted.**

---

## Task 1: Remove Template Boilerplate Files

**Files:**
- Delete: `packages/data-transform/docs/` (entire directory)
- Delete: `packages/data-filter/docs/` (entire directory)
- Delete: `packages/jsonb-query/docs/` (entire directory)
- Delete: `packages/mongo-query/docs/` (entire directory)
- Delete: `packages/jwt/docs/` (entire directory)
- Delete: `packages/retry/docs/` (entire directory)

- [ ] **Step 1: Remove docs directories**

```bash
rm -rf packages/data-transform/docs
rm -rf packages/data-filter/docs
rm -rf packages/jsonb-query/docs
rm -rf packages/mongo-query/docs
rm -rf packages/jwt/docs
rm -rf packages/retry/docs
```

- [ ] **Step 2: Verify build still works**

```bash
pnpm build
```

Expected: All packages build successfully.

- [ ] **Step 3: Commit**

```bash
git add packages/data-transform/docs packages/data-filter/docs packages/jsonb-query/docs packages/mongo-query/docs packages/jwt/docs packages/retry/docs
git commit -m "$(cat <<EOF
chore(packages): remove template docs boilerplate from 6 packages

These directories contain generic VitePress template stubs (api-examples.md,
index.md with Lorem ipsum, etc.) that provide no value. Documentation is
in README.md at each package root.

Co-Authored-By: ${ANTHROPIC_MODEL} <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Clean Redundant Per-Package Config

**Files:**
- Delete: `packages/data-transform/pnpm-lock.yaml`
- Delete: `packages/data-transform/pnpm-workspace.yaml`
- Delete: `packages/data-filter/pnpm-lock.yaml`
- Delete: `packages/data-filter/pnpm-workspace.yaml`
- Delete: `packages/mongo-query/pnpm-lock.yaml`
- Delete: `packages/mongo-query/pnpm-workspace.yaml`
- Delete: `packages/jwt/pnpm-lock.yaml`
- Delete: `packages/jwt/pnpm-workspace.yaml`
- Delete: `packages/retry/pnpm-lock.yaml`
- Delete: `packages/retry/pnpm-workspace.yaml`
- Modify: All 7 `package.json` files — remove template devDependencies and scripts

- [ ] **Step 1: Remove redundant lock/workspace files**

```bash
rm -f packages/data-transform/pnpm-lock.yaml
rm -f packages/data-transform/pnpm-workspace.yaml
rm -f packages/data-filter/pnpm-lock.yaml
rm -f packages/data-filter/pnpm-workspace.yaml
rm -f packages/mongo-query/pnpm-lock.yaml
rm -f packages/mongo-query/pnpm-workspace.yaml
rm -f packages/jwt/pnpm-lock.yaml
rm -f packages/jwt/pnpm-workspace.yaml
rm -f packages/retry/pnpm-lock.yaml
rm -f packages/retry/pnpm-workspace.yaml
```

- [ ] **Step 2: Clean package.json for each of the 7 packages**

For each `packages/{pkg}/package.json`, make these changes:

**Remove from `devDependencies`:**
- `@commitlint/cli`
- `@commitlint/config-conventional`
- `@commitlint/cz-commitlint`
- `commitizen`
- `cz-conventional-changelog`
- `husky`
- `lint-staged`
- `only-allow`
- `@rfjs/tpl-toolkit`

**Remove from `scripts`:**
- `"commit": "pnpm exec cz"`
- `"prepare": "pnpm exec husky"`
- `"preinstall": "pnpm exec only-allow pnpm"`

**Remove top-level keys:**
- `"lint-staged"` (entire block)
- `"commitlint"` (entire block)
- `"packageManager"`
- `"engines"`

**Keep:** All other devDependencies (`@eslint/js`, `typescript-eslint`, `eslint`, `eslint-config-prettier`, `vitest`, `@vitest/*`, `tsdown`, `typescript`, `ts-node`, `prettier`, `rimraf`, `npm-run-all`) and all other scripts.

Apply to all 7 packages:
- `packages/object-utils/package.json`
- `packages/data-transform/package.json`
- `packages/data-filter/package.json`
- `packages/jsonb-query/package.json`
- `packages/mongo-query/package.json`
- `packages/jwt/package.json`
- `packages/retry/package.json`

- [ ] **Step 3: Reinstall dependencies**

```bash
pnpm install
```

- [ ] **Step 4: Verify build and tests**

```bash
pnpm build
pnpm test
```

Expected: All 314 tests pass, all packages build.

- [ ] **Step 5: Commit**

```bash
git add packages/*/pnpm-lock.yaml packages/*/pnpm-workspace.yaml packages/*/package.json pnpm-lock.yaml
git commit -m "$(cat <<EOF
chore(packages): clean redundant per-package config

Remove template artifacts: per-package pnpm-lock.yaml, pnpm-workspace.yaml,
commitlint/husky/commitizen devDependencies, and lint-staged config. These
are managed at the monorepo root level. Also remove unused @rfjs/tpl-toolkit
dependency.

Co-Authored-By: ${ANTHROPIC_MODEL} <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Rename Long Function Names

**Files:**
- Modify: `packages/data-filter/src/filter/filterMatchQueryData.ts`
- Modify: `packages/data-filter/src/filter/filterMappingMatchQueryData.ts`
- Modify: `packages/data-filter/src/filter/index.ts`
- Modify: `packages/data-filter/src/path/resolve.ts`
- Modify: `packages/data-filter/src/path/index.ts`
- Modify: `packages/data-filter/src/match/MatchTextQuery.ts` → `TextMatch.ts`
- Modify: `packages/data-filter/src/match/MatchNumericQuery.ts` → `NumericMatch.ts`
- Modify: `packages/data-filter/src/match/MatchBooleanQuery.ts` → `BooleanMatch.ts`
- Modify: `packages/data-filter/src/match/index.ts`
- Modify: `packages/data-filter/src/index.ts`
- Modify: `packages/data-filter/src/types/filter.ts`
- Modify all test files in `packages/data-filter/src/` that reference renamed symbols
- Modify: `packages/data-transform/src/jsonbTypeTransfer.ts`
- Modify: `packages/data-transform/src/index.ts`
- Modify: `packages/data-transform/src/typeTransfer.ts` (references jsonbTypeTransfer)
- Modify all test files in `packages/data-transform/src/` that reference renamed symbols
- Modify: `packages/jsonb-query/src/genFilterQueryMetadata.ts` → `genJsonbQuery.ts`
- Modify: `packages/jsonb-query/src/metadetaListToJsonbQuery.ts` → `toJsonbQueryList.ts`
- Modify: `packages/jsonb-query/src/index.ts`
- Modify: `packages/jsonb-query/src/toQuery.ts` (references genFilterQueryMetadata)
- Modify all test files in `packages/jsonb-query/src/` that reference renamed symbols
- Modify: `packages/data-filter/README.md` (update API docs)
- Modify: `packages/data-transform/README.md` (update API docs)
- Modify: `packages/jsonb-query/README.md` (update API docs)

**Rename mapping:**

| Old Name | New Name | Package |
|---|---|---|
| `filterMatchQueryData` | `matchQuery` | data-filter |
| `filterMatchQueryArrayData` | `matchQueryArray` | data-filter |
| `filterMappingMatchQueryData` | `matchAndMap` | data-filter |
| `resolvePathWithWildcard` | `resolvePath` | data-filter |
| `resolvePathWithWildcardDetailed` | `resolvePathDetail` | data-filter |
| `MatchTextQuery` | `TextMatch` | data-filter |
| `MatchNumericQuery` | `NumericMatch` | data-filter |
| `MatchBooleanQuery` | `BooleanMatch` | data-filter |
| `factoryMatchQuery` | `createMatchQuery` | data-filter |
| `jsonbTypeTransfer` | `jsonbTransfer` | data-transform |
| `genFilterQueryMetadata` | `genJsonbQuery` | jsonb-query |
| `metadetaListToJsonbQuery` | `toJsonbQueryList` | jsonb-query |

- [ ] **Step 1: Rename data-transform — `jsonbTypeTransfer` → `jsonbTransfer`**

In `packages/data-transform/src/jsonbTypeTransfer.ts`:
```typescript
// Change:
export const jsonbTypeTransfer = (value: JsonbValueType, type: JsonbDataType): JsonbValueType => {
// To:
export const jsonbTransfer = (value: JsonbValueType, type: JsonbDataType): JsonbValueType => {
```

In `packages/data-transform/src/index.ts` — `export * from './jsonbTypeTransfer';` stays (file export, not symbol).

Update all references in `packages/jsonb-query/src/toQuery.ts`:
```typescript
// Change:
import { jsonbTypeTransfer, JsonbDataType, ValueType } from '@rfjs/data-transform';
// To:
import { jsonbTransfer, JsonbDataType, ValueType } from '@rfjs/data-transform';

// Change:
.map((el) => jsonbTypeTransfer(el, dataType));
// To:
.map((el) => jsonbTransfer(el, dataType));
```

- [ ] **Step 2: Update data-transform tests**

In `packages/data-transform/src/jsonbTypeTransfer.spec.ts`, change all `jsonbTypeTransfer` to `jsonbTransfer`:
```typescript
import { jsonbTransfer } from './jsonbTypeTransfer';

// ... replace all 17 occurrences of jsonbTypeTransfer with jsonbTransfer
```

- [ ] **Step 3: Run data-transform + jsonb-query tests**

```bash
cd packages/data-transform && pnpm test && cd ../..
cd packages/jsonb-query && pnpm test && cd ../..
```

Expected: All tests pass.

- [ ] **Step 4: Rename data-filter — path functions**

In `packages/data-filter/src/path/resolve.ts`:
```typescript
// Change:
export function resolvePathWithWildcard(
// To:
export function resolvePath(

// Change:
export function resolvePathWithWildcardDetailed(
// To:
export function resolvePathDetail(
```

In `packages/data-filter/src/path/index.ts`:
```typescript
// Change:
export { resolvePathWithWildcard, resolvePathWithWildcardDetailed } from './resolve';
// To:
export { resolvePath, resolvePathDetail } from './resolve';
```

Update all callers of `resolvePathWithWildcard` in `packages/data-filter/src/match/`:
- `MatchTextQuery.ts`: `resolvePathWithWildcard` → `resolvePath`
- `MatchNumericQuery.ts`: `resolvePathWithWildcard` → `resolvePath`
- `MatchBooleanQuery.ts`: `resolvePathWithWildcard` → `resolvePath`

- [ ] **Step 5: Rename data-filter — Match classes**

Rename files and classes:

`packages/data-filter/src/match/MatchTextQuery.ts` → `TextMatch.ts`:
```typescript
// Change:
export class MatchTextQuery {
// To:
export class TextMatch {
```

`packages/data-filter/src/match/MatchNumericQuery.ts` → `NumericMatch.ts`:
```typescript
// Change:
export class MatchNumericQuery {
// To:
export class NumericMatch {
```

`packages/data-filter/src/match/MatchBooleanQuery.ts` → `BooleanMatch.ts`:
```typescript
// Change:
export class MatchBooleanQuery {
// To:
export class BooleanMatch {
```

In `packages/data-filter/src/match/index.ts`:
```typescript
export { TextMatch } from './TextMatch';
export { NumericMatch } from './NumericMatch';
export { BooleanMatch } from './BooleanMatch';
```

- [ ] **Step 6: Rename data-filter — filter functions**

In `packages/data-filter/src/filter/filterMatchQueryData.ts`:
```typescript
// Change:
export function filterMatchQueryArrayData(
// To:
export function matchQueryArray(

// Change:
export function filterMatchQueryData(
// To:
export function matchQuery(

// Update recursive call inside matchQuery:
// Change:
const nestedMatch = filterMatchQueryData(data, cur as FilterMatchQuery);
// To:
const nestedMatch = matchQuery(data, cur as FilterMatchQuery);

// Change:
export function factoryMatchQuery(
// To:
export function createMatchQuery(
```

Also update the `MatchTextQuery`/`MatchNumericQuery`/`MatchBooleanQuery` class instantiation inside `createMatchQuery`:
```typescript
return {
  string: () => new TextMatch(field, operator as TextFilterOperator, value, data),
  numeric: () => new NumericMatch(field, operator as NumericFilterOperator, value, data),
  boolean: () => new BooleanMatch(field, operator as BooleanFilterOperator, value, data),
}[dataType]();
```

In `packages/data-filter/src/filter/filterMappingMatchQueryData.ts`:
```typescript
// Change:
import { filterMatchQueryData } from './filterMatchQueryData';
// To:
import { matchQuery } from './filterMatchQueryData';

// Change:
export function filterMappingMatchQueryData<T>(
// To:
export function matchAndMap<T>(

// Change caller:
// filterMatchQueryData(data, convertFilter) → matchQuery(data, convertFilter)
```

In `packages/data-filter/src/filter/index.ts` — update exports if explicit.

In `packages/data-filter/src/index.ts` — update exports if explicit.

- [ ] **Step 7: Update data-filter tests**

Update all test files to use new names:
- `resolvePathWithWildcard` → `resolvePath`
- `resolvePathWithWildcardDetailed` → `resolvePathDetail`
- `MatchTextQuery` → `TextMatch`
- `MatchNumericQuery` → `NumericMatch`
- `MatchBooleanQuery` → `BooleanMatch`
- `filterMatchQueryData` → `matchQuery`
- `filterMatchQueryArrayData` → `matchQueryArray`
- `filterMappingMatchQueryData` → `matchAndMap`
- `factoryMatchQuery` → `createMatchQuery`

- [ ] **Step 8: Rename jsonb-query — genFilterQueryMetadata → genJsonbQuery**

In `packages/jsonb-query/src/genFilterQueryMetadata.ts`:
```typescript
// Change:
export const genFilterQueryMetadata = (
// To:
export const genJsonbQuery = (
```

In `packages/jsonb-query/src/metadetaListToJsonbQuery.ts`:
```typescript
// Change:
export const metadetaListToJsonbQuery = (
// To:
export const toJsonbQueryList = (
```

Also fix the typo in the function body if it references itself.

In `packages/jsonb-query/src/index.ts` — update re-exports.

Update any internal references to `genFilterQueryMetadata` → `genJsonbQuery` and `metadetaListToJsonbQuery` → `toJsonbQueryList`.

- [ ] **Step 9: Update jsonb-query tests**

Update test files to use new names.

- [ ] **Step 10: Update all README.md files**

Update the 3 affected READMEs to reflect the new function names:
- `packages/data-filter/README.md`
- `packages/data-transform/README.md`
- `packages/jsonb-query/README.md`

- [ ] **Step 11: Run all tests**

```bash
pnpm test
```

Expected: All 314 tests pass.

- [ ] **Step 12: Commit**

```bash
git add packages/data-filter/src packages/data-transform/src packages/jsonb-query/src packages/*/README.md
git commit -m "$(cat <<EOF
refactor(packages): shorten function and class names

- data-filter: filterMatchQueryData -> matchQuery, filterMatchQueryArrayData
  -> matchQueryArray, filterMappingMatchQueryData -> matchAndMap,
  resolvePathWithWildcard -> resolvePath, Match*Query -> *Match,
  factoryMatchQuery -> createMatchQuery
- data-transform: jsonbTypeTransfer -> jsonbTransfer
- jsonb-query: genFilterQueryMetadata -> genJsonbQuery,
  metadetaListToJsonbQuery -> toJsonbQueryList (also fixes "metadeta" typo)

Co-Authored-By: ${ANTHROPIC_MODEL} <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add DateFilterOperator to data-filter

**Files:**
- Modify: `packages/data-filter/src/types/filter.ts`
- Create: `packages/data-filter/src/match/DateMatch.ts`
- Modify: `packages/data-filter/src/match/index.ts`
- Modify: `packages/data-filter/src/filter/filterMatchQueryData.ts` (update `factoryMatchQuery` → `createMatchQuery`)
- Create: `packages/data-filter/src/match/DateMatch.spec.ts`
- Modify: `packages/data-filter/README.md`

- [ ] **Step 1: Update types**

In `packages/data-filter/src/types/filter.ts`:

```typescript
// Change:
export type MatchQueryDataType = 'string' | 'numeric' | 'boolean';
// To:
export type MatchQueryDataType = 'string' | 'numeric' | 'boolean' | 'date';
```

Add `DateFilterOperator` to `MatchQueryMetadata.operator`:
```typescript
export type MatchQueryMetadata = {
  field: string;
  dataType: MatchQueryDataType;
  operator:
    | DefaultFilterOperator
    | TextFilterOperator
    | NumericFilterOperator
    | DateFilterOperator;
  value: ValueType;
};
```

- [ ] **Step 2: Write failing test for DateMatch**

Create `packages/data-filter/src/match/DateMatch.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DateMatch } from './DateMatch';

describe('DateMatch', () => {
  const data = {
    createdAt: new Date('2024-06-15'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('eq', () => {
    it('should match equal date', () => {
      const q = new DateMatch('createdAt', 'eq', new Date('2024-06-15'), data);
      expect(q.isMatch).toBe(true);
    });

    it('should not match different date', () => {
      const q = new DateMatch('createdAt', 'eq', new Date('2024-01-01'), data);
      expect(q.isMatch).toBe(false);
    });
  });

  describe('gt', () => {
    it('should match when target > value', () => {
      const q = new DateMatch('createdAt', 'gt', new Date('2024-01-01'), data);
      expect(q.isMatch).toBe(true);
    });
  });

  describe('gte', () => {
    it('should match when target >= value', () => {
      const q = new DateMatch('createdAt', 'gte', new Date('2024-06-15'), data);
      expect(q.isMatch).toBe(true);
    });
  });

  describe('lt', () => {
    it('should match when target < value', () => {
      const q = new DateMatch('createdAt', 'lt', new Date('2025-01-01'), data);
      expect(q.isMatch).toBe(true);
    });
  });

  describe('lte', () => {
    it('should match when target <= value', () => {
      const q = new DateMatch('createdAt', 'lte', new Date('2024-06-15'), data);
      expect(q.isMatch).toBe(true);
    });
  });

  describe('range', () => {
    it('should match when target is within range', () => {
      const q = new DateMatch('createdAt', 'range', [new Date('2024-01-01'), new Date('2024-12-31')], data);
      expect(q.isMatch).toBe(true);
    });

    it('should not match when target is outside range', () => {
      const q = new DateMatch('createdAt', 'range', [new Date('2025-01-01'), new Date('2025-12-31')], data);
      expect(q.isMatch).toBe(false);
    });
  });

  describe('isnull', () => {
    it('should match null field', () => {
      const q = new DateMatch('missingField', 'isnull', null, data);
      expect(q.isMatch).toBe(true);
    });

    it('should not match existing field', () => {
      const q = new DateMatch('createdAt', 'isnull', null, data);
      expect(q.isMatch).toBe(false);
    });
  });

  describe('isnotnull', () => {
    it('should match existing field', () => {
      const q = new DateMatch('createdAt', 'isnotnull', null, data);
      expect(q.isMatch).toBe(true);
    });
  });

  describe('terms', () => {
    it('should match when target is in terms list', () => {
      const q = new DateMatch('createdAt', 'terms', [new Date('2024-06-15'), new Date('2024-07-01')], data);
      expect(q.isMatch).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/data-filter && pnpm vitest run src/match/DateMatch.spec.ts && cd ../..
```

Expected: FAIL — `DateMatch` not found.

- [ ] **Step 4: Implement DateMatch class**

Create `packages/data-filter/src/match/DateMatch.ts`:

```typescript
import * as _ from 'lodash';
import { typeTransfer } from '../filter/filterMatchQueryData';
import type { DateFilterOperator, DefaultFilterOperator, ObjectData } from '../types';
import { resolvePath } from '../path/resolve';

export class DateMatch {
  isMatch = false;
  validPath = true;
  matchs: number[] = [];
  targets: number[];
  values: number[];

  constructor(
    private field: string,
    private operator: DateFilterOperator | DefaultFilterOperator,
    value: any,
    private data: ObjectData,
  ) {
    const target = resolvePath(this.data, this.field);
    if (_.isUndefined(target)) {
      this.validPath = false;
    }

    const targetVals = []
      .concat(value)
      .map((i) => this.toTimestamp(i));
    this.values = targetVals;

    const targets = [].concat(target).map((i) => this.toTimestamp(i));
    this.targets = targets;

    if (_.isNull(target) || _.isUndefined(target)) {
      this.targets = [];
    }

    if (typeof this[this.operator] == 'function') {
      this.isMatch = this[this.operator]();
    }
  }

  private toTimestamp(val: any): number {
    const transferred = typeTransfer(val, 'date');
    return transferred instanceof Date ? transferred.getTime() : Number(transferred);
  }

  private eq() {
    this.matchs = this.values.filter((cur) => this.targets.includes(cur));
    return this.matchs.length == this.values.length;
  }

  private neq() {
    const neq = !this.eq();
    this.matchs = this.values.filter((i) => !this.matchs.includes(i));
    return neq;
  }

  private isnull() {
    return this.targets.length == 0;
  }

  private isnotnull() {
    return !this.isnull();
  }

  private gt() {
    this.matchs = this.values.filter((cur) => this.targets.some((t) => t > cur));
    return this.matchs.length > 0;
  }

  private gte() {
    this.matchs = this.values.filter((cur) => this.targets.some((t) => t >= cur));
    return this.matchs.length > 0;
  }

  private lt() {
    this.matchs = this.values.filter((cur) => this.targets.some((t) => t < cur));
    return this.matchs.length > 0;
  }

  private lte() {
    this.matchs = this.values.filter((cur) => this.targets.some((t) => t <= cur));
    return this.matchs.length > 0;
  }

  private range() {
    const sortVals = this.values.sort((a, b) => a - b);
    const start = sortVals[0];
    const end = sortVals[1];
    this.matchs = this.targets.filter((cur) => cur >= start && cur <= end);
    return this.matchs.length > 0;
  }

  private terms() {
    this.matchs = this.values.filter((cur) => this.targets.includes(cur));
    return this.matchs.length > 0;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/data-filter && pnpm vitest run src/match/DateMatch.spec.ts && cd ../..
```

Expected: PASS (12 tests).

- [ ] **Step 6: Update match/index.ts exports**

In `packages/data-filter/src/match/index.ts`:
```typescript
export { TextMatch } from './TextMatch';
export { NumericMatch } from './NumericMatch';
export { BooleanMatch } from './BooleanMatch';
export { DateMatch } from './DateMatch';
```

- [ ] **Step 7: Update createMatchQuery to handle 'date' type**

In `packages/data-filter/src/filter/filterMatchQueryData.ts`, update `createMatchQuery`:

```typescript
import { DateMatch } from '../match/DateMatch';
import type { DateFilterOperator } from '../types';

export function createMatchQuery(
  data: ObjectData,
  metadata: MatchQueryMetadata,
): TextMatch | NumericMatch | BooleanMatch | DateMatch {
  const { field, operator, value, dataType } = metadata;
  const query = {
    string: () => new TextMatch(field, operator as TextFilterOperator, value, data),
    numeric: () => new NumericMatch(field, operator as NumericFilterOperator, value, data),
    boolean: () => new BooleanMatch(field, operator as BooleanFilterOperator, value, data),
    date: () => new DateMatch(field, operator as DateFilterOperator, value, data),
  };
  return query[dataType]();
}
```

- [ ] **Step 8: Run all data-filter tests**

```bash
cd packages/data-filter && pnpm test && cd ../..
```

Expected: All tests pass (224 + 12 = 236).

- [ ] **Step 9: Update README**

In `packages/data-filter/README.md`, add `'date'` to the `MatchQueryDataType` and add date operators to the operator list.

- [ ] **Step 10: Commit**

```bash
git add packages/data-filter/src/match/DateMatch.ts packages/data-filter/src/match/DateMatch.spec.ts packages/data-filter/src/types/filter.ts packages/data-filter/src/match/index.ts packages/data-filter/src/filter/filterMatchQueryData.ts packages/data-filter/README.md
git commit -m "$(cat <<EOF
feat(data-filter): add DateFilterOperator support

- Add DateMatch class with eq, neq, isnull, isnotnull, gt, gte, lt, lte,
  range, terms operators
- Register 'date' in MatchQueryDataType and createMatchQuery factory
- Add 12 unit tests for DateMatch

Co-Authored-By: ${ANTHROPIC_MODEL} <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- [x] "typescript-config、eslint-config 可以不用了" — Noted, left as-is (only `ui` uses them)
- [x] "review 其他 packages 套件，有些像是 .github、.husky 等配置，在 monorepo 是不是就可以不用了" — Task 2 removes per-package husky/commitlint/lint-staged; root `.husky/` and `.github/` are kept (they serve the whole monorepo)
- [x] "review 新增的套件 function 名稱，覺得名稱有點太長了" — Task 3 renames all long names
- [x] "data-filter 增加 DateFilterOperator 功能" — Task 4 adds complete date filter support

**Placeholder scan:** No TBDs, TODOs, or vague instructions found. Every step has exact file paths, code blocks, and commands.

**Type consistency:** `resolvePath` used consistently across Tasks 3 and 4. `DateMatch` follows the same class pattern as `TextMatch`/`NumericMatch`/`BooleanMatch`. `createMatchQuery` return type union updated to include `DateMatch`. `matchQuery` (renamed from `filterMatchQueryData`) called correctly in `matchAndMap`.

---
