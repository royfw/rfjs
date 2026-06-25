# `@rfjs/es-query` Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@rfjs/es-query` — a pure, framework-agnostic builder that compiles a filter-tree into an Elasticsearch / OpenSearch Query DSL `bool` query (+ a thin search-body wrapper).

**Architecture:** Mirrors `@rfjs/mongo-query`'s three-layer shape: leaf clause builders (raw ES clause objects) ← a `toClause` dispatcher (operator → clause, with value coercion via `@rfjs/data-transform`) ← a recursive group compiler `buildEsQuery` (metadata tree → nested `bool`). A separate `buildSearchBody` adds `sort`/`size`/`from`/`search_after`. A `dialect` flag (`elasticsearch | opensearch`) gates divergent clauses (e.g. `combined_fields`) with a typed error.

**Tech Stack:** TypeScript 5.7, tsdown (esm+cjs+dts), Vitest, `@rfjs/data-transform` (workspace, value coercion).

## Global Constraints

- **Node:** >=18; repo `.nvmrc` pins `v24.16.0`. **pnpm** >=10.24.0.
- **TypeScript:** 5.7+; `strict: true`.
- **Package name:** `@rfjs/es-query`, `"version": "0.0.0"` at scaffold (changeset sets first release), `"private": false`, `publishConfig.access = "public"`.
- **No third-party runtime deps.** Only allowed runtime dependency: `@rfjs/data-transform` (`workspace:*`).
- **Targets modern ES (8.x/9.x) and OpenSearch (2.x/3.x) only.** No ES2/ES5/ES7-mapping-type support.
- **Source layout:** flat (`src/*.ts`, ≤7 modules); co-locate `*.spec.ts` next to source (vitest glob `src/**/*.spec.ts`). One barrel `src/index.ts` is the only `exports` entry.
- **File naming:** camelCase for function/util modules (`toClause.ts`, `buildEsQuery.ts`).
- **Docs rule:** README examples must be neutral — never reference any source project the patterns were extracted from.
- **Tests:** Vitest, `globals: true`. Commit after each green step (Conventional Commits; `--no-verify` is acceptable in the worktree until deps are installed, otherwise normal commit).

---

## File Structure

```
packages/es-query/
  package.json              # @rfjs/es-query manifest (deps: @rfjs/data-transform)
  tsconfig.json             # copied from mongo-query
  tsconfig.build.json       # copied from mongo-query
  tsdown.config.ts          # copied from mongo-query
  vitest.config.mts         # copied from mongo-query
  eslint.config.mjs         # copied from mongo-query
  .npmrc .nvmrc .prettierrc .versionrc   # copied from mongo-query
  README.md  README.zh-TW.md
  src/
    index.ts                # barrel: re-export all public modules
    types.ts                # dialect, field-type, operator, metadata, output types
    errors.ts               # EsQueryError + UnsupportedClauseError
    clauses.ts              # leaf clause builders → raw ES clause objects
    clauses.spec.ts
    toClause.ts             # toClause(field, fieldType, op, value, dialect) dispatch + coercion + guard
    toClause.spec.ts
    buildEsQuery.ts         # group metadata → nested { bool: ... }
    buildEsQuery.spec.ts
    buildSearchBody.ts      # wrap query with sort/size/from/search_after
    buildSearchBody.spec.ts
```

---

### Task 1: Scaffold the package

**Files:**
- Create: `packages/es-query/package.json`
- Create: `packages/es-query/tsconfig.json`, `tsconfig.build.json`, `tsdown.config.ts`, `vitest.config.mts`, `eslint.config.mjs`
- Create: `packages/es-query/.npmrc`, `.nvmrc`, `.prettierrc`, `.versionrc`
- Create: `packages/es-query/src/index.ts` (temporary empty barrel)

**Interfaces:**
- Consumes: nothing.
- Produces: an installable workspace package `@rfjs/es-query` with working `vitest:run`, `typecheck`, `build` scripts.

- [ ] **Step 1: Copy config files verbatim from `mongo-query`**

Run (from repo root):
```bash
cd /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-es-query
mkdir -p packages/es-query/src
for f in tsconfig.json tsconfig.build.json tsdown.config.ts vitest.config.mts eslint.config.mjs .npmrc .nvmrc .prettierrc .versionrc; do
  cp "packages/mongo-query/$f" "packages/es-query/$f"
done
```

- [ ] **Step 2: Write `package.json`**

