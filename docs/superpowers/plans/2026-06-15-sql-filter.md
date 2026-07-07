# `@rfjs/sql-filter` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@rfjs/sql-filter` — a generic boolean filter-group engine (and/or/nor/not, nesting, empty-group identity, param offsetting) with a pluggable leaf renderer and a built-in column leaf that emits parameterized PostgreSQL WHERE/ORDER BY.

**Architecture:** A leaf-agnostic engine (`buildFilterGroup`) mirrors `@rfjs/jsonb-query`'s group machinery; the jsonb-specific leaf is replaced by a pluggable `renderLeaf` callback. A built-in column leaf renders `"col" <op> $n` against a consumer-declared `ColumnConfig` (allowlist + type). Pure string/param building — no DB, no runtime deps.

**Tech Stack:** TypeScript 5.7, tsdown (esm+cjs), Vitest 3, pnpm workspace. Mirrors `packages/jsonb-query` package shape. Public/ISC package, version 0.0.0 (publish later via changesets).

**Spec:** `docs/superpowers/specs/2026-06-15-sql-filter-design.md`

---

## File Structure

```
packages/sql-filter/
  package.json            @rfjs/sql-filter (public), mirror jsonb-query minus pg/e2e
  tsconfig.json, tsconfig.build.json, tsdown.config.ts, vitest.config.mts   (copied from jsonb-query)
  README.md
  src/
    types.ts              LogicalOperator, FilterGroup<L>
    param-builder.ts      ParamBuilder
    errors.ts             ColumnQueryError + ColumnQueryErrorCode
    engine.ts             buildFilterGroup<L>(group, renderLeaf, params)
    column/
      config.ts           ColumnType, ColumnConfig
      ident.ts            quoteIdent (internal)
      operators.ts        ColumnOperator, applicability table, renderColumnCondition
      leaf.ts             ColumnCondition, makeColumnLeafRenderer
      build.ts            buildColumnQuery
      order-by.ts         ColumnSortSpec, buildColumnOrderBy
      index.ts            column barrel
    index.ts              package barrel
```

---

## Task 1: Scaffold `packages/sql-filter` + ParamBuilder

**Files:**
- Copy from `packages/jsonb-query`: `tsconfig.json`, `tsconfig.build.json`, `tsdown.config.ts`, `vitest.config.mts`
- Create: `packages/sql-filter/package.json`, `README.md`, `src/index.ts`, `src/param-builder.ts`
- Test: `src/param-builder.spec.ts`

- [ ] **Step 1: Copy config files from jsonb-query**

```bash
mkdir -p packages/sql-filter/src/column
cp packages/jsonb-query/tsconfig.json packages/sql-filter/tsconfig.json
cp packages/jsonb-query/tsconfig.build.json packages/sql-filter/tsconfig.build.json
cp packages/jsonb-query/tsdown.config.ts packages/sql-filter/tsdown.config.ts
cp packages/jsonb-query/vitest.config.mts packages/sql-filter/vitest.config.mts
```
(If `tsconfig.build.json` does not exist in jsonb-query, check what `tsdown.config.ts` references via its `tsconfig:` field and copy that file instead; report what you found.)

- [ ] **Step 2: Write `packages/sql-filter/package.json`**

```json
{
  "name": "@rfjs/sql-filter",
  "version": "0.0.0",
  "description": "Generic boolean filter-group to SQL builder with pluggable leaf renderers (built-in column leaf)",
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
  "publishConfig": { "access": "public" },
  "scripts": {
    "clean": "pnpm exec npm-run-all --parallel clean:dist clean:types",
    "clean:types": "pnpm exec rimraf ./types",
    "clean:dist": "pnpm exec rimraf ./dist",
    "build": "pnpm run build:tsdown",
    "build:tsdown": "pnpm run clean && tsdown --config-loader unrun",
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
    "lint:fix": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "pnpm run vitest:run",
    "vitest:run": "vitest --passWithNoTests --run"
  },
  "keywords": ["sql", "filter", "query-builder", "where", "postgresql"],
  "author": "Roy Chuang",
  "license": "ISC",
  "repository": { "type": "git", "url": "git+https://github.com/royfw/rfjs.git", "directory": "packages/sql-filter" },
  "bugs": "https://github.com/royfw/rfjs/issues",
  "homepage": "https://github.com/royfw/rfjs/tree/main/packages/sql-filter#readme",
  "files": ["dist", "README.md"],
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "npm-run-all": "^4.1.5",
    "prettier": "^3.5.1",
    "rimraf": "^6.0.1",
    "tsdown": "0.17.0-beta.6",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.24.0",
    "vitest": "^3.2.3"
  }
}
```

