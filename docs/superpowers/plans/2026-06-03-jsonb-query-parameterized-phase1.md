# jsonb-query Parameterized Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@rfjs/jsonb-query`'s string-interpolated SQL with parameterized (`$1,$2`) output and a dual `legacy`/`jsonpath` dialect, scoped to scalar data types.

**Architecture:** A shared `ParamBuilder` assigns `$N` placeholders and collects values; a `ScalarDialect` interface has two implementations (`legacy`, `jsonpath`); a dialect-agnostic recursive composer (`buildJsonbQuery`/`buildGroup`) walks the filter tree. User values and field paths are parameterized; the column is validated and quoted.

**Tech Stack:** TypeScript 5.7, Vitest, tsdown (ESM+CJS build). PostgreSQL 12+ for the `jsonpath` dialect (13+ for date comparisons).

**Spec:** `docs/superpowers/specs/2026-06-03-jsonb-query-parameterized-design.md`

**Working directory:** `packages/jsonb-query`. Run tests with `pnpm exec vitest run <path>` from that directory.

---

## Task 1: Public types

**Files:**
- Create: `packages/jsonb-query/src/types.ts`

No test (pure type declarations; verified by later tasks' typecheck).

- [ ] **Step 1: Write `types.ts`**

```ts
export type JsonbDialect = 'legacy' | 'jsonpath';

export type JsonbScalarType = 'string' | 'numeric' | 'date' | 'boolean';

export type JsonbValue = string | number | boolean | Date;

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

export interface JsonbCondition {
  field: string;
  dataType: JsonbScalarType;
  operator: JsonbScalarOperator;
  value?: JsonbValue | JsonbValue[];
}

export interface JsonbFilterGroup {
  logic: JsonbLogicalOperator;
  filters: Array<JsonbCondition | JsonbFilterGroup>;
}

export interface JsonbQueryResult {
  where: string;
  values: unknown[];
  from: string[];
}

export interface BuildJsonbOptions {
  dialect?: JsonbDialect;
  paramOffset?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/jsonb-query/src/types.ts
git commit -m "feat(jsonb-query): add Phase 1 public types"
```

---

## Task 2: ParamBuilder

**Files:**
- Create: `packages/jsonb-query/src/param-builder.ts`
- Test: `packages/jsonb-query/src/param-builder.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { ParamBuilder } from './param-builder';

describe('ParamBuilder', () => {
  it('numbers placeholders from $1 and collects values in order', () => {
    const p = new ParamBuilder();
    expect(p.add('a')).toBe('$1');
    expect(p.add(2)).toBe('$2');
    expect(p.values).toEqual(['a', 2]);
  });

  it('applies an offset so the first placeholder follows existing params', () => {
    const p = new ParamBuilder(3);
    expect(p.add('x')).toBe('$4');
    expect(p.values).toEqual(['x']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/param-builder.spec.ts`
Expected: FAIL — cannot find module `./param-builder`.

- [ ] **Step 3: Write minimal implementation**

```ts
export class ParamBuilder {
  private _values: unknown[] = [];

  constructor(private readonly offset = 0) {}

  add(value: unknown): string {
    this._values.push(value);
    return `$${this.offset + this._values.length}`;
  }

  get values(): unknown[] {
    return this._values;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/param-builder.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/param-builder.ts packages/jsonb-query/src/param-builder.spec.ts
git commit -m "feat(jsonb-query): add ParamBuilder for positional params"
```

---

## Task 3: quoteJsonbColumn

**Files:**
- Create: `packages/jsonb-query/src/column.ts`
- Test: `packages/jsonb-query/src/column.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { quoteJsonbColumn } from './column';

describe('quoteJsonbColumn', () => {
  it('quotes a simple column', () => {
    expect(quoteJsonbColumn('data')).toBe('"data"');
  });

  it('quotes a qualified table.column reference', () => {
    expect(quoteJsonbColumn('t.payload')).toBe('"t"."payload"');
  });

  it('rejects an injection attempt', () => {
    expect(() => quoteJsonbColumn('data; DROP TABLE t')).toThrow(/invalid jsonb column/i);
  });

  it('rejects a segment with a double quote', () => {
    expect(() => quoteJsonbColumn('da"ta')).toThrow(/invalid jsonb column/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/column.spec.ts`
Expected: FAIL — cannot find module `./column`.

- [ ] **Step 3: Write minimal implementation**

```ts
const SEGMENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export function quoteJsonbColumn(column: string): string {
  return column
    .split('.')
    .map((segment) => {
      if (!SEGMENT.test(segment)) {
        throw new Error(`Invalid JSONB column: ${JSON.stringify(column)}`);
      }
      return `"${segment}"`;
    })
    .join('.');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/column.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/column.ts packages/jsonb-query/src/column.spec.ts
git commit -m "feat(jsonb-query): add quoteJsonbColumn identifier guard"
```

---

## Task 4: escape helpers

**Files:**
- Create: `packages/jsonb-query/src/escape.ts`
- Test: `packages/jsonb-query/src/escape.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { escapeJsonpathString, escapeRegexLiteral } from './escape';

describe('escapeJsonpathString', () => {
  it('escapes backslash then double quote', () => {
    expect(escapeJsonpathString('a"b')).toBe('a\\"b');
    expect(escapeJsonpathString('a\\b')).toBe('a\\\\b');
  });
});

describe('escapeRegexLiteral', () => {
  it('escapes POSIX regex metacharacters', () => {
    expect(escapeRegexLiteral('a.b')).toBe('a\\.b');
    expect(escapeRegexLiteral('a+b(c)')).toBe('a\\+b\\(c\\)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/escape.spec.ts`
Expected: FAIL — cannot find module `./escape`.

- [ ] **Step 3: Write minimal implementation**

```ts
/** Escape a string for use inside a jsonpath double-quoted token (member name
 *  or string literal): backslash first, then double quote. */
export function escapeJsonpathString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Escape POSIX ERE metacharacters so a value matches literally in like_regex. */
export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.^$*+?()[\]{}|\\]/g, '\\$&');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/escape.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/escape.ts packages/jsonb-query/src/escape.spec.ts
git commit -m "feat(jsonb-query): add jsonpath/regex escape helpers"
```

---

## Task 5: ScalarDialect interface

**Files:**
- Create: `packages/jsonb-query/src/dialect.ts`

No test (interface only).

- [ ] **Step 1: Write `dialect.ts`**

```ts
import type {
  JsonbScalarType,
  JsonbScalarOperator,
  JsonbValue,
} from './types';
import type { ParamBuilder } from './param-builder';

export interface ScalarDialect {
  /**
   * Render one condition into a SQL boolean expression, pushing any parameter
   * values onto `params`.
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
}

export function fieldSegments(field: string): string[] {
  return field.split('.');
}

export function assertScalarValue(
  operator: JsonbScalarOperator,
  value: JsonbValue | JsonbValue[] | undefined,
): JsonbValue {
  if (value === undefined || value === null || Array.isArray(value)) {
    throw new Error(`Operator "${operator}" requires a single scalar value`);
  }
  return value;
}

export function assertArrayValue(
  operator: JsonbScalarOperator,
  value: JsonbValue | JsonbValue[] | undefined,
  exactLength?: number,
): JsonbValue[] {
  if (!Array.isArray(value) || (exactLength !== undefined && value.length !== exactLength)) {
    const need = exactLength !== undefined ? `${exactLength} values` : 'a non-empty array';
    throw new Error(`Operator "${operator}" requires ${need}`);
  }
  if (exactLength === undefined && value.length === 0) {
    throw new Error(`Operator "${operator}" requires a non-empty array`);
  }
  return value;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/jsonb-query/src/dialect.ts
git commit -m "feat(jsonb-query): add ScalarDialect interface and value guards"
```

---

## Task 6: legacy dialect

**Files:**
- Create: `packages/jsonb-query/src/dialect-legacy.ts`
- Test: `packages/jsonb-query/src/dialect-legacy.spec.ts`

The full implementation is written in one step because the operators share the
`F`/`Fc` scaffolding; the test asserts each operator's exact output.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { legacyDialect } from './dialect-legacy';
import { ParamBuilder } from './param-builder';

function run(
  field: string,
  dataType: Parameters<typeof legacyDialect.render>[2],
  operator: Parameters<typeof legacyDialect.render>[3],
  value?: unknown,
) {
  const p = new ParamBuilder();
  const where = legacyDialect.render('"data"', field, dataType, operator, value as never, p);
  return { where, values: p.values };
}

describe('legacyDialect', () => {
  it('eq string', () => {
    expect(run('name', 'string', 'eq', 'bob')).toEqual({
      where: '(("data" #>> $1) = $2)',
      values: [['name'], 'bob'],
    });
  });

  it('eq numeric casts', () => {
    expect(run('age', 'numeric', 'eq', 18)).toEqual({
      where: '(("data" #>> $1)::numeric = $2)',
      values: [['age'], 18],
    });
  });

  it('neq uses <> (not =)', () => {
    expect(run('age', 'numeric', 'neq', 18)).toEqual({
      where: '(("data" #>> $1)::numeric <> $2)',
      values: [['age'], 18],
    });
  });

  it('date eq casts to timestamptz and parameterizes the value', () => {
    expect(run('d', 'date', 'eq', '2020-01-01')).toEqual({
      where: '(("data" #>> $1)::timestamptz = $2)',
      values: [['d'], '2020-01-01'],
    });
  });

  it('boolean eq emits valid SQL (no "= is")', () => {
    expect(run('active', 'boolean', 'eq', true)).toEqual({
      where: '(("data" #>> $1)::boolean = $2)',
      values: [['active'], true],
    });
  });

  it('isnull / isnotnull', () => {
    expect(run('name', 'string', 'isnull')).toEqual({
      where: '(("data" #>> $1) is null)',
      values: [['name']],
    });
    expect(run('name', 'string', 'isnotnull')).toEqual({
      where: '(("data" #>> $1) is not null)',
      values: [['name']],
    });
  });

  it('gt / gte / lt / lte', () => {
    expect(run('age', 'numeric', 'gt', 1).where).toBe('(("data" #>> $1)::numeric > $2)');
    expect(run('age', 'numeric', 'gte', 1).where).toBe('(("data" #>> $1)::numeric >= $2)');
    expect(run('age', 'numeric', 'lt', 1).where).toBe('(("data" #>> $1)::numeric < $2)');
    expect(run('age', 'numeric', 'lte', 1).where).toBe('(("data" #>> $1)::numeric <= $2)');
  });

  it('range', () => {
    expect(run('age', 'numeric', 'range', [1, 9])).toEqual({
      where: '(("data" #>> $1)::numeric between $2 and $3)',
      values: [['age'], 1, 9],
    });
  });

  it('terms uses = ANY with a type-cast array param', () => {
    expect(run('tag', 'string', 'terms', ['a', 'b'])).toEqual({
      where: '(("data" #>> $1) = ANY($2::text[]))',
      values: [['tag'], ['a', 'b']],
    });
    expect(run('age', 'numeric', 'terms', [1, 2])).toEqual({
      where: '(("data" #>> $1)::numeric = ANY($2::numeric[]))',
      values: [['age'], [1, 2]],
    });
    expect(run('d', 'date', 'terms', ['2020-01-01', '2021-01-01'])).toEqual({
      where: '(("data" #>> $1)::timestamptz = ANY($2::timestamptz[]))',
      values: [['d'], ['2020-01-01', '2021-01-01']],
    });
  });

  it('contains / startswith / endswith match literally', () => {
    expect(run('s', 'string', 'contains', 'x')).toEqual({
      where: '(position($2 in ("data" #>> $1)) > 0)',
      values: [['s'], 'x'],
    });
    expect(run('s', 'string', 'startswith', 'x')).toEqual({
      where: '(left(("data" #>> $1), char_length($2)) = $2)',
      values: [['s'], 'x'],
    });
    expect(run('s', 'string', 'endswith', 'x')).toEqual({
      where: '(right(("data" #>> $1), char_length($2)) = $2)',
      values: [['s'], 'x'],
    });
  });

  it('nested field path becomes a multi-element text[] param', () => {
    expect(run('address.city', 'string', 'eq', 'TP').values[0]).toEqual(['address', 'city']);
  });

  it('keeps an injection payload in values, never in the SQL', () => {
    const { where, values } = run('name', 'string', 'eq', "x'; DROP TABLE t; --");
    expect(where).toBe('(("data" #>> $1) = $2)');
    expect(values[1]).toBe("x'; DROP TABLE t; --");
  });

  it('throws on an unknown operator', () => {
    expect(() => run('name', 'string', 'bogus' as never, 'x')).toThrow(/unsupported operator/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/dialect-legacy.spec.ts`
Expected: FAIL — cannot find module `./dialect-legacy`.

- [ ] **Step 3: Write the implementation**

```ts
import type { JsonbScalarType } from './types';
import {
  type ScalarDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
} from './dialect';

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

export const legacyDialect: ScalarDialect = {
  render(column, field, dataType, operator, value, params) {
    const fParam = params.add(fieldSegments(field));
    const F = `(${column} #>> ${fParam})`;
    const Fc = `${F}${CASTS[dataType]}`;

    switch (operator) {
      case 'isnull':
        return `(${F} is null)`;
      case 'isnotnull':
        return `(${F} is not null)`;
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
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/dialect-legacy.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/dialect-legacy.ts packages/jsonb-query/src/dialect-legacy.spec.ts
git commit -m "feat(jsonb-query): add legacy dialect (parameterized, scalar)"
```

---

## Task 7: jsonpath dialect

**Files:**
- Create: `packages/jsonb-query/src/dialect-jsonpath.ts`
- Test: `packages/jsonb-query/src/dialect-jsonpath.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { jsonpathDialect } from './dialect-jsonpath';
import { ParamBuilder } from './param-builder';

function run(
  field: string,
  dataType: Parameters<typeof jsonpathDialect.render>[2],
  operator: Parameters<typeof jsonpathDialect.render>[3],
  value?: unknown,
) {
  const p = new ParamBuilder();
  const where = jsonpathDialect.render('"data"', field, dataType, operator, value as never, p);
  return { where, values: p.values };
}

describe('jsonpathDialect', () => {
  it('eq string uses jsonb_path_exists with a vars object', () => {
    expect(run('name', 'string', 'eq', 'bob')).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."name" ? (@ == $v)', { v: 'bob' }],
    });
  });

  it('nested field escapes each member', () => {
    expect(run('address.city', 'string', 'eq', 'TP').values[0]).toBe(
      '$."address"."city" ? (@ == $v)',
    );
  });

  it('neq', () => {
    expect(run('name', 'string', 'neq', 'bob').values[0]).toBe('$."name" ? (@ != $v)');
  });

  it('date eq uses .datetime() on both sides', () => {
    expect(run('d', 'date', 'eq', '2020-01-01').values[0]).toBe(
      '$."d" ? (@.datetime() == $v.datetime())',
    );
  });

  it('comparisons', () => {
    expect(run('age', 'numeric', 'gt', 1).values[0]).toBe('$."age" ? (@ > $v)');
    expect(run('age', 'numeric', 'lte', 1).values[0]).toBe('$."age" ? (@ <= $v)');
  });

  it('range', () => {
    expect(run('age', 'numeric', 'range', [1, 9])).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."age" ? (@ >= $lo && @ <= $hi)', { lo: 1, hi: 9 }],
    });
  });

  it('terms OR-expands with indexed vars', () => {
    expect(run('tag', 'string', 'terms', ['a', 'b'])).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."tag" ? (@ == $v0 || @ == $v1)', { v0: 'a', v1: 'b' }],
    });
  });

  it('startswith uses the native predicate with a var', () => {
    expect(run('s', 'string', 'startswith', 'x')).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."s" ? (@ starts with $v)', { v: 'x' }],
    });
  });

  it('contains embeds a regex-escaped literal (no vars)', () => {
    expect(run('s', 'string', 'contains', 'a.b')).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath)',
      values: ['$."s" ? (@ like_regex "a\\\\.b")'],
    });
  });

  it('endswith anchors the regex literal', () => {
    expect(run('s', 'string', 'endswith', 'x').values[0]).toBe(
      '$."s" ? (@ like_regex "x$")',
    );
  });

  it('isnull / isnotnull fall back to the dialect-independent null check', () => {
    expect(run('name', 'string', 'isnull')).toEqual({
      where: '(("data" #>> $1) is null)',
      values: [['name']],
    });
  });

  it('throws on an unknown operator', () => {
    expect(() => run('name', 'string', 'bogus' as never, 'x')).toThrow(/unsupported operator/i);
  });
});
```

Note on the `contains` expectation: the JS source string `'$."s" ? (@ like_regex "a\\\\.b")'` is the four-character sequence `a`,`\`,`\`,`.`... — at runtime the value is `$."s" ? (@ like_regex "a\\.b")`, i.e. regex-escaped `.` → `\.` then jsonpath-string-escaped `\` → `\\`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/dialect-jsonpath.spec.ts`
Expected: FAIL — cannot find module `./dialect-jsonpath`.

