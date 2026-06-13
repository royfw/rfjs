# jsonb-query Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete `elemmatch` nesting (object + scalar-array sub-conditions), add a typed `JsonbQueryError`, add array-element `neq` (∀ "value not present"), and make empty filter groups emit boolean-identity literals — across both the `legacy` and `jsonpath` dialects of `@rfjs/jsonb-query`.

**Architecture:** A filter-metadata tree is rendered to a parameterized SQL `WHERE` string. `build.ts` walks groups (`buildGroup`/`joinLogic`) and dispatches each leaf to a dialect (`legacy` = `#>>` casts; `jsonpath` = `jsonb_path_exists`). Validation lives in `dialect/base.ts` (`assertCondition` + value guards). `elemmatch` renders as an `EXISTS` sub-select (legacy) or a single SQL/JSON path predicate (jsonpath). When a jsonpath `elemmatch` body contains something a path predicate can't express (object containment, `containsall`), it delegates to the legacy `EXISTS` shell while still rendering each leaf through the jsonpath dialect ("hybrid fallback").

**Tech Stack:** TypeScript 5.7, Vitest (co-located `src/**/*.spec.ts`), pnpm + Turborepo, Changesets. PostgreSQL `pg` for the self-skipping E2E suite.

**Spec:** `docs/superpowers/specs/2026-06-13-jsonb-query-phase2-design.md`

**Working directory:** `packages/jsonb-query` inside the `feat/jsonb-query-phase2` worktree. All commands below assume repo root unless noted.

---

## File Structure

**New files:**
- `packages/jsonb-query/src/errors.ts` — `JsonbQueryError` class + `JsonbQueryErrorCode` union.
- `packages/jsonb-query/src/errors.spec.ts` — error-shape + per-code trigger tests.
- `packages/jsonb-query/.changeset/` entry (created via the changeset step).

**Modified files:**
- `src/index.ts` — export `JsonbQueryError`, `JsonbQueryErrorCode`.
- `src/column.ts`, `src/build.ts`, `src/object-condition.ts`, `src/named-params.ts` — throw `JsonbQueryError`.
- `src/dialect/base.ts` — throw `JsonbQueryError`; remove `scope`/`ConditionScope` + the two elemmatch-scope guards; add `groupNeedsSqlFallback`; add `neq` to array operator sets.
- `src/dialect/legacy.ts` — throw `JsonbQueryError`; render array `neq` as negated EXISTS.
- `src/dialect/jsonpath.ts` — throw `JsonbQueryError`; scalar-array branch in `conditionPredicate`; empty-nested-group identity in `groupPredicate`; hybrid fallback in `renderElemMatch`; array `neq`.
- `src/types.ts` — widen `JsonbArrayOperator` to include `neq`.
- `src/dialect/legacy.spec.ts`, `src/dialect/jsonpath.spec.ts`, `src/build.spec.ts` — update tests whose behavior changes (Tasks 3/5/6).
- `README.md` — elemmatch nesting, array `neq`, errors section, empty-filter note.

**Sequencing rationale:** C (errors) lands first as an isolated, behavior-preserving change. Then A (elemmatch nesting) removes guards and adds the fallback. Then B (empty-group identity). Then D (array `neq`). Docs + E2E last.

---

## Task 1: `JsonbQueryError` class

**Files:**
- Create: `packages/jsonb-query/src/errors.ts`
- Create: `packages/jsonb-query/src/errors.spec.ts`
- Modify: `packages/jsonb-query/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/jsonb-query/src/errors.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { JsonbQueryError } from './errors';

describe('JsonbQueryError', () => {
  it('is an Error with a name and a code', () => {
    const err = new JsonbQueryError('bad input', 'INVALID_COLUMN');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(JsonbQueryError);
    expect(err.name).toBe('JsonbQueryError');
    expect(err.message).toBe('bad input');
    expect(err.code).toBe('INVALID_COLUMN');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/errors.spec.ts`
Expected: FAIL — cannot resolve `./errors`.

- [ ] **Step 3: Write the implementation**

Create `packages/jsonb-query/src/errors.ts`:

```ts
/**
 * Stable discriminant for every error this package throws. A thrown
 * `JsonbQueryError` always signals a caller-input problem; any other thrown
 * type is an internal bug.
 */
export type JsonbQueryErrorCode =
  | 'INVALID_COLUMN'        // column identifier is not a plain (qualified) reference
  | 'INVALID_DIALECT'       // unknown dialect name
  | 'UNSUPPORTED_OPERATOR'  // operator not valid for the (element) type
  | 'INVALID_ELEMENT_TYPE'  // unknown array elementType
  | 'INVALID_SCALAR_VALUE'  // operator expected a single scalar value
  | 'INVALID_ARRAY_VALUE'   // operator expected an array of a given arity / non-empty
  | 'INVALID_OBJECT_VALUE'  // operator expected a plain object value
  | 'EMPTY_FILTER_GROUP'    // elemmatch requires a group with >= 1 condition
  | 'INVALID_PREFIX'        // named-parameter prefix is not a valid identifier
  | 'PARAM_MISMATCH';       // toNamedParams: placeholders do not match the values array

export class JsonbQueryError extends Error {
  readonly code: JsonbQueryErrorCode;

  constructor(message: string, code: JsonbQueryErrorCode) {
    super(message);
    this.name = 'JsonbQueryError';
    this.code = code;
  }
}
```

- [ ] **Step 4: Export from the barrel**

In `packages/jsonb-query/src/index.ts`, add after the existing exports:

```ts
export { JsonbQueryError, type JsonbQueryErrorCode } from './errors';
```

- [ ] **Step 5: Run test + typecheck to verify they pass**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/errors.spec.ts && pnpm -F @rfjs/jsonb-query typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/jsonb-query/src/errors.ts packages/jsonb-query/src/errors.spec.ts packages/jsonb-query/src/index.ts
git commit -m "feat(jsonb-query): add JsonbQueryError typed error class"
```

---

## Task 2: Throw `JsonbQueryError` at every throw site

Replace every `throw new Error(...)` in the package with `throw new JsonbQueryError(msg, code)`. Messages stay identical (existing `toThrow(/regex/)` tests keep passing); only the thrown type and the new `code` are added. The two elemmatch-scope guards in `base.ts` are converted here and then deleted in Task 3.

**Files:**
- Modify: `src/column.ts`, `src/build.ts`, `src/dialect/base.ts`, `src/dialect/legacy.ts`, `src/dialect/jsonpath.ts`, `src/object-condition.ts`, `src/named-params.ts`
- Modify: `src/errors.spec.ts`

- [ ] **Step 1: Write the failing tests (one trigger per code)**

Append to `packages/jsonb-query/src/errors.spec.ts`:

```ts
import { buildJsonbQuery } from './build';
import { quoteJsonbColumn } from './column';
import { buildNamedJsonbQuery, toNamedParams } from './named-params';
import type { JsonbFilterGroup } from './types';