- [ ] **Step 3: Write a minimal `packages/sql-filter/README.md`**

```markdown
# @rfjs/sql-filter

Generic boolean filter-group → SQL builder with pluggable leaf renderers. Built-in column leaf renders parameterized PostgreSQL `WHERE` / `ORDER BY` against a declared column allowlist.

See `docs/superpowers/specs/2026-06-15-sql-filter-design.md`.
```

- [ ] **Step 4: Write the failing test — `packages/sql-filter/src/param-builder.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ParamBuilder } from './param-builder';

describe('ParamBuilder', () => {
  it('emits sequential placeholders and collects values', () => {
    const p = new ParamBuilder();
    expect(p.add('a')).toBe('$1');
    expect(p.add('b')).toBe('$2');
    expect(p.values).toEqual(['a', 'b']);
  });

  it('honors a starting offset', () => {
    const p = new ParamBuilder(2);
    expect(p.add('x')).toBe('$3');
    expect(p.values).toEqual(['x']);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm install && pnpm --filter @rfjs/sql-filter vitest:run`
Expected: FAIL — cannot find module './param-builder'.

- [ ] **Step 6: Write `packages/sql-filter/src/param-builder.ts`**

```ts
export class ParamBuilder {
  private _values: unknown[] = [];

  constructor(private readonly offset = 0) {}

  add(value: unknown): string {
    this._values.push(value);
    return `$${this.offset + this._values.length}`;
  }

  get values(): unknown[] {
    return [...this._values];
  }
}
```

- [ ] **Step 7: Write `packages/sql-filter/src/index.ts`** (placeholder barrel; grows in Task 7)

```ts
export * from './param-builder';
```

- [ ] **Step 8: Run test + typecheck**

Run: `pnpm --filter @rfjs/sql-filter vitest:run && pnpm --filter @rfjs/sql-filter typecheck`
Expected: PASS (2 tests), typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add packages/sql-filter pnpm-lock.yaml
git commit -m "feat(sql-filter): scaffold package + ParamBuilder"
```

---

## Task 2: types + errors

**Files:**
- Create: `packages/sql-filter/src/types.ts`, `packages/sql-filter/src/errors.ts`
- Test: `packages/sql-filter/src/errors.spec.ts`

- [ ] **Step 1: Write the failing test — `packages/sql-filter/src/errors.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ColumnQueryError } from './errors';