- [ ] **Step 3: Write the implementation**

```ts
import type { JsonbScalarType, JsonbScalarOperator, JsonbValue } from './types';
import {
  type ScalarDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
} from './dialect';
import type { ParamBuilder } from './param-builder';
import { escapeJsonpathString, escapeRegexLiteral } from './escape';

function basePath(field: string): string {
  return (
    '$' +
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

export const jsonpathDialect: ScalarDialect = {
  render(column, field, dataType, operator, value, params) {
    // isnull/isnotnull are dialect-independent.
    if (operator === 'isnull' || operator === 'isnotnull') {
      const F = `(${column} #>> ${params.add(fieldSegments(field))})`;
      return operator === 'isnull' ? `(${F} is null)` : `(${F} is not null)`;
    }

    const base = basePath(field);
    const lhs = dataType === 'date' ? '@.datetime()' : '@';
    const rhs = (name: string) => (dataType === 'date' ? `${name}.datetime()` : name);

    const withVars = (predicate: string, vars: Record<string, JsonbValue>): string => {
      const pParam = params.add(`${base} ? (${predicate})`);
      const vParam = params.add(vars);
      return `jsonb_path_exists(${column}, ${pParam}::jsonpath, ${vParam}::jsonb)`;
    };

    const withoutVars = (predicate: string): string => {
      const pParam = params.add(`${base} ? (${predicate})`);
      return `jsonb_path_exists(${column}, ${pParam}::jsonpath)`;
    };

    const comparator = COMPARATORS[operator];
    if (comparator) {
      const v = assertScalarValue(operator, value);
      return withVars(`${lhs} ${comparator} ${rhs('$v')}`, { v });
    }

    switch (operator) {
      case 'range': {
        const [lo, hi] = assertArrayValue(operator, value, 2);
        return withVars(
          `${lhs} >= ${rhs('$lo')} && ${lhs} <= ${rhs('$hi')}`,
          { lo, hi },
        );
      }
      case 'terms': {
        const items = assertArrayValue(operator, value);
        const vars: Record<string, JsonbValue> = {};
        const predicate = items
          .map((item, i) => {
            vars[`v${i}`] = item;
            return `${lhs} == ${rhs(`$v${i}`)}`;
          })
          .join(' || ');
        return withVars(predicate, vars);
      }
      case 'startswith':
        return withVars('@ starts with $v', { v: assertScalarValue(operator, value) });
      case 'contains': {
        const lit = escapeJsonpathString(escapeRegexLiteral(String(assertScalarValue(operator, value))));
        return withoutVars(`@ like_regex "${lit}"`);
      }
      case 'endswith': {
        const lit = escapeJsonpathString(escapeRegexLiteral(String(assertScalarValue(operator, value))) + '$');
        return withoutVars(`@ like_regex "${lit}"`);
      }
      default:
        throw new Error(`Unsupported operator "${operator as string}"`);
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/dialect-jsonpath.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/dialect-jsonpath.ts packages/jsonb-query/src/dialect-jsonpath.spec.ts
git commit -m "feat(jsonb-query): add jsonpath dialect (parameterized, scalar)"
```

---

## Task 8: buildJsonbQuery + recursive composer

**Files:**
- Create: `packages/jsonb-query/src/build.ts`
- Test: `packages/jsonb-query/src/build.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildJsonbQuery } from './build';
import type { JsonbFilterGroup } from './types';