const wrap = (f: unknown): JsonbFilterGroup => ({ logic: 'and', filters: [f as never] });

function caught(fn: () => unknown): JsonbQueryError {
  try {
    fn();
  } catch (e) {
    if (e instanceof JsonbQueryError) return e;
    throw e;
  }
  throw new Error('expected a JsonbQueryError to be thrown');
}

describe('JsonbQueryError codes by throw site', () => {
  it('INVALID_COLUMN', () => {
    expect(caught(() => quoteJsonbColumn('a-b')).code).toBe('INVALID_COLUMN');
  });

  it('INVALID_DIALECT', () => {
    expect(
      caught(() => buildJsonbQuery('data', wrap({ field: 'x', dataType: 'string', operator: 'isnull' }), { dialect: 'nope' as never })).code,
    ).toBe('INVALID_DIALECT');
  });

  it('UNSUPPORTED_OPERATOR', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'x', dataType: 'boolean', operator: 'gt', value: 1 }))).code).toBe('UNSUPPORTED_OPERATOR');
  });

  it('INVALID_ELEMENT_TYPE', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'a', dataType: 'array', elementType: 'bogus', operator: 'eq', value: 1 }))).code).toBe('INVALID_ELEMENT_TYPE');
  });

  it('INVALID_SCALAR_VALUE', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'x', dataType: 'string', operator: 'eq' }))).code).toBe('INVALID_SCALAR_VALUE');
  });

  it('INVALID_ARRAY_VALUE', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'x', dataType: 'numeric', operator: 'range', value: [1] }))).code).toBe('INVALID_ARRAY_VALUE');
  });

  it('INVALID_OBJECT_VALUE', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'p', dataType: 'object', operator: 'eq', value: 'x' }))).code).toBe('INVALID_OBJECT_VALUE');
  });

  it('EMPTY_FILTER_GROUP', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'i', dataType: 'array', elementType: 'object', operator: 'elemmatch', filters: { logic: 'and', filters: [] } }))).code).toBe('EMPTY_FILTER_GROUP');
  });

  it('INVALID_PREFIX', () => {
    expect(caught(() => buildNamedJsonbQuery('data', wrap({ field: 'x', dataType: 'string', operator: 'isnull' }), { prefix: '1bad' })).code).toBe('INVALID_PREFIX');
  });

  it('PARAM_MISMATCH', () => {
    expect(caught(() => toNamedParams({ where: '$1 and $3', values: ['a', 'b'], from: [] })).code).toBe('PARAM_MISMATCH');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/errors.spec.ts`
Expected: FAIL — errors are plain `Error` (no `.code`), so `caught()` re-throws / `.code` is undefined.

- [ ] **Step 3: Wire `src/column.ts`**

Add at top: `import { JsonbQueryError } from './errors';`
Replace:
```ts
        throw new Error(`Invalid JSONB column: ${JSON.stringify(column)}`);
```
with:
```ts
        throw new JsonbQueryError(`Invalid JSONB column: ${JSON.stringify(column)}`, 'INVALID_COLUMN');
```

- [ ] **Step 4: Wire `src/build.ts`**

Add to the imports: `import { JsonbQueryError } from './errors';`
Replace:
```ts
    throw new Error(`Unknown JSONB dialect: "${dialectName}"`);
```
with:
```ts
    throw new JsonbQueryError(`Unknown JSONB dialect: "${dialectName}"`, 'INVALID_DIALECT');
```

- [ ] **Step 5: Wire `src/dialect/base.ts`**

Add to the imports: `import { JsonbQueryError } from '../errors';`
Apply these exact replacements:

`assertScalarValue`:
```ts
    throw new Error(`Operator "${operator}" requires a single scalar value`);
```
→
```ts
    throw new JsonbQueryError(`Operator "${operator}" requires a single scalar value`, 'INVALID_SCALAR_VALUE');
```

`assertArrayValue` (three throws):
```ts
    throw new Error(`Operator "${operator}" requires ${need}`);
```
→
```ts
    throw new JsonbQueryError(`Operator "${operator}" requires ${need}`, 'INVALID_ARRAY_VALUE');
```
```ts
    throw new Error(`Operator "${operator}" requires ${exactLength} values`);
```
→
```ts
    throw new JsonbQueryError(`Operator "${operator}" requires ${exactLength} values`, 'INVALID_ARRAY_VALUE');
```
```ts
    throw new Error(`Operator "${operator}" requires a non-empty array`);
```
→
```ts
    throw new JsonbQueryError(`Operator "${operator}" requires a non-empty array`, 'INVALID_ARRAY_VALUE');
```

`assertOperatorForType`:
```ts
    throw new Error(`Unsupported operator "${operator}" for type "${dataType}"`);
```
→
```ts
    throw new JsonbQueryError(`Unsupported operator "${operator}" for type "${dataType}"`, 'UNSUPPORTED_OPERATOR');
```

`assertObjectValue`:
```ts
    throw new Error(`Operator "${operator}" requires a plain object value`);
```
→
```ts
    throw new JsonbQueryError(`Operator "${operator}" requires a plain object value`, 'INVALID_OBJECT_VALUE');
```

`assertCondition` — object branch (this guard is deleted in Task 3; convert it now for the interim invariant):
```ts
      throw new Error('Object conditions are not supported inside elemmatch');
```
→
```ts
      throw new JsonbQueryError('Object conditions are not supported inside elemmatch', 'UNSUPPORTED_OPERATOR');
```
```ts
      throw new Error(`Unsupported operator "${node.operator as string}" for type "object"`);
```
→
```ts
      throw new JsonbQueryError(`Unsupported operator "${node.operator as string}" for type "object"`, 'UNSUPPORTED_OPERATOR');
```

`assertCondition` — array branch:
```ts
        throw new Error(
          `Unsupported operator "${node.operator as string}" for array of objects (use "elemmatch")`,
        );
```
→
```ts
        throw new JsonbQueryError(
          `Unsupported operator "${node.operator as string}" for array of objects (use "elemmatch")`,
          'UNSUPPORTED_OPERATOR',
        );
```
```ts
        throw new Error('Operator "elemmatch" requires a filter group with at least one condition');
```
→
```ts
        throw new JsonbQueryError('Operator "elemmatch" requires a filter group with at least one condition', 'EMPTY_FILTER_GROUP');
```
```ts
      throw new Error('Array conditions with scalar elements are not supported inside elemmatch');
```
→
```ts
      throw new JsonbQueryError('Array conditions with scalar elements are not supported inside elemmatch', 'UNSUPPORTED_OPERATOR');
```
```ts
      throw new Error(
        `Unsupported elementType ${JSON.stringify(node.elementType)} for array condition`,
      );
```
→
```ts
      throw new JsonbQueryError(
        `Unsupported elementType ${JSON.stringify(node.elementType)} for array condition`,
        'INVALID_ELEMENT_TYPE',
      );
```
```ts
      throw new Error(
        `Unsupported operator "${node.operator as string}" for array elements of type "${node.elementType}"`,
      );
```
→
```ts
      throw new JsonbQueryError(
        `Unsupported operator "${node.operator as string}" for array elements of type "${node.elementType}"`,
        'UNSUPPORTED_OPERATOR',
      );
```

- [ ] **Step 6: Wire `src/dialect/legacy.ts`**

Add to the imports: `import { JsonbQueryError } from '../errors';`
```ts
      throw new Error(`Unsupported operator "${operator as string}"`);
```
→
```ts
      throw new JsonbQueryError(`Unsupported operator "${operator as string}"`, 'UNSUPPORTED_OPERATOR');
```
```ts
      throw new Error('Operator "elemmatch" requires a filter group with at least one condition');
```
→
```ts
      throw new JsonbQueryError('Operator "elemmatch" requires a filter group with at least one condition', 'EMPTY_FILTER_GROUP');
```

- [ ] **Step 7: Wire `src/dialect/jsonpath.ts`**

Add to the imports: `import { JsonbQueryError } from '../errors';`
```ts
      throw new Error(`Unsupported operator "${operator as string}"`);
```
→
```ts
      throw new JsonbQueryError(`Unsupported operator "${operator as string}"`, 'UNSUPPORTED_OPERATOR');
```
Both occurrences of:
```ts
      throw new Error('Operator "elemmatch" requires a filter group with at least one condition');
```
→
```ts
      throw new JsonbQueryError('Operator "elemmatch" requires a filter group with at least one condition', 'EMPTY_FILTER_GROUP');
```
(There are two — in `conditionPredicate` and in `renderElemMatch`. Use `replace_all`.)

- [ ] **Step 8: Wire `src/object-condition.ts`**

Add `JsonbQueryError` to the existing import from `'./dialect'`? No — import from errors: add `import { JsonbQueryError } from './errors';`
```ts
      throw new Error(`Unsupported operator "${operator as string}" for type "object"`);
```
→
```ts
      throw new JsonbQueryError(`Unsupported operator "${operator as string}" for type "object"`, 'UNSUPPORTED_OPERATOR');
```

- [ ] **Step 9: Wire `src/named-params.ts`**

Add to the imports: `import { JsonbQueryError } from './errors';`
```ts
    throw new Error(`Invalid named-parameter prefix: ${JSON.stringify(prefix)}`);
```
→
```ts
    throw new JsonbQueryError(`Invalid named-parameter prefix: ${JSON.stringify(prefix)}`, 'INVALID_PREFIX');
```
```ts
    throw new Error('toNamedParams: placeholders do not match the values array');
```
→
```ts
    throw new JsonbQueryError('toNamedParams: placeholders do not match the values array', 'PARAM_MISMATCH');
```

- [ ] **Step 10: Verify the whole suite + typecheck + lint pass**

Run: `pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query lint`
Expected: all PASS. (Existing `toThrow(/.../i)` tests still pass because messages are unchanged.)

- [ ] **Step 11: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "feat(jsonb-query): throw JsonbQueryError with codes at all throw sites"
```

---

## Task 3: Remove elemmatch scope guards + the `scope` parameter

`assertCondition` no longer special-cases `elemmatch`: object and scalar-array conditions validate the same everywhere. With both scope guards gone, `scope`/`ConditionScope` are dead and removed.

**Files:**
- Modify: `src/dialect/base.ts`
- Modify: `src/build.ts`
- Modify: `src/dialect/jsonpath.ts`
- Modify: `src/dialect/base.spec.ts`, `src/build.spec.ts`, `src/dialect/jsonpath.spec.ts`

- [ ] **Step 1: Update the failing tests first (behavior change)**

In `src/dialect/base.spec.ts`, replace the `c`/`e` helpers (lines ~53-54):
```ts
  const c = (node: unknown) => () => assertCondition(node as JsonbCondition, 'root');
  const e = (node: unknown) => () => assertCondition(node as JsonbCondition, 'elemmatch');
```
with:
```ts
  const c = (node: unknown) => () => assertCondition(node as JsonbCondition);
```
Then replace the entire `it('rejects object and scalar-array conditions inside elemmatch', ...)` test with:
```ts
  it('validates object and scalar-array conditions uniformly (no elemmatch scope)', () => {
    // Previously rejected inside elemmatch; now scope-independent.
    expect(c({ field: 'p', dataType: 'object', operator: 'eq', value: {} })).not.toThrow();
    expect(c({ field: 'a', dataType: 'array', elementType: 'string', operator: 'eq', value: 'x' })).not.toThrow();
    // Operator-set checks still apply.
    expect(c({ field: 'p', dataType: 'object', operator: 'gt', value: {} })).toThrow(
      /unsupported operator "gt" for type "object"/i,
    );
  });
```

In `src/build.spec.ts`, replace the `it('rejects object / scalar-array conditions inside elemmatch in both dialects', ...)` test (lines ~340-354) with:
```ts
  it('allows object and scalar-array conditions inside elemmatch (both dialects)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: {
            logic: 'and',
            filters: [
              { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
              { field: 'meta', dataType: 'object', operator: 'contains', value: { vip: true } },
            ],
          },
        },
      ],
    };
    // legacy: a single EXISTS shell, object leaf via @>
    const legacy = buildJsonbQuery('data', filter);
    expect(legacy.where).toContain('jsonb_array_elements(');
    expect(legacy.where).toContain('@>');
    // jsonpath: object leaf forces the SQL EXISTS fallback (Task 4)
    const jp = buildJsonbQuery('data', filter, { dialect: 'jsonpath' });
    expect(jp.where).toContain('jsonb_array_elements(');
    expect(jp.where).toContain('@>');
  });
```

In `src/dialect/jsonpath.spec.ts`, replace the `it('rejects object / scalar-array conditions inside elemmatch', ...)` test (lines ~261-274) with:
```ts
  it('renders scalar-array conditions inside elemmatch as a nested path predicate', () => {
    const { values } = runElem('items', {
      logic: 'and',
      filters: [{ field: 't', dataType: 'array', elementType: 'string', operator: 'eq', value: 'x' }],
    });
    expect(values[0]).toContain('exists (@."t"[*] ? (@ == $v0))');
  });
```

- [ ] **Step 2: Run to verify the updated tests fail**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/base.spec.ts src/build.spec.ts src/dialect/jsonpath.spec.ts`
Expected: FAIL — guards still reject; `assertCondition` still takes a `scope` arg (the 1-arg `c` helper now type-errors / wrong behavior); the scalar-array elemmatch render path does not exist yet (jsonpath test fails — completed in Task 4).

- [ ] **Step 3: Remove the scope guards and parameter in `src/dialect/base.ts`**

Delete the `ConditionScope` type:
```ts
export type ConditionScope = 'root' | 'elemmatch';
```
Replace the whole `assertCondition` function with:
```ts
export function assertCondition(node: JsonbCondition): void {
  if (node.dataType === 'object') {
    if (!OBJECT_OPERATORS.has(node.operator)) {
      throw new JsonbQueryError(
        `Unsupported operator "${node.operator as string}" for type "object"`,
        'UNSUPPORTED_OPERATOR',
      );
    }
    return;
  }
  if (node.dataType === 'array') {
    if (node.elementType === 'object') {
      if ((node.operator as string) !== 'elemmatch') {
        throw new JsonbQueryError(
          `Unsupported operator "${node.operator as string}" for array of objects (use "elemmatch")`,
          'UNSUPPORTED_OPERATOR',
        );
      }
      if (!node.filters || !Array.isArray(node.filters.filters) || node.filters.filters.length === 0) {
        throw new JsonbQueryError(
          'Operator "elemmatch" requires a filter group with at least one condition',
          'EMPTY_FILTER_GROUP',
        );
      }
      return;
    }
    const ops = ARRAY_OPERATORS_BY_ELEMENT[node.elementType];
    if (!ops) {
      throw new JsonbQueryError(
        `Unsupported elementType ${JSON.stringify(node.elementType)} for array condition`,
        'INVALID_ELEMENT_TYPE',
      );
    }
    if (!ops.has(node.operator)) {
      throw new JsonbQueryError(
        `Unsupported operator "${node.operator as string}" for array elements of type "${node.elementType}"`,
        'UNSUPPORTED_OPERATOR',
      );
    }
    return;
  }
  assertOperatorForType(node.dataType, node.operator);
}
```

- [ ] **Step 4: Drop the `scope` argument in `src/build.ts`**

Remove `ConditionScope` from the import from `./dialect`. Update the function signatures and the `ctx.renderGroup`/top-level call:

`renderCondition`: remove the `scope: ConditionScope` parameter and the `assertCondition(node, scope)` becomes `assertCondition(node)`.
```ts
function renderCondition(
  node: JsonbCondition,
  column: string,
  dialect: JsonbQueryDialect,
  ctx: RenderContext,
): string {
  assertCondition(node);
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
```

`buildGroup`: remove the `scope` parameter and pass-through:
```ts
function buildGroup(
  group: JsonbFilterGroup,
  column: string,
  dialect: JsonbQueryDialect,
  ctx: RenderContext,
): string {
  const parts = group.filters
    .map((node) =>
      isFilterGroup(node)
        ? wrap(buildGroup(node, column, dialect, ctx))
        : renderCondition(node, column, dialect, ctx),
    )
    .filter((sql) => sql.length > 0);
  return joinLogic(parts, group.logic);
}
```

In `buildJsonbQuery`, update the `ctx.renderGroup` and the top-level call:
```ts
    renderGroup: (group, col) => buildGroup(group, col, dialect, ctx),
  };
  const where = buildGroup(filter, quoted, dialect, ctx);
```

- [ ] **Step 5: Drop the scope argument in `src/dialect/jsonpath.ts`**

In `conditionPredicate`, change:
```ts
  assertCondition(node, 'elemmatch');
```
to:
```ts
  assertCondition(node);
```

- [ ] **Step 6: Run base + build (jsonpath scalar-array test still fails until Task 4)**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/base.spec.ts src/build.spec.ts && pnpm -F @rfjs/jsonb-query typecheck`
Expected: base.spec + build.spec PASS; typecheck clean. (The jsonpath scalar-array-in-elemmatch test from Step 1 still FAILS — it is completed in Task 4.)

- [ ] **Step 7: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "feat(jsonb-query): allow object/scalar-array inside elemmatch; drop scope param"
```

---

## Task 4: jsonpath elemmatch — scalar-array branch + hybrid SQL fallback

Adds `groupNeedsSqlFallback`, the scalar-array branch in jsonpath's `conditionPredicate`, and the fallback delegation in `renderElemMatch`. Legacy needs no render change (its body already threads the element column).

**Files:**
- Modify: `src/dialect/base.ts` (add `groupNeedsSqlFallback`)
- Modify: `src/dialect/jsonpath.ts`
- Modify: `src/dialect/base.spec.ts`, `src/dialect/jsonpath.spec.ts`

- [ ] **Step 1: Write the failing test for `groupNeedsSqlFallback`**

Append to `src/dialect/base.spec.ts`:
```ts
import { groupNeedsSqlFallback } from './base';
import type { JsonbFilterGroup } from '../types';

describe('groupNeedsSqlFallback', () => {
  const g = (filters: JsonbFilterGroup['filters']): JsonbFilterGroup => ({ logic: 'and', filters });

  it('false for scalar-only and path-expressible scalar-array groups', () => {
    expect(groupNeedsSqlFallback(g([{ field: 's', dataType: 'string', operator: 'eq', value: 'x' }]))).toBe(false);
    expect(groupNeedsSqlFallback(g([{ field: 't', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }]))).toBe(false);
    expect(groupNeedsSqlFallback(g([{ field: 't', dataType: 'array', elementType: 'string', operator: 'isnull' }]))).toBe(false);
  });

  it('true for object conditions and scalar-array containsall', () => {
    expect(groupNeedsSqlFallback(g([{ field: 'p', dataType: 'object', operator: 'contains', value: {} }]))).toBe(true);
    expect(groupNeedsSqlFallback(g([{ field: 't', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a'] }]))).toBe(true);
  });

  it('recurses through nested groups and nested elemmatch', () => {
    expect(groupNeedsSqlFallback(g([{ logic: 'or', filters: [{ field: 'p', dataType: 'object', operator: 'eq', value: {} }] } as never]))).toBe(true);
    const nestedElem = g([
      {
        field: 'sub', dataType: 'array', elementType: 'object', operator: 'elemmatch',
        filters: { logic: 'and', filters: [{ field: 'p', dataType: 'object', operator: 'eq', value: {} }] },
      } as never,
    ]);
    expect(groupNeedsSqlFallback(nestedElem)).toBe(true);
    const nestedElemScalar = g([
      {
        field: 'sub', dataType: 'array', elementType: 'object', operator: 'elemmatch',
        filters: { logic: 'and', filters: [{ field: 's', dataType: 'string', operator: 'eq', value: 'x' }] },
      } as never,
    ]);
    expect(groupNeedsSqlFallback(nestedElemScalar)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/base.spec.ts`
Expected: FAIL — `groupNeedsSqlFallback` is not exported.

- [ ] **Step 3: Add `groupNeedsSqlFallback` to `src/dialect/base.ts`**

Append (the file already imports `JsonbCondition`, `JsonbFilterGroup` and has `isFilterGroup`):
```ts
/**
 * True when any node in this elemmatch predicate subtree cannot be expressed as
 * a SQL/JSON path predicate (it needs `@>` / `#>>` instead): an object
 * condition, or a scalar-array `containsall`. Recurses through nested groups and
 * nested elemmatch — an outer path predicate can only embed a nested elemmatch
 * when the nested predicate is itself path-expressible.
 */
export function groupNeedsSqlFallback(group: JsonbFilterGroup): boolean {
  return group.filters.some((node) =>
    isFilterGroup(node) ? groupNeedsSqlFallback(node) : conditionNeedsSqlFallback(node),
  );
}

function conditionNeedsSqlFallback(node: JsonbCondition): boolean {
  if (node.dataType === 'object') {
    return true;
  }
  if (node.dataType === 'array') {
    if (node.elementType === 'object') {
      return groupNeedsSqlFallback(node.filters);
    }
    return node.operator === 'containsall';
  }
  return false;
}
```

- [ ] **Step 4: Run to verify the fallback test passes**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/base.spec.ts`
Expected: PASS.

- [ ] **Step 5: Implement the jsonpath scalar-array branch + fallback**

In `src/dialect/jsonpath.ts`:

Add `JsonbArrayCondition` to the type import and `groupNeedsSqlFallback` to the base import, and import the legacy dialect:
```ts
import type {
  JsonbScalarType,
  JsonbScalarOperator,
  JsonbValue,
  JsonbCondition,
  JsonbFilterGroup,
  JsonbScalarCondition,
  JsonbArrayCondition,
} from '../types';
import {
  type JsonbQueryDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
  assertCondition,
  isFilterGroup,
  renderNullCheck,
  renderJsonbContains,
  groupNeedsSqlFallback,
} from './base';
import { legacyDialect } from './legacy';
```
(`legacy.ts` imports only from `./base`, so this introduces no import cycle.)

In `conditionPredicate`, after the array-of-objects (nested elemmatch) block and before the scalar fallthrough, add the scalar-array branch:
```ts
  if (node.dataType === 'array') {
    // scalar-element array nested inside elemmatch.
    const arr = node as JsonbArrayCondition;
    const acc = memberAccessor('@', arr.field);
    if (arr.operator === 'isnull' || arr.operator === 'isnotnull') {
      const { pred } = scalarPredicate(acc, 'string', arr.operator, undefined, sink);
      return `(${pred})`;
    }
    // containsall never reaches here: groupNeedsSqlFallback routes such groups
    // to the SQL EXISTS fallback before any path predicate is built.
    const operator = arr.operator as JsonbScalarOperator;
    const { pred } = scalarPredicate('@', arr.elementType, operator, arr.value, sink);
    return `exists (${acc}[*] ? (${pred}))`;
  }
  if (node.dataType === 'object') {
    // Unreachable: object conditions force the SQL EXISTS fallback. Guard
    // against silently mis-rendering an object as a scalar comparison.
    throw new JsonbQueryError(
      'Object conditions cannot be expressed as a jsonpath predicate',
      'UNSUPPORTED_OPERATOR',
    );
  }
```

In `renderElemMatch`, delegate when the body needs SQL:
```ts
  renderElemMatch(column, condition, ctx) {
    if (groupNeedsSqlFallback(condition.filters)) {
      // Object / containsall leaves can't live in a path predicate. Use the
      // legacy EXISTS shell; its body renders each leaf through THIS (jsonpath)
      // dialect via ctx.renderGroup.
      return legacyDialect.renderElemMatch(column, condition, ctx);
    }
    const sink = sequentialSink();
    const pred = groupPredicate(condition.filters, sink);
    if (pred.length === 0) {
      throw new JsonbQueryError(
        'Operator "elemmatch" requires a filter group with at least one condition',
        'EMPTY_FILTER_GROUP',
      );
    }
    return pathExists(
      column,
      `${memberAccessor('$', condition.field)}[*] ? (${pred})`,
      sink.vars,
      ctx.params,
      sink.tz,
    );
  },
```

- [ ] **Step 6: Add a jsonpath fallback test**

Append to `src/dialect/jsonpath.spec.ts` (inside the elemmatch describe, or a new one — uses the existing `runElem` helper):
```ts
  it('falls back to a SQL EXISTS shell when an object leaf is present', () => {
    const { where, values } = runElem('items', {
      logic: 'and',
      filters: [
        { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
        { field: 'meta', dataType: 'object', operator: 'contains', value: { vip: true } },
      ],
    });
    // legacy EXISTS shell with a jsonpath scalar leaf and an @> object leaf
    expect(where).toContain('jsonb_array_elements(');
    expect(where).toContain('jsonb_path_exists(e1.value,');
    expect(where).toContain('@>');
    expect(values[0]).toEqual(['items']);
  });
```

- [ ] **Step 7: Run the affected specs + typecheck**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/jsonpath.spec.ts src/dialect/base.spec.ts src/build.spec.ts && pnpm -F @rfjs/jsonb-query typecheck`
Expected: PASS — including the scalar-array-in-elemmatch test from Task 3 Step 1.

- [ ] **Step 8: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "feat(jsonb-query): jsonpath elemmatch scalar-array + hybrid SQL fallback"
```

---

## Task 5: Empty-group boolean identity

Empty groups emit their logic's boolean identity instead of an empty string — in `build.ts` (SQL) and in jsonpath's `groupPredicate` (path predicate, for empty groups nested inside `elemmatch`). An `elemmatch`'s own empty `filters` array still throws `EMPTY_FILTER_GROUP` (unchanged, caught earlier by `assertCondition`).

**Files:**
- Modify: `src/build.ts`
- Modify: `src/dialect/jsonpath.ts`
- Modify: `src/build.spec.ts`, `src/dialect/jsonpath.spec.ts`

- [ ] **Step 1: Update behavior-changing tests + add new ones**

In `src/build.spec.ts`:

Replace the `it('returns empty where for an empty group', ...)` test (lines ~76-82) with:
```ts
  it('emits the logic boolean identity for an empty group', () => {
    expect(buildJsonbQuery('data', { logic: 'and', filters: [] })).toEqual({ where: 'true', values: [], from: [] });
    expect(buildJsonbQuery('data', { logic: 'or', filters: [] }).where).toBe('false');
  });

  it('empty inner groups participate as their identity', () => {
    expect(
      buildJsonbQuery('data', {
        logic: 'and',
        filters: [
          { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
          { logic: 'or', filters: [] },
        ],
      }).where,
    ).toBe('(("data" #>> $1) = $2) and (false)');
  });
```

Replace the `it('drops empty not/nor groups (phase-1 empty-group convention)', ...)` test (lines ~490-493) with:
```ts
  it('emits identity for empty not/nor groups', () => {
    expect(buildJsonbQuery('data', { logic: 'not', filters: [] }).where).toBe('false');
    expect(buildJsonbQuery('data', { logic: 'nor', filters: [] }).where).toBe('true');
  });
```

Replace the `rendersEmpty` half of the `it('throws when elemmatch filters are empty or render empty', ...)` test (lines ~356-381). Keep the first half (top-level empty elemmatch filters still throws); change the second half to assert rendering. Replace the whole test with:
```ts
  it('elemmatch with empty OWN filters throws; empty NESTED group renders as identity', () => {
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

    const nestedEmpty: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: { logic: 'and', filters: [{ logic: 'or', filters: [] }] },
        },
      ],
    };
    // legacy renders `where (false)`; jsonpath renders the `1 == 0` identity.
    expect(buildJsonbQuery('data', nestedEmpty).where).toContain('where (false)');
    expect(buildJsonbQuery('data', nestedEmpty, { dialect: 'jsonpath' }).values[0]).toContain('1 == 0');
  });
```

In `src/dialect/jsonpath.spec.ts`, replace the `it('throws when the group renders empty', ...)` test (lines ~276-280) with:
```ts
  it('renders an empty nested group as the jsonpath identity literal', () => {
    const { values } = runElem('items', { logic: 'and', filters: [{ logic: 'or', filters: [] }] });
    expect(values[0]).toContain('1 == 0');
  });
```

- [ ] **Step 2: Run to verify these fail**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/build.spec.ts src/dialect/jsonpath.spec.ts`
Expected: FAIL — current code returns `''` / throws.

- [ ] **Step 3: Add SQL identity in `src/build.ts`**

Replace `joinLogic`:
```ts
const EMPTY_GROUP_IDENTITY: Record<JsonbFilterGroup['logic'], string> = {
  and: 'true',
  or: 'false',
  not: 'false', // not(AND of nothing) = not(true)
  nor: 'true', // not(OR of nothing) = not(false)
};

/** Join rendered parts per group logic; `not`/`nor` negate the joined result. */
function joinLogic(parts: string[], logic: JsonbFilterGroup['logic']): string {
  if (parts.length === 0) {
    return EMPTY_GROUP_IDENTITY[logic];
  }
  const joined = parts.join(logic === 'or' || logic === 'nor' ? ' or ' : ' and ');
  return logic === 'not' || logic === 'nor' ? `not (${joined})` : joined;
}
```

- [ ] **Step 4: Add jsonpath identity in `src/dialect/jsonpath.ts`**

Replace `groupPredicate`:
```ts
const JSONPATH_EMPTY_IDENTITY: Record<JsonbFilterGroup['logic'], string> = {
  and: '1 == 1',
  or: '1 == 0',
  not: '1 == 0', // !(AND of nothing) = !(true)
  nor: '1 == 1', // !(OR of nothing) = !(false)
};

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
  if (parts.length === 0) {
    return JSONPATH_EMPTY_IDENTITY[group.logic];
  }
  const joined = parts.join(group.logic === 'or' || group.logic === 'nor' ? ' || ' : ' && ');
  return group.logic === 'not' || group.logic === 'nor' ? `!(${joined})` : joined;
}
```

- [ ] **Step 5: Run the full suite + typecheck**

Run: `pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "feat(jsonb-query): empty groups emit boolean identity in both dialects"
```

---

## Task 6: Array element `neq` (∀ "value not present")

Array-element `neq` becomes valid: it means "no element equals the value" — the negation of `eq`'s existence. Missing / non-array / empty arrays count as "does not contain" → match.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/dialect/base.ts`
- Modify: `src/dialect/legacy.ts`
- Modify: `src/dialect/jsonpath.ts`
- Modify: `src/dialect/base.spec.ts`, `src/build.spec.ts`, `src/dialect/legacy.spec.ts`

- [ ] **Step 1: Update behavior-changing tests + add render tests**

In `src/dialect/base.spec.ts`, in the `it('validates array element operators per elementType', ...)` test, replace:
```ts
    expect(arr('string', 'neq')).toThrow(/unsupported operator "neq" for array elements/i);
```
with:
```ts
    expect(arr('string', 'neq')).not.toThrow();
    expect(arr('numeric', 'neq')).not.toThrow();
```

In `src/build.spec.ts`, in `it('rejects invalid phase-2 operator combinations', ...)`, remove the `neq` assertion (lines ~389-391):
```ts
    expect(
      one({ field: 't', dataType: 'array', elementType: 'string', operator: 'neq', value: 'x' }),
    ).toThrow(/unsupported operator "neq" for array elements/i);
```
(delete those three lines).

Append a new test to `src/dialect/legacy.spec.ts` inside the `describe('legacyDialect.renderArray', ...)` block:
```ts
  it('element neq negates the existence (value not present)', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'neq', value: 'a' })).toMatchObject({
      where: `(not (exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$1')}) as e1(v) where (e1.v = $2))))`,
      values: [['tags'], 'a'],
    });
  });
```

Append a new test to `src/build.spec.ts` (top-level, e.g. after the nor/not describe — uses buildJsonbQuery directly):
```ts
describe('buildJsonbQuery — array element neq', () => {
  const one = (f: JsonbFilterGroup['filters'][number]): JsonbFilterGroup => ({ logic: 'and', filters: [f] });

  it('jsonpath renders not(jsonb_path_exists(... == ...))', () => {
    expect(
      buildJsonbQuery('data', one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'neq', value: 'a' }), { dialect: 'jsonpath' }),
    ).toEqual({
      where: '(not jsonb_path_exists("data", $1::jsonpath, $2::jsonb))',
      values: ['$."tags"[*] ? (@ == $v)', { v: 'a' }],
      from: [],
    });
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/base.spec.ts src/dialect/legacy.spec.ts src/build.spec.ts`
Expected: FAIL — `neq` still rejected for array elements; render paths not implemented.

- [ ] **Step 3: Widen the type in `src/types.ts`**

Replace:
```ts
export type JsonbArrayOperator = Exclude<JsonbScalarOperator, 'neq'> | 'containsall';
```
with:
```ts
export type JsonbArrayOperator = JsonbScalarOperator | 'containsall';
```
Update the doc comment above it: remove the "`neq` is excluded" sentence; note `neq` means "value not present" (∀).

- [ ] **Step 4: Allow `neq` in `src/dialect/base.ts` operator sets**

Replace `ARRAY_OPERATORS_BY_ELEMENT`:
```ts
const ARRAY_OPERATORS_BY_ELEMENT: Record<JsonbScalarType, ReadonlySet<string>> = {
  string: new Set(['eq', 'neq', 'contains', 'startswith', 'endswith', 'terms', 'containsall', 'isnull', 'isnotnull']),
  numeric: new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'containsall', 'isnull', 'isnotnull']),
  date: new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'isnull', 'isnotnull']),
  boolean: new Set(['eq', 'neq', 'isnull', 'isnotnull']),
};
```

- [ ] **Step 5: Render `neq` in `src/dialect/legacy.ts`**

Replace the body of `renderArray` after the `containsall` check:
```ts
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
    // neq = "value not present" = NOT(exists element == value).
    const isNeq = operator === 'neq';
    const predicate = renderScalarOp(`${alias}.v`, elementType, isNeq ? 'eq' : operator, value, params);
    const exists = `(exists (select 1 from jsonb_array_elements_text(${guarded}) as ${alias}(v) where ${predicate}))`;
    return isNeq ? `(not ${exists})` : exists;
  },
```

- [ ] **Step 6: Render `neq` in `src/dialect/jsonpath.ts`**

In `renderArray`, replace the tail after the `containsall` check:
```ts
    const isNeq = operator === 'neq';
    const sink = namedSink();
    const { pred } = scalarPredicate('@', elementType, isNeq ? 'eq' : operator, value, sink);
    const exists = pathExists(column, `${memberAccessor('$', field)}[*] ? (${pred})`, sink.vars, params, sink.tz);
    return isNeq ? `(not ${exists})` : exists;
```

In `conditionPredicate`'s scalar-array branch (added in Task 4), replace the two non-null lines:
```ts
    const operator = arr.operator as JsonbScalarOperator;
    const { pred } = scalarPredicate('@', arr.elementType, operator, arr.value, sink);
    return `exists (${acc}[*] ? (${pred}))`;
```
with:
```ts
    const isNeq = arr.operator === 'neq';
    const operator = (isNeq ? 'eq' : arr.operator) as JsonbScalarOperator;
    const { pred } = scalarPredicate('@', arr.elementType, operator, arr.value, sink);
    const existsPred = `exists (${acc}[*] ? (${pred}))`;
    return isNeq ? `(!${existsPred})` : existsPred;
```

- [ ] **Step 7: Run the full suite + typecheck + lint**

Run: `pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "feat(jsonb-query): array element neq with forall (value-not-present) semantics"
```

---

## Task 7: README + changeset

**Files:**
- Modify: `packages/jsonb-query/README.md`
- Create: `.changeset/<slug>.md`

- [ ] **Step 1: Update the README**

Make these edits to `packages/jsonb-query/README.md`:

1. In the operator table, change the `array + scalar elementType` row to include `neq`:
```
| `array` + scalar `elementType`    | element ops (`neq` = value not present) + `containsall` + `isnull` `isnotnull` |
```

2. In the "JSON arrays (scalar elements)" section, replace the sentence "`neq` is not allowed on elements (exists-vs-forall ambiguity)." with:
```
`neq` means **"value not present"** (∀ element ≠ value) — the negation of `eq`'s
"some element matches"; a missing / non-array field counts as not-present and
matches. It is the inline equivalent of wrapping `eq` in a `not` group.
```

3. In the "Arrays of objects (`elemmatch`)" section, replace "Object-valued and scalar-array conditions inside `elemmatch` are not supported yet (rejected in both dialects)." with:
```
Object-valued and scalar-array conditions are supported inside `elemmatch`. In
the `jsonpath` dialect, an `elemmatch` whose body contains an object condition or
a scalar-array `containsall` (neither expressible as a SQL/JSON path predicate)
falls back to a SQL `EXISTS` sub-select for that fragment — same results, but
that fragment is not served by a `jsonb_path_ops` GIN index.
```

4. Add a new "## Errors" section before "## Safety":
```
## Errors

Every caller-input problem throws a `JsonbQueryError` carrying a stable `code`;
any other thrown type signals an internal bug.

```typescript
import { JsonbQueryError } from '@rfjs/jsonb-query';

try {
  buildJsonbQuery('data', filter);
} catch (e) {
  if (e instanceof JsonbQueryError) {
    // e.code: 'INVALID_COLUMN' | 'INVALID_DIALECT' | 'UNSUPPORTED_OPERATOR'
    //       | 'INVALID_ELEMENT_TYPE' | 'INVALID_SCALAR_VALUE' | 'INVALID_ARRAY_VALUE'
    //       | 'INVALID_OBJECT_VALUE' | 'EMPTY_FILTER_GROUP' | 'INVALID_PREFIX'
    //       | 'PARAM_MISMATCH'
  }
}
```
```

5. Add a short note (near the "Embedding in a larger query" section or end) about empty filters:
```
An empty filter group renders its boolean identity (`and`/`nor` → `true`,
`or`/`not` → `false`) rather than an empty string, so `WHERE ${where}` is always
valid SQL. An `elemmatch` still requires at least one condition.
```

- [ ] **Step 2: Create the changeset**

Create `.changeset/jsonb-query-phase2.md`:
```md
---
'@rfjs/jsonb-query': minor
---

Complete elemmatch nesting, typed errors, array `neq`, and empty-group identity.

**Added**
- Object and scalar-array conditions are now supported inside `elemmatch`. In the
  `jsonpath` dialect, non-path-expressible leaves (object conditions,
  scalar-array `containsall`) fall back to a SQL `EXISTS` sub-select for that
  fragment.
- `neq` is now valid on scalar array elements: "value not present" (∀), the
  negation of `eq`. Missing / non-array fields count as not-present.
- `JsonbQueryError` (with a stable `code`) is thrown for all caller-input errors
  and is exported from the package entry point.

**Changed**
- Empty filter groups now render their boolean identity (`and`/`nor` → `true`,
  `or`/`not` → `false`) instead of an empty string. Previously an empty inner
  group was silently dropped; it now contributes its identity, which can change
  results for filters that relied on the old drop behavior.
```

- [ ] **Step 3: Verify build + full suite**

Run: `pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query build`
Expected: PASS, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/jsonb-query/README.md .changeset/jsonb-query-phase2.md
git commit -m "docs(jsonb-query): document elemmatch nesting, neq, errors, empty-group identity"
```

---

## Task 8: E2E result-asserting cases

Add cases to the self-skipping E2E suite. These assert query *results* (SQL text is non-stable API). The suite skips entirely unless `PG_E2E_URLS` is set.

**Files:**
- Modify: `packages/jsonb-query/test/jsonb-query.e2e.spec.ts`

- [ ] **Step 1: Extend the seed (if needed) and add cases**

The existing `SEED` already covers `items` (array of objects with `meta`-free objects), `tags`, `nums`, `orders`. Add a `meta` object inside an `items` element for the object-in-elemmatch case. In `SEED` id 1's `items`, change the first element to include `meta`:
```ts
        { sku: 'x', qty: 2, ship: '2020-02-01T00:00:00+00:00', meta: { vip: true } },
```

Add these tests inside the `describe('elemmatch', ...)` block:
```ts
        it('object condition inside elemmatch (jsonpath uses SQL fallback)', async () => {
          await expectIds(
            {
              logic: 'and',
              filters: [
                {
                  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                  filters: {
                    logic: 'and',
                    filters: [
                      { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
                      { field: 'meta', dataType: 'object', operator: 'contains', value: { vip: true } },
                    ],
                  },
                },
              ],
            },
            [1],
          );
        });

        it('scalar-array condition inside elemmatch', async () => {
          // orders[0] has lines (array of objects); use a scalar-array seed.
          // id 1 items all have sku; assert "some element whose sku is in a set".
          await expectIds(
            {
              logic: 'and',
              filters: [
                {
                  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                  filters: {
                    logic: 'and',
                    filters: [
                      { field: 'sku', dataType: 'string', operator: 'eq', value: 'y' },
                      { field: 'qty', dataType: 'numeric', operator: 'gte', value: 10 },
                    ],
                  },
                },
              ],
            },
            [1],
          );
        });
```

Add an array-`neq` test inside the `describe('scalar-array conditions', ...)` block:
```ts
        it('element neq = value not present (∀); missing/non-array match', async () => {
          // tags present on 1 (a,b) and 2 (b,c); 'a' present only on 1.
          // not-present-'a' => everyone except id 1 (incl. missing tags + the
          // malformed scalar "a" on id 4: legacy treats scalar as empty array;
          // jsonpath lax-wraps "a" but "a" != ... wait it equals -> see note).
          await expectPerDialect(
            { logic: 'and', filters: [{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'neq', value: 'a' }] },
            { legacy: [2, 3, 4, 5, 6, 7, 8], jsonpath: [2, 3, 5, 6, 7, 8] },
          );
        });
```
> Note on the divergence: id 4 stores `tags: "a"` (a scalar). legacy's `jsonb_typeof` guard treats it as an empty array → "not present" → matches `neq`. jsonpath lax mode wraps `"a"` into `["a"]`, which *does* contain `"a"` → `not(exists ... == 'a')` is false → id 4 excluded. This mirrors the existing `scalar-array eq` malformed-shape divergence test.

Add an empty-group E2E (matches everything) inside the top-level describe:
```ts
      it('an empty filter group renders true (matches all rows)', async () => {
        await expectIds({ logic: 'and', filters: [] }, [1, 2, 3, 4, 5, 6, 7, 8]);
      });
```

- [ ] **Step 2: Verify it self-skips without a DB**

Run: `pnpm -F @rfjs/jsonb-query vitest:e2e:run`
Expected: PASS with all suites skipped (no `PG_E2E_URLS`).

- [ ] **Step 3 (optional, if Docker available): run against real PG**

Run:
```bash
cd packages/jsonb-query && bash scripts/e2e.sh
```
Expected: PASS on PG 11.16 (legacy only) and PG 16 (legacy + jsonpath). If Docker is unavailable, skip and note it.

- [ ] **Step 4: Commit**

```bash
git add packages/jsonb-query/test/jsonb-query.e2e.spec.ts
git commit -m "test(jsonb-query): e2e for elemmatch nesting, array neq, empty group"
```

---

## Final verification

- [ ] Run the full package gate from repo root:
```bash
pnpm -F @rfjs/jsonb-query lint && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query build
```
Expected: all PASS.

- [ ] Confirm the public surface: `JsonbQueryError` and `JsonbQueryErrorCode` are exported from `@rfjs/jsonb-query`; `JsonbArrayOperator` now includes `neq`.

- [ ] Open a PR `feat/jsonb-query-phase2 → main` (per the finishing-a-development-branch flow) once the user approves.

---

## Self-Review (filled in during planning)

**Spec coverage:** A → Tasks 3+4 (guards removed, scalar-array branch, hybrid fallback) + legacy needs no change; B → Task 5 (build.ts + jsonpath identity, both dialects per refined spec); C → Tasks 1+2 (class + 10 codes wired 1:1); D → Task 6 (type, operator sets, both dialects, elemmatch branch). Docs → Task 7; E2E → Task 8.

**Placeholder scan:** none — every code/test step shows complete code; commands have expected output.

**Type consistency:** `assertCondition(node)` (1-arg) used consistently after Task 3; `groupNeedsSqlFallback` name matches across base.ts/jsonpath.ts/tests; `JsonbQueryErrorCode` values identical in errors.ts, tests, README, changeset; `JsonbArrayOperator = JsonbScalarOperator | 'containsall'` matches the `neq` operator-set additions.

**Cross-task test maintenance flagged:** base.spec (Tasks 3, 6), build.spec (Tasks 3, 5, 6), jsonpath.spec (Tasks 3, 5), legacy.spec (Task 6) — each edit is specified inline in the task that changes the behavior.