describe('ColumnQueryError', () => {
  it('is an Error carrying a typed code and name', () => {
    const err = new ColumnQueryError('nope', 'UNKNOWN_COLUMN');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('UNKNOWN_COLUMN');
    expect(err.name).toBe('ColumnQueryError');
    expect(err.message).toBe('nope');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @rfjs/sql-filter vitest:run`
Expected: FAIL — cannot find module './errors'.

- [ ] **Step 3: Write `packages/sql-filter/src/types.ts`**

```ts
export type LogicalOperator = 'and' | 'or' | 'nor' | 'not';

export type FilterGroup<L> = {
  logic: LogicalOperator;
  filters: Array<L | FilterGroup<L>>;
};
```

- [ ] **Step 4: Write `packages/sql-filter/src/errors.ts`**

```ts
export type ColumnQueryErrorCode =
  | 'UNKNOWN_COLUMN'
  | 'UNSUPPORTED_OPERATOR'
  | 'INVALID_VALUE'
  | 'INVALID_SORT'
  | 'INVALID_PARAM_OFFSET';

export class ColumnQueryError extends Error {
  constructor(
    message: string,
    readonly code: ColumnQueryErrorCode,
  ) {
    super(message);
    this.name = 'ColumnQueryError';
  }
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm --filter @rfjs/sql-filter vitest:run && pnpm --filter @rfjs/sql-filter typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add packages/sql-filter/src/types.ts packages/sql-filter/src/errors.ts packages/sql-filter/src/errors.spec.ts
git commit -m "feat(sql-filter): LogicalOperator/FilterGroup types + ColumnQueryError"
```

---

## Task 3: the generic engine (`buildFilterGroup`)

**Files:**
- Create: `packages/sql-filter/src/engine.ts`
- Test: `packages/sql-filter/src/engine.spec.ts`

- [ ] **Step 1: Write the failing test — `packages/sql-filter/src/engine.spec.ts`**

(Uses a fake leaf renderer so the engine is tested independently of any leaf type. The fake leaf is `{ sql: string }` and renders its `sql`, pushing one param so offset behavior is observable.)

```ts
import { describe, it, expect } from 'vitest';
import { ParamBuilder } from './param-builder';
import { buildFilterGroup } from './engine';
import type { FilterGroup } from './types';

type FakeLeaf = { token: string };
const renderFake = (leaf: FakeLeaf, p: ParamBuilder) => `${leaf.token}=${p.add(leaf.token)}`;
const g = (group: FilterGroup<FakeLeaf>) => {
  const p = new ParamBuilder();
  return { sql: buildFilterGroup(group, renderFake, p), values: p.values };
};

describe('buildFilterGroup', () => {
  it('joins leaves with the group logic', () => {
    expect(g({ logic: 'and', filters: [{ token: 'a' }, { token: 'b' }] }).sql).toBe('a=$1 and b=$2');
    expect(g({ logic: 'or', filters: [{ token: 'a' }, { token: 'b' }] }).sql).toBe('a=$1 or b=$2');
  });

  it('negates not/nor', () => {
    expect(g({ logic: 'not', filters: [{ token: 'a' }, { token: 'b' }] }).sql).toBe('not (a=$1 and b=$2)');
    expect(g({ logic: 'nor', filters: [{ token: 'a' }, { token: 'b' }] }).sql).toBe('not (a=$1 or b=$2)');
  });

  it('applies empty-group identity', () => {
    expect(g({ logic: 'and', filters: [] }).sql).toBe('true');
    expect(g({ logic: 'or', filters: [] }).sql).toBe('false');
    expect(g({ logic: 'not', filters: [] }).sql).toBe('false');
    expect(g({ logic: 'nor', filters: [] }).sql).toBe('true');
  });

  it('wraps nested groups in parentheses', () => {
    const r = g({
      logic: 'and',
      filters: [{ token: 'a' }, { logic: 'or', filters: [{ token: 'b' }, { token: 'c' }] }],
    });
    expect(r.sql).toBe('a=$1 and (b=$2 or c=$3)');
    expect(r.values).toEqual(['a', 'b', 'c']);
  });

  it('continues placeholder numbering from the ParamBuilder offset', () => {
    const p = new ParamBuilder(5);
    const sql = buildFilterGroup({ logic: 'and', filters: [{ token: 'a' }] }, renderFake, p);
    expect(sql).toBe('a=$6');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @rfjs/sql-filter vitest:run`
Expected: FAIL — cannot find module './engine'.

- [ ] **Step 3: Write `packages/sql-filter/src/engine.ts`**

```ts
import { ParamBuilder } from './param-builder';
import type { FilterGroup, LogicalOperator } from './types';

const EMPTY_GROUP_IDENTITY: Record<LogicalOperator, string> = {
  and: 'true',
  or: 'false',
  not: 'false', // not(AND of nothing) = not(true)
  nor: 'true', // not(OR of nothing) = not(false)
};

function isFilterGroup<L>(node: L | FilterGroup<L>): node is FilterGroup<L> {
  return (
    typeof node === 'object' &&
    node !== null &&
    'logic' in node &&
    'filters' in node &&
    Array.isArray((node as { filters: unknown }).filters)
  );
}

function joinLogic(parts: string[], logic: LogicalOperator): string {
  if (parts.length === 0) return EMPTY_GROUP_IDENTITY[logic];
  const joined = parts.join(logic === 'or' || logic === 'nor' ? ' or ' : ' and ');
  return logic === 'not' || logic === 'nor' ? `not (${joined})` : joined;
}

function wrap(sql: string): string {
  return sql.length > 0 ? `(${sql})` : '';
}

/**
 * Render a nested filter group to a parameterized SQL boolean expression.
 * Leaf rendering is delegated to `renderLeaf`, making the engine independent of
 * what a leaf is (column condition, jsonb condition, etc.).
 */
export function buildFilterGroup<L>(
  group: FilterGroup<L>,
  renderLeaf: (leaf: L, params: ParamBuilder) => string,
  params: ParamBuilder,
): string {
  const parts = group.filters
    .map((node) =>
      isFilterGroup(node)
        ? wrap(buildFilterGroup(node, renderLeaf, params))
        : renderLeaf(node, params),
    )
    .filter((sql) => sql.length > 0);
  return joinLogic(parts, group.logic);
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm --filter @rfjs/sql-filter vitest:run && pnpm --filter @rfjs/sql-filter typecheck`
Expected: PASS (5 engine tests), clean.

- [ ] **Step 5: Commit**

```bash
git add packages/sql-filter/src/engine.ts packages/sql-filter/src/engine.spec.ts packages/sql-filter/src/types.ts
git commit -m "feat(sql-filter): generic buildFilterGroup engine (pluggable leaf)"
```

---

## Task 4: column config + ident + operators

**Files:**
- Create: `packages/sql-filter/src/column/config.ts`, `packages/sql-filter/src/column/ident.ts`, `packages/sql-filter/src/column/operators.ts`
- Test: `packages/sql-filter/src/column/operators.spec.ts`

- [ ] **Step 1: Write the failing test — `packages/sql-filter/src/column/operators.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ParamBuilder } from '../param-builder';
import { ColumnQueryError } from '../errors';
import { renderColumnCondition } from './operators';

const render = (type: Parameters<typeof renderColumnCondition>[1], op: Parameters<typeof renderColumnCondition>[2], value?: unknown) => {
  const p = new ParamBuilder();
  const sql = renderColumnCondition('"name"', type, op, value, p);
  return { sql, values: p.values };
};

describe('renderColumnCondition', () => {
  it('renders comparison operators with a positional param', () => {
    expect(render('text', 'eq', 'x')).toEqual({ sql: '"name" = $1', values: ['x'] });
    expect(render('numeric', 'gte', 5)).toEqual({ sql: '"name" >= $1', values: [5] });
    expect(render('text', 'neq', 'y')).toEqual({ sql: '"name" <> $1', values: ['y'] });
  });

  it('renders text contains/startswith as parameterized ILIKE', () => {
    expect(render('text', 'contains', 'ab')).toEqual({ sql: "\"name\" ilike '%' || $1 || '%'", values: ['ab'] });
    expect(render('text', 'startswith', 'ab')).toEqual({ sql: "\"name\" ilike $1 || '%'", values: ['ab'] });
  });

  it('renders nullary operators without a param', () => {
    expect(render('uuid', 'isnull')).toEqual({ sql: '"name" is null', values: [] });
    expect(render('uuid', 'isnotnull')).toEqual({ sql: '"name" is not null', values: [] });
  });

  it('rejects an operator not allowed for the column type', () => {
    expect(() => render('numeric', 'contains', 'x')).toThrow(ColumnQueryError);
    expect(() => render('boolean', 'gt', true)).toThrow(ColumnQueryError);
  });

  it('rejects a value on a nullary operator and a missing value on others', () => {
    expect(() => render('text', 'isnull', 'x')).toThrow(ColumnQueryError);
    expect(() => render('text', 'eq', undefined)).toThrow(ColumnQueryError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @rfjs/sql-filter vitest:run`
Expected: FAIL — cannot find module './operators'.

- [ ] **Step 3: Write `packages/sql-filter/src/column/config.ts`**

```ts
export type ColumnType = 'text' | 'numeric' | 'timestamp' | 'boolean' | 'uuid';

export type ColumnConfig = Record<string, { column: string; type: ColumnType }>;
```

- [ ] **Step 4: Write `packages/sql-filter/src/column/ident.ts`**

```ts
/** Quote a SQL identifier. Identifiers come from ColumnConfig, never user input. */
export function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}
```

- [ ] **Step 5: Write `packages/sql-filter/src/column/operators.ts`**

```ts
import { ParamBuilder } from '../param-builder';
import { ColumnQueryError } from '../errors';
import type { ColumnType } from './config';

export type ColumnOperator =
  | 'eq'
  | 'neq'
  | 'isnull'
  | 'isnotnull'
  | 'contains'
  | 'startswith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

const NULLARY = new Set<ColumnOperator>(['isnull', 'isnotnull']);

const ALLOWED: Record<ColumnType, ReadonlySet<ColumnOperator>> = {
  text: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'contains', 'startswith', 'gt', 'gte', 'lt', 'lte']),
  numeric: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'gt', 'gte', 'lt', 'lte']),
  timestamp: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'gt', 'gte', 'lt', 'lte']),
  boolean: new Set(['eq', 'neq', 'isnull', 'isnotnull']),
  uuid: new Set(['eq', 'neq', 'isnull', 'isnotnull']),
};

const COMPARATORS: Partial<Record<ColumnOperator, string>> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

export function renderColumnCondition(
  quotedColumn: string,
  type: ColumnType,
  operator: ColumnOperator,
  value: unknown,
  params: ParamBuilder,
): string {
  if (!ALLOWED[type].has(operator)) {
    throw new ColumnQueryError(
      `Operator "${operator}" is not supported for ${type} column`,
      'UNSUPPORTED_OPERATOR',
    );
  }
  if (NULLARY.has(operator)) {
    if (value !== undefined) {
      throw new ColumnQueryError(`Operator "${operator}" must not carry a value`, 'INVALID_VALUE');
    }
    return operator === 'isnull' ? `${quotedColumn} is null` : `${quotedColumn} is not null`;
  }
  if (value === undefined) {
    throw new ColumnQueryError(`Operator "${operator}" requires a value`, 'INVALID_VALUE');
  }
  if (operator === 'contains') {
    return `${quotedColumn} ilike '%' || ${params.add(value)} || '%'`;
  }
  if (operator === 'startswith') {
    return `${quotedColumn} ilike ${params.add(value)} || '%'`;
  }
  return `${quotedColumn} ${COMPARATORS[operator]} ${params.add(value)}`;
}
```

- [ ] **Step 6: Run test + typecheck**

Run: `pnpm --filter @rfjs/sql-filter vitest:run && pnpm --filter @rfjs/sql-filter typecheck`
Expected: PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add packages/sql-filter/src/column/config.ts packages/sql-filter/src/column/ident.ts packages/sql-filter/src/column/operators.ts packages/sql-filter/src/column/operators.spec.ts
git commit -m "feat(sql-filter): column config + operators (type-aware, parameterized)"
```

---

## Task 5: column leaf + `buildColumnQuery`

**Files:**
- Create: `packages/sql-filter/src/column/leaf.ts`, `packages/sql-filter/src/column/build.ts`
- Test: `packages/sql-filter/src/column/build.spec.ts`

- [ ] **Step 1: Write the failing test — `packages/sql-filter/src/column/build.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ColumnQueryError } from '../errors';
import { buildColumnQuery } from './build';
import type { ColumnConfig } from './config';

const config: ColumnConfig = {
  name: { column: 'name', type: 'text' },
  createdAt: { column: 'created_at', type: 'timestamp' },
};

describe('buildColumnQuery', () => {
  it('builds a parameterized WHERE over allowlisted columns', () => {
    const r = buildColumnQuery(config, {
      logic: 'and',
      filters: [
        { column: 'name', operator: 'contains', value: 'sales' },
        { column: 'createdAt', operator: 'gte', value: '2026-01-01' },
      ],
    });
    expect(r.where).toBe('"name" ilike \'%\' || $1 || \'%\' and "created_at" >= $2');
    expect(r.values).toEqual(['sales', '2026-01-01']);
  });

  it('supports nested logic and the paramOffset option', () => {
    const r = buildColumnQuery(
      config,
      {
        logic: 'or',
        filters: [
          { column: 'name', operator: 'eq', value: 'a' },
          { logic: 'and', filters: [{ column: 'name', operator: 'eq', value: 'b' }] },
        ],
      },
      { paramOffset: 3 },
    );
    expect(r.where).toBe('"name" = $4 or ("name" = $5)');
    expect(r.values).toEqual(['a', 'b']);
  });

  it('rejects a column not in the config', () => {
    expect(() =>
      buildColumnQuery(config, { logic: 'and', filters: [{ column: 'evil', operator: 'eq', value: 1 }] }),
    ).toThrow(ColumnQueryError);
  });

  it('rejects a negative/non-integer paramOffset', () => {
    expect(() => buildColumnQuery(config, { logic: 'and', filters: [] }, { paramOffset: -1 })).toThrow(
      ColumnQueryError,
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @rfjs/sql-filter vitest:run`
Expected: FAIL — cannot find module './build'.

- [ ] **Step 3: Write `packages/sql-filter/src/column/leaf.ts`**

```ts
import { ParamBuilder } from '../param-builder';
import { ColumnQueryError } from '../errors';
import type { ColumnConfig } from './config';
import { quoteIdent } from './ident';
import { renderColumnCondition, type ColumnOperator } from './operators';

export type ColumnCondition = {
  column: string;
  operator: ColumnOperator;
  value?: unknown;
};

export function makeColumnLeafRenderer(
  config: ColumnConfig,
): (leaf: ColumnCondition, params: ParamBuilder) => string {
  return (leaf, params) => {
    const def = config[leaf.column];
    if (!def) {
      throw new ColumnQueryError(`Unknown column: ${JSON.stringify(leaf.column)}`, 'UNKNOWN_COLUMN');
    }
    return renderColumnCondition(quoteIdent(def.column), def.type, leaf.operator, leaf.value, params);
  };
}
```

- [ ] **Step 4: Write `packages/sql-filter/src/column/build.ts`**

```ts
import { ParamBuilder } from '../param-builder';
import { buildFilterGroup } from '../engine';
import { ColumnQueryError } from '../errors';
import type { FilterGroup } from '../types';
import type { ColumnConfig } from './config';
import { makeColumnLeafRenderer, type ColumnCondition } from './leaf';

export function buildColumnQuery(
  config: ColumnConfig,
  group: FilterGroup<ColumnCondition>,
  options: { paramOffset?: number } = {},
): { where: string; values: unknown[] } {
  const offset = options.paramOffset ?? 0;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ColumnQueryError(`Invalid paramOffset: ${String(offset)}`, 'INVALID_PARAM_OFFSET');
  }
  const params = new ParamBuilder(offset);
  const where = buildFilterGroup(group, makeColumnLeafRenderer(config), params);
  return { where, values: params.values };
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm --filter @rfjs/sql-filter vitest:run && pnpm --filter @rfjs/sql-filter typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add packages/sql-filter/src/column/leaf.ts packages/sql-filter/src/column/build.ts packages/sql-filter/src/column/build.spec.ts
git commit -m "feat(sql-filter): column leaf renderer + buildColumnQuery"
```

---

## Task 6: `buildColumnOrderBy`

**Files:**
- Create: `packages/sql-filter/src/column/order-by.ts`
- Test: `packages/sql-filter/src/column/order-by.spec.ts`

- [ ] **Step 1: Write the failing test — `packages/sql-filter/src/column/order-by.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ColumnQueryError } from '../errors';
import { buildColumnOrderBy } from './order-by';
import type { ColumnConfig } from './config';

const config: ColumnConfig = {
  name: { column: 'name', type: 'text' },
  createdAt: { column: 'created_at', type: 'timestamp' },
};

describe('buildColumnOrderBy', () => {
  it('renders multiple sort keys with direction and nulls', () => {
    const r = buildColumnOrderBy(config, [
      { column: 'createdAt', direction: 'desc' },
      { column: 'name', direction: 'asc', nulls: 'last' },
    ]);
    expect(r.orderBy).toBe('"created_at" desc, "name" asc nulls last');
    expect(r.values).toEqual([]);
  });

  it('defaults direction to asc', () => {
    expect(buildColumnOrderBy(config, [{ column: 'name' }]).orderBy).toBe('"name" asc');
  });

  it('rejects an unknown column and an invalid direction/nulls', () => {
    expect(() => buildColumnOrderBy(config, [{ column: 'evil' }])).toThrow(ColumnQueryError);
    expect(() =>
      buildColumnOrderBy(config, [{ column: 'name', direction: 'sideways' as never }]),
    ).toThrow(ColumnQueryError);
    expect(() => buildColumnOrderBy(config, [{ column: 'name', nulls: 'middle' as never }])).toThrow(
      ColumnQueryError,
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @rfjs/sql-filter vitest:run`
Expected: FAIL — cannot find module './order-by'.

- [ ] **Step 3: Write `packages/sql-filter/src/column/order-by.ts`**

```ts
import { ColumnQueryError } from '../errors';
import type { ColumnConfig } from './config';
import { quoteIdent } from './ident';

export type ColumnSortSpec = {
  column: string;
  direction?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
};

export function buildColumnOrderBy(
  config: ColumnConfig,
  sorts: ColumnSortSpec[],
): { orderBy: string; values: unknown[] } {
  const parts = sorts.map((spec) => {
    const def = config[spec.column];
    if (!def) {
      throw new ColumnQueryError(`Unknown column: ${JSON.stringify(spec.column)}`, 'UNKNOWN_COLUMN');
    }
    const direction = spec.direction ?? 'asc';
    if (direction !== 'asc' && direction !== 'desc') {
      throw new ColumnQueryError(`Invalid sort direction: ${JSON.stringify(direction)}`, 'INVALID_SORT');
    }
    let sql = `${quoteIdent(def.column)} ${direction}`;
    if (spec.nulls !== undefined) {
      if (spec.nulls !== 'first' && spec.nulls !== 'last') {
        throw new ColumnQueryError(`Invalid sort nulls: ${JSON.stringify(spec.nulls)}`, 'INVALID_SORT');
      }
      sql += ` nulls ${spec.nulls}`;
    }
    return sql;
  });
  return { orderBy: parts.join(', '), values: [] };
}
```

(Note: `buildColumnOrderBy` takes no `paramOffset` — column ORDER BY produces no parameters. The spec mentioned an offset option "for composition"; since there are zero params it is unnecessary, so it is omitted to avoid a dead parameter. The datasets layer composes ORDER BY positionally without needing it.)

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm --filter @rfjs/sql-filter vitest:run && pnpm --filter @rfjs/sql-filter typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add packages/sql-filter/src/column/order-by.ts packages/sql-filter/src/column/order-by.spec.ts
git commit -m "feat(sql-filter): buildColumnOrderBy"
```

---

## Task 7: barrels, build, public surface

**Files:**
- Create: `packages/sql-filter/src/column/index.ts`
- Modify: `packages/sql-filter/src/index.ts`

- [ ] **Step 1: Write `packages/sql-filter/src/column/index.ts`** (note: `ident.ts` stays internal — not exported)

```ts
export * from './config';
export * from './operators';
export * from './leaf';
export * from './build';
export * from './order-by';
```

- [ ] **Step 2: Replace `packages/sql-filter/src/index.ts`**

```ts
export * from './types';
export * from './param-builder';
export * from './errors';
export * from './engine';
export * from './column';
```

- [ ] **Step 3: Typecheck, build, run full suite**

```bash
pnpm --filter @rfjs/sql-filter typecheck
pnpm --filter @rfjs/sql-filter build
pnpm --filter @rfjs/sql-filter vitest:run
```
Expected: all clean; build emits `dist/index.{js,mjs,d.ts}`.

- [ ] **Step 4: Confirm the public surface in the built d.ts**

Grep `dist/index.d.ts` (or `dist/index.d.mts`) and confirm these names are reachable: `buildFilterGroup`, `ParamBuilder`, `FilterGroup`, `LogicalOperator`, `ColumnQueryError`, `ColumnQueryErrorCode`, `ColumnConfig`, `ColumnType`, `ColumnCondition`, `ColumnOperator`, `makeColumnLeafRenderer`, `buildColumnQuery`, `buildColumnOrderBy`, `ColumnSortSpec`. Confirm `quoteIdent` is NOT exported (internal).

- [ ] **Step 5: Commit**

```bash
git add packages/sql-filter/src
git commit -m "feat(sql-filter): package barrels + public surface"
```

---

## Final verification

- [ ] **Tests:** `pnpm --filter @rfjs/sql-filter vitest:run` — all pass (param-builder 2, errors 1, engine 5, operators 5, build 4, order-by 3).
- [ ] **Build + typecheck:** `pnpm --filter @rfjs/sql-filter build && pnpm --filter @rfjs/sql-filter typecheck` — clean.
- [ ] **Pure / no runtime deps:** `packages/sql-filter/package.json` has no `dependencies` block (pure string builder).
- [ ] **No committed artifacts:** `dist/`, `types/` are gitignored (inherit root or add `packages/sql-filter/.gitignore` mirroring jsonb-query if its dist isn't covered by root gitignore — check `git status` after build).

## Notes / out of scope (per spec)

- Enhancement operators (`in`, `endswith`, `between/range`, case-insensitive variants, boolean/uuid comparisons) — deferred to a later "strengthen" iteration.
- Sub-project 2 (datasets consuming `@rfjs/sql-filter` + `@rfjs/jsonb-query` for the unified column+jsonb tree, sort/pagination/total) — its own spec/plan.
- Refactoring `@rfjs/jsonb-query` to reuse this engine — deferred.
- npm publish (changeset flow) — separate.