describe('buildJsonbQuery', () => {
  it('builds a single-condition where with contiguous params (legacy default)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 18 }],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where: '(("data" #>> $1)::numeric > $2)',
      values: [['age'], 18],
      from: [],
    });
  });

  it('joins conditions with the group logic and numbers params globally', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
        { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
      ],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where: '(("data" #>> $1) = $2) and (("data" #>> $3)::numeric >= $4)',
      values: [['name'], 'bob', ['age'], 18],
      from: [],
    });
  });

  it('wraps nested groups in parentheses', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
        {
          logic: 'or',
          filters: [
            { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
            { field: 'vip', dataType: 'boolean', operator: 'eq', value: true },
          ],
        },
      ],
    };
    const r = buildJsonbQuery('data', filter);
    expect(r.where).toBe(
      '(("data" #>> $1) = $2) and ((("data" #>> $3)::numeric >= $4) or (("data" #>> $5)::boolean = $6))',
    );
    expect(r.values).toEqual([['name'], 'bob', ['age'], 18, ['vip'], true]);
  });

  it('honours paramOffset', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 18 }],
    };
    expect(buildJsonbQuery('data', filter, { paramOffset: 5 }).where).toBe(
      '(("data" #>> $6)::numeric > $7)',
    );
  });

  it('switches to the jsonpath dialect', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'name', dataType: 'string', operator: 'eq', value: 'bob' }],
    };
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."name" ? (@ == $v)', { v: 'bob' }],
      from: [],
    });
  });

  it('returns empty where for an empty group', () => {
    expect(buildJsonbQuery('data', { logic: 'and', filters: [] })).toEqual({
      where: '',
      values: [],
      from: [],
    });
  });

  it('does not mutate across calls (fresh state each time)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 1 }],
    };
    const a = buildJsonbQuery('data', filter);
    const b = buildJsonbQuery('data', filter);
    expect(a).toEqual(b);
  });

  it('rejects an invalid column', () => {
    expect(() =>
      buildJsonbQuery('data; DROP', { logic: 'and', filters: [] }),
    ).toThrow(/invalid jsonb column/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/build.spec.ts`
Expected: FAIL — cannot find module `./build`.

- [ ] **Step 3: Write the implementation**

```ts
import type {
  JsonbCondition,
  JsonbFilterGroup,
  JsonbQueryResult,
  BuildJsonbOptions,
} from './types';
import { ParamBuilder } from './param-builder';
import { quoteJsonbColumn } from './column';
import type { ScalarDialect } from './dialect';
import { legacyDialect } from './dialect-legacy';
import { jsonpathDialect } from './dialect-jsonpath';

const DIALECTS: Record<string, ScalarDialect> = {
  legacy: legacyDialect,
  jsonpath: jsonpathDialect,
};

function isGroup(
  node: JsonbCondition | JsonbFilterGroup,
): node is JsonbFilterGroup {
  return 'logic' in node && 'filters' in node;
}

function buildGroup(
  group: JsonbFilterGroup,
  column: string,
  dialect: ScalarDialect,
  params: ParamBuilder,
): string {
  const parts = group.filters
    .map((node) =>
      isGroup(node)
        ? wrap(buildGroup(node, column, dialect, params))
        : dialect.render(
            column,
            node.field,
            node.dataType,
            node.operator,
            node.value,
            params,
          ),
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
  const dialect = DIALECTS[options.dialect ?? 'legacy'];
  const params = new ParamBuilder(options.paramOffset ?? 0);
  const where = buildGroup(filter, quoted, dialect, params);
  return { where, values: params.values, from: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/build.spec.ts`
Expected: PASS (all cases).

> Note on the nested-group test: `buildGroup` returns the joined parts without
> an outer wrap; the top-level group is therefore not double-wrapped, while each
> nested group is wrapped once via `wrap(...)`. Confirm the expected strings in
> the test match exactly; adjust the test, not the production code, only if the
> chosen parenthesization differs — but the implementation above produces the
> asserted strings.

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/build.ts packages/jsonb-query/src/build.spec.ts
git commit -m "feat(jsonb-query): add buildJsonbQuery composer"
```

---

## Task 9: Public surface + remove old implementation

**Files:**
- Overwrite: `packages/jsonb-query/src/index.ts`
- Delete: `packages/jsonb-query/src/jsonbOperator.ts`, `jsonbOperatorQuery.ts`, `jsonbFromWhere.ts`, `genJsonbQuery.ts`, `toJsonbQueryList.ts`, `toQuery.ts`, `type.ts`, and their `*.spec.ts` files.

- [ ] **Step 1: Overwrite `index.ts`**

```ts
export * from './types';
export { buildJsonbQuery } from './build';
export { quoteJsonbColumn } from './column';
export { ParamBuilder } from './param-builder';
```

- [ ] **Step 2: Delete the old files**

```bash
cd packages/jsonb-query
git rm src/jsonbOperator.ts src/jsonbOperatorQuery.ts src/jsonbFromWhere.ts \
       src/genJsonbQuery.ts src/toJsonbQueryList.ts src/toQuery.ts src/type.ts \
       src/genJsonbQuery.spec.ts src/toQuery.spec.ts
```

- [ ] **Step 3: Verify build, typecheck, and the full test suite**

Run (from `packages/jsonb-query`):
```bash
pnpm typecheck && pnpm exec vitest run && pnpm build
```
Expected: typecheck passes; all spec files pass; build emits `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts`.

- [ ] **Step 4: Verify the built ESM artifact loads and runs**

Run (from `packages/jsonb-query`):
```bash
node --input-type=module -e "import { buildJsonbQuery } from './dist/index.mjs'; console.log(JSON.stringify(buildJsonbQuery('data', { logic: 'and', filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 18 }] })));"
```
Expected: `{"where":"((\"data\" #>> $1)::numeric > $2)","values":[["age"],18],"from":[]}`

- [ ] **Step 5: Commit**

```bash
git add packages/jsonb-query/src/index.ts
git commit -m "refactor(jsonb-query): expose buildJsonbQuery, remove legacy string API"
```

---

## Task 10: Rewrite README (both languages)

**Files:**
- Overwrite: `packages/jsonb-query/README.md`
- Overwrite: `packages/jsonb-query/README.zh-TW.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# @rfjs/jsonb-query

Parameterized PostgreSQL JSONB query builder. Turns a filter-metadata tree into
a safe, parameterized `WHERE` expression (node-postgres `$1, $2` placeholders).

## Install

```bash
npm install @rfjs/jsonb-query
```

## Usage

```typescript
import { buildJsonbQuery } from '@rfjs/jsonb-query';

const { where, values } = buildJsonbQuery('data', {
  logic: 'and',
  filters: [
    { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
    {
      logic: 'or',
      filters: [
        { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
        { field: 'profile.vip', dataType: 'boolean', operator: 'eq', value: true },
      ],
    },
  ],
});

// where: (("data" #>> $1) = $2) and ((("data" #>> $3)::numeric >= $4) or (("data" #>> $5)::boolean = $6))
// values: [['name'], 'bob', ['age'], 18, ['profile','vip'], true]
await client.query(`SELECT * FROM t WHERE ${where}`, values);
```

### Dialects

```typescript
buildJsonbQuery('data', filter, { dialect: 'jsonpath' });
```

- `legacy` (default) — `#>>` extraction with casts. Works on all supported
  PostgreSQL versions.
- `jsonpath` — `jsonb_path_exists` with SQL/JSON path. Requires PostgreSQL 12+
  (13+ for `date` comparisons, which use `.datetime()`).

Both dialects accept the same filter metadata.

### Embedding in a larger query

Use `paramOffset` when the fragment follows existing parameters:

```typescript
const { where, values } = buildJsonbQuery('data', filter, { paramOffset: 1 });
await client.query(`SELECT * FROM t WHERE org_id = $1 AND ${where}`, [orgId, ...values]);
```

## Safety

Condition **values** and **field paths** are always parameterized — never
interpolated into SQL. The **column** argument is a developer-provided
identifier: it is validated and quoted (`data`, `t.payload`), and anything that
is not a plain (optionally qualified) column reference is rejected.

## Supported types & operators

| dataType | operators |
|----------|-----------|
| `string` | `eq` `neq` `isnull` `isnotnull` `contains` `startswith` `endswith` `terms` |
| `numeric` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms` |
| `date` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms` |
| `boolean` | `eq` `neq` `isnull` `isnotnull` |

`range` takes a 2-element `[lo, hi]` value; `terms` takes a non-empty array.

> Nested objects, JSON arrays, and arrays of objects are planned for a later
> release.
````

- [ ] **Step 2: Write `README.zh-TW.md`** — a Traditional-Chinese translation of the same content (same code blocks, headings translated; mirror the English structure).

- [ ] **Step 3: Commit**

```bash
git add packages/jsonb-query/README.md packages/jsonb-query/README.zh-TW.md
git commit -m "docs(jsonb-query): rewrite README for the parameterized API"
```

---

## Task 11: Changeset + final verification

**Files:**
- Create: `.changeset/jsonb-query-parameterized.md`

- [ ] **Step 1: Write the changeset**

```markdown
---
"@rfjs/jsonb-query": minor
---

feat(jsonb-query)!: parameterized query builder with legacy/jsonpath dialects

Replaces the string-interpolated SQL builder with `buildJsonbQuery`, which emits
parameterized SQL (node-postgres `$1,$2`) and supports both a `legacy` (`#>>`)
and a `jsonpath` (`jsonb_path_exists`) dialect. Scalar data types
(string/numeric/date/boolean) are supported in this release; object/array
support will follow. The previous string-returning API (`toJsonbQuery`,
`genJsonbQuery`, `JsonbOperatorQuery`, …) is removed.
```

- [ ] **Step 2: Run the full package gate**

Run (from `packages/jsonb-query`):
```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run && pnpm build
```
Expected: all pass.

- [ ] **Step 3: Confirm jsonb-query is still held back from publish**

Run (from repo root):
```bash
pnpm exec changeset status 2>&1 | grep -i jsonb-query || echo "jsonb-query correctly excluded from publish"
```
Expected: `jsonb-query correctly excluded from publish` (it remains in the changeset `ignore` list; the `minor` changeset is recorded but not released until the user removes the ignore).

- [ ] **Step 4: Commit**

```bash
git add .changeset/jsonb-query-parameterized.md
git commit -m "chore(jsonb-query): add changeset for parameterized redesign"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** Tasks 1-8 implement the API (§3), trust boundary (§4),
  architecture (§5), and every operator × dialect in the SQL tables (§6); Task
  9 removes the old surface (§8/§9); Task 10 rewrites the README (§8); Task 11
  records the changeset and confirms the package stays held back (§2/§8).
- **Param order is load-bearing:** every dialect `render` adds the field
  parameter (legacy) or path-string parameter (jsonpath) *before* value
  parameters, and `range`/`terms` add lo-then-hi / v0..vN in order. The exact
  `values` arrays in the tests pin this.
- **Naming consistency:** `buildJsonbQuery`, `ParamBuilder.add`,
  `quoteJsonbColumn`, `escapeJsonpathString`, `escapeRegexLiteral`,
  `fieldSegments`, `assertScalarValue`, `assertArrayValue`, `legacyDialect`,
  `jsonpathDialect` are used identically across tasks.
- **No DB execution:** correctness rests on the exact expected SQL strings.
  When implementing, re-read each expected string against PostgreSQL syntax
  before trusting a green test.