Create `packages/es-query/package.json` (copy of mongo-query's manifest with name/description/keywords/version/homepage/repo-directory changed):

```json
{
  "name": "@rfjs/es-query",
  "version": "0.0.0",
  "description": "Elasticsearch / OpenSearch query builder — compile a filter-tree to Query DSL bool queries",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "sideEffects": false,
  "private": false,
  "publishConfig": { "access": "public" },
  "scripts": {
    "clean": "pnpm exec npm-run-all --parallel clean:dist clean:types",
    "clean:types": "pnpm exec rimraf ./types",
    "clean:dist": "pnpm exec rimraf ./dist",
    "dev": "pnpm exec npm-run-all --parallel dev:tsdown typecheck:watch",
    "dev:tsdown": "pnpm run clean && tsdown --config-loader unrun --watch",
    "build": "pnpm run build:tsdown",
    "build:tsdown": "pnpm run clean && tsdown --config-loader unrun",
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
    "lint:fix": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "pnpm run vitest:run",
    "vitest:run": "vitest --passWithNoTests --run",
    "vitest:ui": "vitest --passWithNoTests --ui"
  },
  "keywords": ["elasticsearch", "opensearch", "query-builder", "filter", "query"],
  "author": "Roy Chuang",
  "license": "ISC",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/royfw/rfjs.git",
    "directory": "packages/es-query"
  },
  "bugs": "https://github.com/royfw/rfjs/issues",
  "homepage": "https://github.com/royfw/rfjs/tree/main/packages/es-query#readme",
  "files": ["dist", "README.md", "README.zh-TW.md"],
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@vitest/coverage-istanbul": "^3.2.3",
    "@vitest/ui": "^3.2.3",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "npm-run-all": "^4.1.5",
    "prettier": "^3.5.1",
    "rimraf": "^6.0.1",
    "ts-node": "^10.9.2",
    "tsdown": "0.17.0-beta.6",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.24.0",
    "vitest": "^3.2.3"
  },
  "dependencies": {
    "@rfjs/data-transform": "workspace:*"
  }
}
```

- [ ] **Step 3: Write a temporary empty barrel**

Create `packages/es-query/src/index.ts`:
```ts
export {};
```

- [ ] **Step 4: Install and verify the workspace resolves**

Run (from repo root):
```bash
pnpm install
pnpm -F @rfjs/es-query vitest:run
```
Expected: install succeeds; vitest exits 0 with "no test files found" (`--passWithNoTests`).

- [ ] **Step 5: Commit**

```bash
git add packages/es-query
git commit -m "build(es-query): scaffold @rfjs/es-query package"
```

---

### Task 2: Types and errors

**Files:**
- Create: `packages/es-query/src/types.ts`
- Create: `packages/es-query/src/errors.ts`

**Interfaces:**
- Consumes: `ValueType`, `DataType` from `@rfjs/data-transform`.
- Produces:
  - `type EsDialect = 'elasticsearch' | 'opensearch'`
  - `type EsFieldType = 'keyword' | 'text' | 'date' | 'number' | 'boolean'`
  - `type EsConditionType = 'eq' | 'neq' | 'in' | 'notIn' | 'lt' | 'lte' | 'gt' | 'gte' | 'between' | 'contains' | 'startsWith' | 'endsWith' | 'exists' | 'isNull' | 'match' | 'matchPhrase' | 'multiMatch' | 'combinedFields' | 'fuzzy' | 'regex'`
  - `type EsLogicalOperator = 'and' | 'or' | 'not' | 'nor'`
  - `interface EsFieldCondition { field: string; condition: EsConditionType; fieldType?: EsFieldType; dataType?: DataType; value: ValueType | ValueType[]; fields?: string[] }`
  - `interface EsFilterMetadata { logic: EsLogicalOperator; filters: Array<EsFieldCondition | EsFilterMetadata> }`
  - `interface EsClause { [k: string]: unknown }` (a raw ES query clause)
  - `interface EsBoolQuery { bool: { must?: EsClause[]; should?: EsClause[]; must_not?: EsClause[]; minimum_should_match?: number } }`
  - `interface EsSearchBody { query: EsBoolQuery; sort?: EsClause[]; size?: number; from?: number; search_after?: ValueType[] }`
  - `interface EsSortField { field: string; order: 'asc' | 'desc' }`
  - `class EsQueryError extends Error`
  - `class UnsupportedClauseError extends EsQueryError` (constructor `(clause: string, dialect: EsDialect)`)
  - `function isEsFilterMetadata(x): x is EsFilterMetadata`
  - `function isEsFieldCondition(x): x is EsFieldCondition`

- [ ] **Step 1: Write `errors.ts`**

```ts
import type { EsDialect } from './types';

export class EsQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EsQueryError';
  }
}

export class UnsupportedClauseError extends EsQueryError {
  constructor(
    public readonly clause: string,
    public readonly dialect: EsDialect,
  ) {
    super(`Clause "${clause}" is not supported by dialect "${dialect}"`);
    this.name = 'UnsupportedClauseError';
  }
}
```

- [ ] **Step 2: Write `types.ts`**

```ts
import type { DataType, ValueType } from '@rfjs/data-transform';

export type { ValueType };

export type EsDialect = 'elasticsearch' | 'opensearch';

export type EsFieldType = 'keyword' | 'text' | 'date' | 'number' | 'boolean';

export type EsConditionType =
  | 'eq' | 'neq' | 'in' | 'notIn'
  | 'lt' | 'lte' | 'gt' | 'gte' | 'between'
  | 'contains' | 'startsWith' | 'endsWith'
  | 'exists' | 'isNull'
  | 'match' | 'matchPhrase' | 'multiMatch' | 'combinedFields'
  | 'fuzzy' | 'regex';

export type EsLogicalOperator = 'and' | 'or' | 'not' | 'nor';

export interface EsFieldCondition {
  field: string;
  condition: EsConditionType;
  /** keyword/text drives term-vs-match; optional, conservative default applies. */
  fieldType?: EsFieldType;
  /** value coercion type for @rfjs/data-transform; defaults to 'any'. */
  dataType?: DataType;
  value: ValueType | ValueType[];
  /** target fields for multiMatch / combinedFields. */
  fields?: string[];
}

export interface EsFilterMetadata {
  logic: EsLogicalOperator;
  filters: Array<EsFieldCondition | EsFilterMetadata>;
}

export type EsClause = Record<string, unknown>;

export interface EsBoolQuery {
  bool: {
    must?: EsClause[];
    should?: EsClause[];
    must_not?: EsClause[];
    minimum_should_match?: number;
  };
}

export interface EsSortField {
  field: string;
  order: 'asc' | 'desc';
}

export interface EsSearchBody {
  query: EsBoolQuery;
  sort?: EsClause[];
  size?: number;
  from?: number;
  search_after?: ValueType[];
}

export function isEsFilterMetadata(
  x: EsFieldCondition | EsFilterMetadata,
): x is EsFilterMetadata {
  return 'logic' in x && 'filters' in x;
}

export function isEsFieldCondition(
  x: EsFieldCondition | EsFilterMetadata,
): x is EsFieldCondition {
  return 'field' in x && 'condition' in x;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -F @rfjs/es-query typecheck`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add packages/es-query/src/types.ts packages/es-query/src/errors.ts
git commit -m "feat(es-query): add core types and error classes"
```

---

### Task 3: Leaf clause builders

**Files:**
- Create: `packages/es-query/src/clauses.ts`
- Test: `packages/es-query/src/clauses.spec.ts`

**Interfaces:**
- Consumes: `EsClause`, `ValueType` from `./types`.
- Produces (each returns a raw `EsClause`; `value`/`values` are already coerced by the caller):
  - `term(field, value)` → `{ term: { [field]: value } }`
  - `terms(field, values)` → `{ terms: { [field]: values } }`
  - `range(field, { gte?, lte?, gt?, lt? })` → `{ range: { [field]: {...} } }`
  - `match(field, value)` → `{ match: { [field]: value } }`
  - `matchPhrase(field, value)` → `{ match_phrase: { [field]: value } }`
  - `multiMatch(fields, value)` → `{ multi_match: { query: value, fields } }`
  - `combinedFields(fields, value)` → `{ combined_fields: { query: value, fields } }`
  - `wildcard(field, pattern)` → `{ wildcard: { [field]: { value: pattern } } }`
  - `prefix(field, value)` → `{ prefix: { [field]: value } }`
  - `regexp(field, value)` → `{ regexp: { [field]: value } }`
  - `fuzzy(field, value)` → `{ fuzzy: { [field]: { value } } }`
  - `exists(field)` → `{ exists: { field } }`
  - `negate(clause)` → `{ bool: { must_not: [clause] } }`

- [ ] **Step 1: Write the failing test**

Create `packages/es-query/src/clauses.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as c from './clauses';

describe('leaf clause builders', () => {
  it('term', () => {
    expect(c.term('status', 'open')).toEqual({ term: { status: 'open' } });
  });
  it('terms', () => {
    expect(c.terms('tag', ['a', 'b'])).toEqual({ terms: { tag: ['a', 'b'] } });
  });
  it('range with bounds', () => {
    expect(c.range('age', { gte: 18, lte: 65 })).toEqual({
      range: { age: { gte: 18, lte: 65 } },
    });
  });
  it('match / match_phrase', () => {
    expect(c.match('body', 'hi')).toEqual({ match: { body: 'hi' } });
    expect(c.matchPhrase('body', 'hi there')).toEqual({ match_phrase: { body: 'hi there' } });
  });
  it('multi_match / combined_fields', () => {
    expect(c.multiMatch(['a', 'b'], 'x')).toEqual({ multi_match: { query: 'x', fields: ['a', 'b'] } });
    expect(c.combinedFields(['a', 'b'], 'x')).toEqual({ combined_fields: { query: 'x', fields: ['a', 'b'] } });
  });
  it('wildcard / prefix / regexp / fuzzy', () => {
    expect(c.wildcard('name', '*foo*')).toEqual({ wildcard: { name: { value: '*foo*' } } });
    expect(c.prefix('name', 'fo')).toEqual({ prefix: { name: 'fo' } });
    expect(c.regexp('name', 'fo.*')).toEqual({ regexp: { name: 'fo.*' } });
    expect(c.fuzzy('name', 'foo')).toEqual({ fuzzy: { name: { value: 'foo' } } });
  });
  it('exists / negate', () => {
    expect(c.exists('email')).toEqual({ exists: { field: 'email' } });
    expect(c.negate(c.exists('email'))).toEqual({
      bool: { must_not: [{ exists: { field: 'email' } }] },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/es-query vitest:run clauses`
Expected: FAIL — cannot find module `./clauses`.

- [ ] **Step 3: Write `clauses.ts`**

```ts
import type { EsClause, ValueType } from './types';

export const term = (field: string, value: ValueType): EsClause => ({
  term: { [field]: value },
});

export const terms = (field: string, values: ValueType[]): EsClause => ({
  terms: { [field]: values },
});

export interface RangeBounds {
  gte?: ValueType;
  lte?: ValueType;
  gt?: ValueType;
  lt?: ValueType;
}

export const range = (field: string, bounds: RangeBounds): EsClause => ({
  range: { [field]: { ...bounds } },
});

export const match = (field: string, value: ValueType): EsClause => ({
  match: { [field]: value },
});

export const matchPhrase = (field: string, value: ValueType): EsClause => ({
  match_phrase: { [field]: value },
});

export const multiMatch = (fields: string[], value: ValueType): EsClause => ({
  multi_match: { query: value, fields },
});

export const combinedFields = (fields: string[], value: ValueType): EsClause => ({
  combined_fields: { query: value, fields },
});

export const wildcard = (field: string, pattern: ValueType): EsClause => ({
  wildcard: { [field]: { value: pattern } },
});

export const prefix = (field: string, value: ValueType): EsClause => ({
  prefix: { [field]: value },
});

export const regexp = (field: string, value: ValueType): EsClause => ({
  regexp: { [field]: value },
});

export const fuzzy = (field: string, value: ValueType): EsClause => ({
  fuzzy: { [field]: { value } },
});

export const exists = (field: string): EsClause => ({
  exists: { field },
});

export const negate = (clause: EsClause): EsClause => ({
  bool: { must_not: [clause] },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/es-query vitest:run clauses`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/es-query/src/clauses.ts packages/es-query/src/clauses.spec.ts
git commit -m "feat(es-query): add leaf clause builders"
```

---

### Task 4: `toClause` dispatcher (operator → clause, with coercion, guard, dialect gate)

**Files:**
- Create: `packages/es-query/src/toClause.ts`
- Test: `packages/es-query/src/toClause.spec.ts`

**Interfaces:**
- Consumes: clause builders from `./clauses`; `typeTransfer` from `@rfjs/data-transform`; types + `UnsupportedClauseError` from `./types`/`./errors`.
- Produces:
  - `function toClause(cond: EsFieldCondition, dialect: EsDialect): EsClause`
  - Resolution rules:
    - Coerce each value via `typeTransfer(v, cond.dataType ?? 'any')`.
    - `eq`: `fieldType === 'text'` → `match`; else `term`. `neq`: negate of the `eq` clause.
    - `in` → `terms`; `notIn` → negate(`terms`).
    - `lt|lte|gt|gte` → `range` with the matching bound; `between` (2 values) → `range` `{ gte, lte }`.
    - `contains` → `wildcard(`*v*`)`; `startsWith` → `prefix`; `endsWith` → `wildcard(`*v`)`.
    - `exists` → `exists`; `isNull` → negate(`exists`).
    - `match|matchPhrase|fuzzy|regex` → matching clause.
    - `multiMatch` → `multiMatch(cond.fields ?? [field], v)`; `combinedFields` → dialect-gated, ES only.
  - Field-name guard: reject empty field or a field containing a newline (defensive); throw `EsQueryError`.

- [ ] **Step 1: Write the failing test**

Create `packages/es-query/src/toClause.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toClause } from './toClause';
import { UnsupportedClauseError, EsQueryError } from './errors';

const ES = 'elasticsearch' as const;

describe('toClause', () => {
  it('eq on keyword → term', () => {
    expect(toClause({ field: 'status', condition: 'eq', value: 'open' }, ES))
      .toEqual({ term: { status: 'open' } });
  });
  it('eq on text → match', () => {
    expect(toClause({ field: 'body', condition: 'eq', fieldType: 'text', value: 'hi' }, ES))
      .toEqual({ match: { body: 'hi' } });
  });
  it('neq → must_not term', () => {
    expect(toClause({ field: 'status', condition: 'neq', value: 'open' }, ES))
      .toEqual({ bool: { must_not: [{ term: { status: 'open' } }] } });
  });
  it('in → terms', () => {
    expect(toClause({ field: 'tag', condition: 'in', value: ['a', 'b'] }, ES))
      .toEqual({ terms: { tag: ['a', 'b'] } });
  });
  it('between with date coercion → range', () => {
    const r = toClause(
      { field: 'createdAt', condition: 'between', dataType: 'date', value: ['2020-01-01', '2020-12-31'] },
      ES,
    ) as { range: { createdAt: { gte: Date; lte: Date } } };
    expect(r.range.createdAt.gte).toBeInstanceOf(Date);
    expect(r.range.createdAt.lte).toBeInstanceOf(Date);
  });
  it('gt → range', () => {
    expect(toClause({ field: 'age', condition: 'gt', dataType: 'number', value: 18 }, ES))
      .toEqual({ range: { age: { gt: 18 } } });
  });
  it('contains → wildcard', () => {
    expect(toClause({ field: 'name', condition: 'contains', value: 'foo' }, ES))
      .toEqual({ wildcard: { name: { value: '*foo*' } } });
  });
  it('startsWith → prefix', () => {
    expect(toClause({ field: 'name', condition: 'startsWith', value: 'fo' }, ES))
      .toEqual({ prefix: { name: 'fo' } });
  });
  it('isNull → must_not exists', () => {
    expect(toClause({ field: 'email', condition: 'isNull', value: null }, ES))
      .toEqual({ bool: { must_not: [{ exists: { field: 'email' } }] } });
  });
  it('multiMatch uses fields', () => {
    expect(toClause({ field: 'q', condition: 'multiMatch', fields: ['a', 'b'], value: 'x' }, ES))
      .toEqual({ multi_match: { query: 'x', fields: ['a', 'b'] } });
  });
  it('combinedFields is ES-only', () => {
    expect(toClause({ field: 'q', condition: 'combinedFields', fields: ['a', 'b'], value: 'x' }, ES))
      .toEqual({ combined_fields: { query: 'x', fields: ['a', 'b'] } });
    expect(() => toClause({ field: 'q', condition: 'combinedFields', fields: ['a'], value: 'x' }, 'opensearch'))
      .toThrow(UnsupportedClauseError);
  });
  it('rejects empty field', () => {
    expect(() => toClause({ field: '', condition: 'eq', value: 'x' }, ES)).toThrow(EsQueryError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/es-query vitest:run toClause`
Expected: FAIL — cannot find module `./toClause`.

- [ ] **Step 3: Write `toClause.ts`**

```ts
import { typeTransfer, type ValueType } from '@rfjs/data-transform';
import * as c from './clauses';
import { EsQueryError, UnsupportedClauseError } from './errors';
import type { EsClause, EsDialect, EsFieldCondition } from './types';

/** Clauses unavailable on a given dialect. */
const DIALECT_UNSUPPORTED: Record<EsDialect, Set<string>> = {
  elasticsearch: new Set<string>(),
  opensearch: new Set<string>(['combined_fields']),
};

function guardField(field: string): void {
  if (!field || /[\n\r]/.test(field)) {
    throw new EsQueryError(`Invalid field name: ${JSON.stringify(field)}`);
  }
}

function gate(clause: string, dialect: EsDialect): void {
  if (DIALECT_UNSUPPORTED[dialect].has(clause)) {
    throw new UnsupportedClauseError(clause, dialect);
  }
}

export function toClause(cond: EsFieldCondition, dialect: EsDialect): EsClause {
  guardField(cond.field);
  const { field, condition, fieldType, dataType, fields } = cond;
  const raw = Array.isArray(cond.value) ? cond.value : [cond.value];
  const values: ValueType[] = raw.map((v) => typeTransfer(v, dataType ?? 'any'));
  const [first] = values;
  const targetFields = fields ?? [field];

  switch (condition) {
    case 'eq':
      return fieldType === 'text' ? c.match(field, first) : c.term(field, first);
    case 'neq':
      return c.negate(fieldType === 'text' ? c.match(field, first) : c.term(field, first));
    case 'in':
      return c.terms(field, values);
    case 'notIn':
      return c.negate(c.terms(field, values));
    case 'lt':
      return c.range(field, { lt: first });
    case 'lte':
      return c.range(field, { lte: first });
    case 'gt':
      return c.range(field, { gt: first });
    case 'gte':
      return c.range(field, { gte: first });
    case 'between':
      return c.range(field, { gte: values[0], lte: values[1] });
    case 'contains':
      return c.wildcard(field, `*${String(first)}*`);
    case 'startsWith':
      return c.prefix(field, first);
    case 'endsWith':
      return c.wildcard(field, `*${String(first)}`);
    case 'exists':
      return c.exists(field);
    case 'isNull':
      return c.negate(c.exists(field));
    case 'match':
      return c.match(field, first);
    case 'matchPhrase':
      return c.matchPhrase(field, first);
    case 'multiMatch':
      return c.multiMatch(targetFields, first);
    case 'combinedFields':
      gate('combined_fields', dialect);
      return c.combinedFields(targetFields, first);
    case 'fuzzy':
      return c.fuzzy(field, first);
    case 'regex':
      return c.regexp(field, first);
    default: {
      const exhaustive: never = condition;
      throw new EsQueryError(`Unknown condition: ${String(exhaustive)}`);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/es-query vitest:run toClause`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/es-query/src/toClause.ts packages/es-query/src/toClause.spec.ts
git commit -m "feat(es-query): add toClause dispatcher with coercion and dialect gate"
```

---

### Task 5: `buildEsQuery` (group metadata → nested bool)

**Files:**
- Create: `packages/es-query/src/buildEsQuery.ts`
- Test: `packages/es-query/src/buildEsQuery.spec.ts`

**Interfaces:**
- Consumes: `toClause`; types + guards from `./types`.
- Produces:
  - `interface BuildEsQueryOptions { dialect?: EsDialect }` (default `'elasticsearch'`)
  - `function buildEsQuery(metadata: EsFilterMetadata, opts?: BuildEsQueryOptions): EsBoolQuery`
  - Logic → bucket: `and→must`, `or→should` (+`minimum_should_match: 1`), `not→must_not`, `nor→must_not`. Each child is `toClause(...)` for a condition or a recursive `buildEsQuery(...)` for a nested group. Empty buckets are omitted.

- [ ] **Step 1: Write the failing test**

Create `packages/es-query/src/buildEsQuery.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildEsQuery } from './buildEsQuery';
import type { EsFilterMetadata } from './types';

describe('buildEsQuery', () => {
  it('and group → must', () => {
    const meta: EsFilterMetadata = {
      logic: 'and',
      filters: [
        { field: 'status', condition: 'eq', value: 'open' },
        { field: 'age', condition: 'gt', dataType: 'number', value: 18 },
      ],
    };
    expect(buildEsQuery(meta)).toEqual({
      bool: {
        must: [{ term: { status: 'open' } }, { range: { age: { gt: 18 } } }],
      },
    });
  });

  it('or group → should + minimum_should_match', () => {
    const meta: EsFilterMetadata = {
      logic: 'or',
      filters: [
        { field: 'a', condition: 'eq', value: '1' },
        { field: 'b', condition: 'eq', value: '2' },
      ],
    };
    expect(buildEsQuery(meta)).toEqual({
      bool: {
        should: [{ term: { a: '1' } }, { term: { b: '2' } }],
        minimum_should_match: 1,
      },
    });
  });

  it('nested or inside and', () => {
    const meta: EsFilterMetadata = {
      logic: 'and',
      filters: [
        { field: 'status', condition: 'eq', value: 'open' },
        {
          logic: 'or',
          filters: [
            { field: 'age', condition: 'gt', dataType: 'number', value: 18 },
            { field: 'vip', condition: 'eq', dataType: 'boolean', value: true },
          ],
        },
      ],
    };
    expect(buildEsQuery(meta)).toEqual({
      bool: {
        must: [
          { term: { status: 'open' } },
          {
            bool: {
              should: [{ range: { age: { gt: 18 } } }, { term: { vip: true } }],
              minimum_should_match: 1,
            },
          },
        ],
      },
    });
  });

  it('not group → must_not', () => {
    const meta: EsFilterMetadata = {
      logic: 'not',
      filters: [{ field: 'status', condition: 'eq', value: 'archived' }],
    };
    expect(buildEsQuery(meta)).toEqual({
      bool: { must_not: [{ term: { status: 'archived' } }] },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/es-query vitest:run buildEsQuery`
Expected: FAIL — cannot find module `./buildEsQuery`.

- [ ] **Step 3: Write `buildEsQuery.ts`**

```ts
import { toClause } from './toClause';
import {
  isEsFieldCondition,
  isEsFilterMetadata,
  type EsBoolQuery,
  type EsClause,
  type EsDialect,
  type EsFilterMetadata,
  type EsLogicalOperator,
} from './types';

export interface BuildEsQueryOptions {
  dialect?: EsDialect;
}

const BUCKET: Record<EsLogicalOperator, 'must' | 'should' | 'must_not'> = {
  and: 'must',
  or: 'should',
  not: 'must_not',
  nor: 'must_not',
};

export function buildEsQuery(
  metadata: EsFilterMetadata,
  opts: BuildEsQueryOptions = {},
): EsBoolQuery {
  const dialect = opts.dialect ?? 'elasticsearch';
  const bucket = BUCKET[metadata.logic] ?? 'must';

  const clauses: EsClause[] = metadata.filters.map((child) => {
    if (isEsFilterMetadata(child)) return buildEsQuery(child, opts);
    if (isEsFieldCondition(child)) return toClause(child, dialect);
    return {};
  });

  const bool: EsBoolQuery['bool'] = { [bucket]: clauses };
  if (metadata.logic === 'or') bool.minimum_should_match = 1;
  return { bool };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/es-query vitest:run buildEsQuery`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/es-query/src/buildEsQuery.ts packages/es-query/src/buildEsQuery.spec.ts
git commit -m "feat(es-query): add buildEsQuery group compiler"
```

---

### Task 6: `buildSearchBody` (sort / pagination wrapper)

**Files:**
- Create: `packages/es-query/src/buildSearchBody.ts`
- Test: `packages/es-query/src/buildSearchBody.spec.ts`

**Interfaces:**
- Consumes: `buildEsQuery`, `BuildEsQueryOptions`; types from `./types`.
- Produces:
  - `interface BuildSearchBodyOptions extends BuildEsQueryOptions { sort?: EsSortField[]; size?: number; from?: number; searchAfter?: ValueType[] }`
  - `function buildSearchBody(metadata: EsFilterMetadata, opts?: BuildSearchBodyOptions): EsSearchBody`
  - Maps `sort` → `[{ [field]: { order } }]`; copies `size`/`from`; maps `searchAfter` → `search_after`. Omits absent fields.

- [ ] **Step 1: Write the failing test**

Create `packages/es-query/src/buildSearchBody.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSearchBody } from './buildSearchBody';
import type { EsFilterMetadata } from './types';

const meta: EsFilterMetadata = {
  logic: 'and',
  filters: [{ field: 'status', condition: 'eq', value: 'open' }],
};

describe('buildSearchBody', () => {
  it('wraps query with no options', () => {
    expect(buildSearchBody(meta)).toEqual({
      query: { bool: { must: [{ term: { status: 'open' } }] } },
    });
  });

  it('adds sort, size, from, search_after', () => {
    expect(
      buildSearchBody(meta, {
        sort: [{ field: 'createdAt', order: 'desc' }],
        size: 20,
        from: 40,
        searchAfter: ['2020-01-01', 'id-1'],
      }),
    ).toEqual({
      query: { bool: { must: [{ term: { status: 'open' } }] } },
      sort: [{ createdAt: { order: 'desc' } }],
      size: 20,
      from: 40,
      search_after: ['2020-01-01', 'id-1'],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/es-query vitest:run buildSearchBody`
Expected: FAIL — cannot find module `./buildSearchBody`.

- [ ] **Step 3: Write `buildSearchBody.ts`**

```ts
import { buildEsQuery, type BuildEsQueryOptions } from './buildEsQuery';
import type {
  EsClause,
  EsFilterMetadata,
  EsSearchBody,
  EsSortField,
  ValueType,
} from './types';

export interface BuildSearchBodyOptions extends BuildEsQueryOptions {
  sort?: EsSortField[];
  size?: number;
  from?: number;
  searchAfter?: ValueType[];
}

export function buildSearchBody(
  metadata: EsFilterMetadata,
  opts: BuildSearchBodyOptions = {},
): EsSearchBody {
  const body: EsSearchBody = { query: buildEsQuery(metadata, opts) };

  if (opts.sort?.length) {
    body.sort = opts.sort.map(
      (s): EsClause => ({ [s.field]: { order: s.order } }),
    );
  }
  if (opts.size !== undefined) body.size = opts.size;
  if (opts.from !== undefined) body.from = opts.from;
  if (opts.searchAfter !== undefined) body.search_after = opts.searchAfter;

  return body;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/es-query vitest:run buildSearchBody`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/es-query/src/buildSearchBody.ts packages/es-query/src/buildSearchBody.spec.ts
git commit -m "feat(es-query): add buildSearchBody sort/pagination wrapper"
```

---

### Task 7: Barrel, build, README, changeset

**Files:**
- Modify: `packages/es-query/src/index.ts`
- Create: `packages/es-query/README.md`, `packages/es-query/README.zh-TW.md`
- Create: `.changeset/es-query-initial.md`

**Interfaces:**
- Consumes: all modules.
- Produces: public API surface (`buildEsQuery`, `buildSearchBody`, `toClause`, all clause builders, all types, errors) + a publishable build.

- [ ] **Step 1: Write the real barrel**

Replace `packages/es-query/src/index.ts`:
```ts
export * from './types';
export * from './errors';
export * from './clauses';
export * from './toClause';
export * from './buildEsQuery';
export * from './buildSearchBody';
```

- [ ] **Step 2: Run the full unit suite + typecheck + build**

Run:
```bash
pnpm -F @rfjs/es-query vitest:run
pnpm -F @rfjs/es-query typecheck
pnpm -F @rfjs/es-query build
```
Expected: all tests PASS; typecheck clean; `dist/index.{js,mjs,d.ts}` produced.

- [ ] **Step 3: Write `README.md` (English, neutral examples only)**

Cover: what it is (ES/OpenSearch Query DSL builder), install, the metadata tree shape, `buildEsQuery` vs `buildSearchBody`, the operator → clause table (copy §4 of the spec), the `dialect` flag + `combined_fields` gate, and a worked example matching the "nested or inside and" test. Do **not** reference any source project.

- [ ] **Step 4: Write `README.zh-TW.md`**

Traditional-Chinese translation of `README.md`, same examples. Cross-link en/zh at the top of each.

- [ ] **Step 5: Add a changeset**

Create `.changeset/es-query-initial.md`:
```markdown
---
'@rfjs/es-query': minor
---

Add `@rfjs/es-query` — compile a filter-tree to Elasticsearch / OpenSearch Query DSL bool queries, with a `dialect` flag and a `buildSearchBody` sort/pagination wrapper.
```

- [ ] **Step 6: Commit**

```bash
git add packages/es-query/src/index.ts packages/es-query/README.md packages/es-query/README.zh-TW.md .changeset/es-query-initial.md
git commit -m "feat(es-query): export public API, add READMEs and changeset"
```

---

## Self-Review

**Spec coverage (§ of `2026-06-25-es-query-builder-design.md`):**
- §2.1 es-query (build split, dialect, no third-party deps, data-transform reuse) → Tasks 1–7. ✅
- §4 group logic map → Task 5; operator→clause table → Tasks 3–4; field-type awareness → Task 4 (`eq` term/match); value coercion (R1) → Task 4; sort/pagination (R2) → Task 6. ✅
- §5 dialect gate + typed error → Tasks 2 (`UnsupportedClauseError`) + 4 (`combined_fields` gate). ✅
- §7 docs (en+zh, neutral), changeset, flat layout, co-located specs → Task 7 + structure. ✅
- **Out of this plan (separate follow-on plans):** §2.2 `@rfjs/es-client`, §3 filter-builder engine + `apps/web` tool, `packageRegistry` registration. Tracked as Plans 2–4.

**Placeholder scan:** none — every code/test step contains full content.

**Type consistency:** `EsFilterMetadata`/`EsFieldCondition`/`EsConditionType`/`EsClause`/`EsBoolQuery`/`EsSearchBody` defined in Task 2 are used verbatim in Tasks 3–6. `toClause(cond, dialect)` signature (Task 4) is called the same way in Task 5. `buildEsQuery(metadata, opts)` (Task 5) is consumed unchanged by Task 6. ✅

---

## Follow-on plans (not in this plan)

1. **`@rfjs/es-client`** — `SearchTransport` + `fromElasticClient`/`fromOpenSearchClient` adapters + `search`/`count`/`msearch` + `paginateAll` (search_after + PIT) + generic highlight. Depends on this package.
2. **filter-builder engine** — register `getEngine('es-query')`; declare ES operators via `arity.ts`/`operators()`.
3. **apps/web tool** — `src/tools/es-query/` interactive demo (tree editor + live JSON + dialect toggle) + en/zh i18n; register both packages in `packageRegistry`.
