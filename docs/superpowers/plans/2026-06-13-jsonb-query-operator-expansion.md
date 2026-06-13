# jsonb-query Operator Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three operator families to `@rfjs/jsonb-query` — key-existence (`haskey`/`hasanykey`/`hasallkeys`), case-insensitive text (`icontains`/`istartswith`/`iendswith`/`ieq`/`ineq`), and array emptiness (`isempty`/`isnotempty`) — plus a GIN indexing guide, across both dialects.

**Architecture:** Filter metadata renders to a parameterized PostgreSQL `WHERE` via two dialects (`legacy` `#>>`, `jsonpath` `jsonb_path_exists`). Validation lives in `src/dialect/base.ts` (`assertCondition` + operator sets + value guards). Object conditions render dialect-independently (`src/object-condition.ts`); scalar conditions render per-dialect (`legacy.ts` `renderScalarOp`, `jsonpath.ts` `scalarPredicate`); scalar-array conditions short-circuit `isnull`/`containsall`/etc. in each dialect's `renderArray`. We extend each of these following the existing patterns. **No new error codes** — value guards reuse `INVALID_SCALAR_VALUE` / `INVALID_ARRAY_VALUE`.

**Tech Stack:** TypeScript 5.7, Vitest (co-located `src/**/*.spec.ts`), pnpm + Turborepo, Changesets.

**Spec:** `docs/superpowers/specs/2026-06-13-jsonb-query-operator-expansion-design.md`

**Working directory:** `packages/jsonb-query` inside the `feat/jsonb-query-operators` worktree (already created off the post-Phase-2 main). Commands assume repo root unless noted. Per-file test run: `pnpm -F @rfjs/jsonb-query vitest:run <path>`. Full gate: `pnpm -F @rfjs/jsonb-query lint && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query test`.

---

## File Structure

**Modified:**
- `src/types.ts` — widen `JsonbObjectOperator`, `JsonbScalarOperator`, `JsonbArrayOperator`; widen `JsonbObjectCondition.value`.
- `src/dialect/base.ts` — `OBJECT_OPERATORS`, `OPERATORS_BY_TYPE.string`, `ARRAY_OPERATORS_BY_ELEMENT`; new `assertKeyValue` / `assertKeyArray` / `renderArrayEmptiness`; extend `conditionNeedsSqlFallback`.
- `src/object-condition.ts` — `haskey`/`hasanykey`/`hasallkeys` render cases.
- `src/dialect/legacy.ts` — `renderScalarOp` case-insensitive cases; `renderArray` emptiness short-circuit.
- `src/dialect/jsonpath.ts` — `scalarPredicate` case-insensitive cases; `renderArray` emptiness short-circuit.
- Test specs co-located: `object-condition.spec.ts`, `dialect/legacy.spec.ts`, `dialect/jsonpath.spec.ts`, `dialect/base.spec.ts`, `build.spec.ts`.
- `README.md`; `.changeset/<slug>.md` (new).
- `test/jsonb-query.e2e.spec.ts`.

**Build order:** K (objects) → I (case-insensitive scalars) → S (array emptiness) → docs/changeset → E2E. Each task is independently green and committed.

---

## Task 1: K — key-existence operators (`haskey` / `hasanykey` / `hasallkeys`)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/dialect/base.ts`
- Modify: `src/object-condition.ts`
- Test: `src/object-condition.spec.ts`, `src/dialect/base.spec.ts`

- [ ] **Step 1: Write the failing render tests**

Append to `src/object-condition.spec.ts` (inside the `describe('renderObjectCondition', …)` block):

```ts
  it('haskey uses the jsonb ? operator', () => {
    expect(run({ field: 'profile', operator: 'haskey', value: 'vip' })).toEqual({
      where: '(("data" #> $1) ? $2)',
      values: [['profile'], 'vip'],
    });
  });

  it('hasanykey / hasallkeys use ?| / ?& with a text[] param', () => {
    expect(run({ field: 'profile', operator: 'hasanykey', value: ['vip', 'premium'] })).toEqual({
      where: '(("data" #> $1) ?| $2::text[])',
      values: [['profile'], ['vip', 'premium']],
    });
    expect(run({ field: 'profile', operator: 'hasallkeys', value: ['vip', 'level'] })).toEqual({
      where: '(("data" #> $1) ?& $2::text[])',
      values: [['profile'], ['vip', 'level']],
    });
  });

  it('rejects bad key arguments', () => {
    expect(() => run({ field: 'p', operator: 'haskey', value: ['x'] as never })).toThrow(
      /requires a single string key/i,
    );
    expect(() => run({ field: 'p', operator: 'hasanykey', value: [] as never })).toThrow(
      /requires a non-empty array of string keys/i,
    );
    expect(() => run({ field: 'p', operator: 'hasallkeys', value: [1] as never })).toThrow(
      /requires a non-empty array of string keys/i,
    );
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/object-condition.spec.ts`
Expected: FAIL — `haskey`/`hasanykey`/`hasallkeys` hit the `default` throw (`Unsupported operator … for type "object"`), and the types reject the operator/value.

- [ ] **Step 3: Widen types in `src/types.ts`**

Replace:
```ts
export type JsonbObjectOperator = 'eq' | 'neq' | 'contains' | 'isnull' | 'isnotnull';
```
with:
```ts
export type JsonbObjectOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'isnull'
  | 'isnotnull'
  | 'haskey'
  | 'hasanykey'
  | 'hasallkeys';
```

Replace the `JsonbObjectCondition.value` line:
```ts
  value?: JsonbObjectValue;
```
with:
```ts
  /** Object value for eq/neq/contains; a string key for haskey; a string[] for hasanykey/hasallkeys. */
  value?: JsonbObjectValue | string | string[];
```

- [ ] **Step 4: Add operator-set membership + key guards in `src/dialect/base.ts`**

Replace `OBJECT_OPERATORS`:
```ts
const OBJECT_OPERATORS: ReadonlySet<JsonbObjectOperator> = new Set([
  'eq', 'neq', 'contains', 'isnull', 'isnotnull', 'haskey', 'hasanykey', 'hasallkeys',
]);
```

Add two guards next to `assertObjectValue`:
```ts
export function assertKeyValue(operator: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new JsonbQueryError(`Operator "${operator}" requires a single string key`, 'INVALID_SCALAR_VALUE');
  }
  return value;
}

export function assertKeyArray(operator: string, value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((k) => typeof k === 'string')) {
    throw new JsonbQueryError(
      `Operator "${operator}" requires a non-empty array of string keys`,
      'INVALID_ARRAY_VALUE',
    );
  }
  return value as string[];
}
```

- [ ] **Step 5: Render in `src/object-condition.ts`**

Add `assertKeyValue, assertKeyArray` to the import from `'./dialect'`:
```ts
import {
  fieldSegments,
  assertObjectValue,
  assertKeyValue,
  assertKeyArray,
  renderNullCheck,
  renderJsonbContains,
} from './dialect';
```

Add cases to the `switch (operator)` before `default`:
```ts
    case 'haskey': {
      const key = assertKeyValue(operator, value);
      return `((${column} #> ${params.add(fieldSegments(field))}) ? ${params.add(key)})`;
    }
    case 'hasanykey':
    case 'hasallkeys': {
      const keys = assertKeyArray(operator, value);
      const op = operator === 'hasanykey' ? '?|' : '?&';
      return `((${column} #> ${params.add(fieldSegments(field))}) ${op} ${params.add(keys)}::text[])`;
    }
```

- [ ] **Step 6: Run render tests to verify they pass**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/object-condition.spec.ts`
Expected: PASS.

- [ ] **Step 7: Add validation test in `src/dialect/base.spec.ts`**

In the `describe('assertCondition', …)` block, extend the `validates object operators` test (or add a new `it`):
```ts
  it('accepts key-existence object operators', () => {
    expect(c({ field: 'p', dataType: 'object', operator: 'haskey', value: 'vip' })).not.toThrow();
    expect(c({ field: 'p', dataType: 'object', operator: 'hasanykey', value: ['a'] })).not.toThrow();
    expect(c({ field: 'p', dataType: 'object', operator: 'hasallkeys', value: ['a', 'b'] })).not.toThrow();
  });
```
(`c` is the existing 1-arg helper: `const c = (node) => () => assertCondition(node as JsonbCondition)`.)

- [ ] **Step 8: Verify gate**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/object-condition.spec.ts src/dialect/base.spec.ts && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query lint`
Expected: PASS, clean.

- [ ] **Step 9: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "feat(jsonb-query): add key-existence object operators (haskey/hasanykey/hasallkeys)"
```

---

## Task 2: I — case-insensitive text operators

`icontains` / `istartswith` / `iendswith` / `ieq` / `ineq`, valid for `string` only. legacy uses `lower()` on both sides (literal, no `LIKE` metachar pitfalls); jsonpath uses `like_regex … flag "i"`.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/dialect/base.ts`
- Modify: `src/dialect/legacy.ts`
- Modify: `src/dialect/jsonpath.ts`
- Test: `src/dialect/legacy.spec.ts`, `src/dialect/jsonpath.spec.ts`, `src/dialect/base.spec.ts`

- [ ] **Step 1: Write the failing legacy + jsonpath tests**

Append to `src/dialect/legacy.spec.ts` inside `describe('legacyDialect', …)` (the `run` helper there is `run(field, dataType, operator, value)`):
```ts
  it('case-insensitive operators lower() both sides (literal, no LIKE)', () => {
    expect(run('name', 'string', 'ieq', 'Bob')).toEqual({
      where: '(lower(("data" #>> $1)) = lower($2))',
      values: [['name'], 'Bob'],
    });
    expect(run('name', 'string', 'ineq', 'Bob').where).toBe('(lower(("data" #>> $1)) <> lower($2))');
    expect(run('name', 'string', 'icontains', 'Bo').where).toBe(
      '(position(lower($2) in lower(("data" #>> $1))) > 0)',
    );
    expect(run('name', 'string', 'istartswith', 'Bo').where).toBe(
      '(left(lower(("data" #>> $1)), char_length($2)) = lower($2))',
    );
    expect(run('name', 'string', 'iendswith', 'ob').where).toBe(
      '(right(lower(("data" #>> $1)), char_length($2)) = lower($2))',
    );
  });
```

Append to `src/dialect/jsonpath.spec.ts` inside `describe('jsonpathDialect', …)` (its `run` helper returns `{ where, values }` from `jsonpathDialect.render`):
```ts
  it('case-insensitive operators use like_regex with flag "i"', () => {
    expect(run('name', 'string', 'icontains', 'Bo').values[0]).toBe('$."name" ? (@ like_regex "Bo" flag "i")');
    expect(run('name', 'string', 'istartswith', 'Bo').values[0]).toBe('$."name" ? (@ like_regex "^Bo" flag "i")');
    expect(run('name', 'string', 'iendswith', 'ob').values[0]).toBe('$."name" ? (@ like_regex "ob$" flag "i")');
    expect(run('name', 'string', 'ieq', 'Bob').values[0]).toBe('$."name" ? (@ like_regex "^Bob$" flag "i")');
    expect(run('name', 'string', 'ineq', 'Bob').values[0]).toBe('$."name" ? (!(@ like_regex "^Bob$" flag "i"))');
  });

  it('icontains regex-escapes the literal', () => {
    expect(run('name', 'string', 'icontains', 'a.b').values[0]).toBe('$."name" ? (@ like_regex "a\\\\.b" flag "i")');
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/legacy.spec.ts src/dialect/jsonpath.spec.ts`
Expected: FAIL — the operators hit the `default` `Unsupported operator` throw in `renderScalarOp` / `scalarPredicate`, and the types reject them.

- [ ] **Step 3: Widen the scalar operator union in `src/types.ts`**

Replace the `JsonbScalarOperator` union's closing lines:
```ts
  | 'range'
  | 'terms';
```
with:
```ts
  | 'range'
  | 'terms'
  | 'icontains'
  | 'istartswith'
  | 'iendswith'
  | 'ieq'
  | 'ineq';
```

- [ ] **Step 4: Allow the operators for `string` in `src/dialect/base.ts`**

Replace the `string` line of `OPERATORS_BY_TYPE`:
```ts
  string: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'contains', 'startswith', 'endswith', 'terms']),
```
with:
```ts
  string: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'contains', 'startswith', 'endswith', 'terms', 'icontains', 'istartswith', 'iendswith', 'ieq', 'ineq']),
```

- [ ] **Step 5: Render in `src/dialect/legacy.ts` `renderScalarOp`**

Add these cases before the `default` in the `switch (operator)`:
```ts
    case 'ieq':
      return `(lower(${F}) = lower(${params.add(assertScalarValue(operator, value))}))`;
    case 'ineq':
      return `(lower(${F}) <> lower(${params.add(assertScalarValue(operator, value))}))`;
    case 'icontains':
      return `(position(lower(${params.add(assertScalarValue(operator, value))}) in lower(${F})) > 0)`;
    case 'istartswith': {
      const v = params.add(assertScalarValue(operator, value));
      return `(left(lower(${F}), char_length(${v})) = lower(${v}))`;
    }
    case 'iendswith': {
      const v = params.add(assertScalarValue(operator, value));
      return `(right(lower(${F}), char_length(${v})) = lower(${v}))`;
    }
```
(`F` is the uncast `#>>` text expression; case-insensitive operators are string-only so no cast applies.)

- [ ] **Step 6: Render in `src/dialect/jsonpath.ts` `scalarPredicate`**

Add these cases before the `default` in the `switch (operator)` (the file already imports `escapeJsonpathString, escapeRegexLiteral`):
```ts
    case 'icontains': {
      const lit = escapeJsonpathString(escapeRegexLiteral(String(assertScalarValue(operator, value))));
      return { pred: `${acc} like_regex "${lit}" flag "i"`, compound: false };
    }
    case 'istartswith': {
      const lit = escapeJsonpathString('^' + escapeRegexLiteral(String(assertScalarValue(operator, value))));
      return { pred: `${acc} like_regex "${lit}" flag "i"`, compound: false };
    }
    case 'iendswith': {
      const lit = escapeJsonpathString(escapeRegexLiteral(String(assertScalarValue(operator, value))) + '$');
      return { pred: `${acc} like_regex "${lit}" flag "i"`, compound: false };
    }
    case 'ieq': {
      const lit = escapeJsonpathString('^' + escapeRegexLiteral(String(assertScalarValue(operator, value))) + '$');
      return { pred: `${acc} like_regex "${lit}" flag "i"`, compound: false };
    }
    case 'ineq': {
      const lit = escapeJsonpathString('^' + escapeRegexLiteral(String(assertScalarValue(operator, value))) + '$');
      return { pred: `!(${acc} like_regex "${lit}" flag "i")`, compound: true };
    }
```

- [ ] **Step 7: Run render tests to verify they pass**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/legacy.spec.ts src/dialect/jsonpath.spec.ts`
Expected: PASS.

- [ ] **Step 8: Add membership test in `src/dialect/base.spec.ts`**

In `describe('assertCondition', …)`:
```ts
  it('accepts case-insensitive operators only for string', () => {
    expect(c({ field: 'x', dataType: 'string', operator: 'icontains', value: 'a' })).not.toThrow();
    expect(c({ field: 'x', dataType: 'string', operator: 'ieq', value: 'a' })).not.toThrow();
    expect(c({ field: 'x', dataType: 'numeric', operator: 'icontains', value: 1 })).toThrow(
      /unsupported operator "icontains" for type "numeric"/i,
    );
  });
```

- [ ] **Step 9: Verify gate**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/legacy.spec.ts src/dialect/jsonpath.spec.ts src/dialect/base.spec.ts && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query lint`
Expected: PASS, clean.

- [ ] **Step 10: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "feat(jsonb-query): add case-insensitive text operators (icontains/istartswith/iendswith/ieq/ineq)"
```

---

## Task 3: S — array emptiness operators (`isempty` / `isnotempty`)

Value-less operators on scalar-element arrays, rendered dialect-independently via a shared helper (like `containsall`). Inside `elemmatch` they force the SQL fallback (also like `containsall`).

**Files:**
- Modify: `src/types.ts`
- Modify: `src/dialect/base.ts`
- Modify: `src/dialect/legacy.ts`
- Modify: `src/dialect/jsonpath.ts`
- Test: `src/dialect/legacy.spec.ts`, `src/build.spec.ts`, `src/dialect/base.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/dialect/legacy.spec.ts` inside `describe('legacyDialect.renderArray', …)` (its `runArray` helper takes `Omit<JsonbArrayCondition, 'dataType'>`):
```ts
  it('isempty / isnotempty test the array length (dialect-independent)', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'isempty' })).toMatchObject({
      where: "(jsonb_typeof(\"data\" #> $1) = 'array' and jsonb_array_length(\"data\" #> $1) = 0)",
      values: [['tags']],
    });
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'isnotempty' }).where).toBe(
      "(jsonb_typeof(\"data\" #> $1) = 'array' and jsonb_array_length(\"data\" #> $1) > 0)",
    );
  });
```

Append to `src/build.spec.ts` (top-level, e.g. after the array-neq describe — uses `buildJsonbQuery`):
```ts
describe('buildJsonbQuery — array emptiness', () => {
  const one = (f: JsonbFilterGroup['filters'][number]): JsonbFilterGroup => ({ logic: 'and', filters: [f] });

  it('isempty renders identical SQL in both dialects', () => {
    const filter = one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'isempty' });
    const expected = "(jsonb_typeof(\"data\" #> $1) = 'array' and jsonb_array_length(\"data\" #> $1) = 0)";
    expect(buildJsonbQuery('data', filter).where).toBe(expected);
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' }).where).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/legacy.spec.ts src/build.spec.ts`
Expected: FAIL — `isempty`/`isnotempty` are rejected by `assertCondition` (not in `ARRAY_OPERATORS_BY_ELEMENT`) and not rendered.

- [ ] **Step 3: Widen the array operator union in `src/types.ts`**

Replace:
```ts
export type JsonbArrayOperator = JsonbScalarOperator | 'containsall';
```
with:
```ts
export type JsonbArrayOperator = JsonbScalarOperator | 'containsall' | 'isempty' | 'isnotempty';
```

- [ ] **Step 4: Allow + render-helper in `src/dialect/base.ts`**

Add `isempty`/`isnotempty` to every element set in `ARRAY_OPERATORS_BY_ELEMENT`:
```ts
const ARRAY_OPERATORS_BY_ELEMENT: Record<JsonbScalarType, ReadonlySet<string>> = {
  string: new Set(['eq', 'neq', 'contains', 'startswith', 'endswith', 'terms', 'containsall', 'isnull', 'isnotnull', 'isempty', 'isnotempty']),
  numeric: new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'containsall', 'isnull', 'isnotnull', 'isempty', 'isnotempty']),
  date: new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'isnull', 'isnotnull', 'isempty', 'isnotempty']),
  boolean: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'isempty', 'isnotempty']),
};
```

Add the shared render helper (next to `renderNullCheck`):
```ts
/** Array emptiness via jsonb_array_length, dialect-independent. Missing / non-array → both false. */
export function renderArrayEmptiness(
  column: string,
  field: string,
  operator: 'isempty' | 'isnotempty',
  params: ParamBuilder,
): string {
  const arr = `${column} #> ${params.add(fieldSegments(field))}`;
  const cmp = operator === 'isempty' ? '= 0' : '> 0';
  return `(jsonb_typeof(${arr}) = 'array' and jsonb_array_length(${arr}) ${cmp})`;
}
```

Extend `conditionNeedsSqlFallback` so an emptiness leaf inside `elemmatch` forces the SQL fallback (like `containsall`):
```ts
  if (node.dataType === 'array') {
    if (node.elementType === 'object') {
      return groupNeedsSqlFallback(node.filters);
    }
    return node.operator === 'containsall' || node.operator === 'isempty' || node.operator === 'isnotempty';
  }
```

- [ ] **Step 5: Short-circuit in both dialects' `renderArray`**

In `src/dialect/legacy.ts`, import the helper (add to the `'./base'` import): `renderArrayEmptiness`. Then in `renderArray`, add after the `isnull`/`isnotnull` block:
```ts
    if (operator === 'isempty' || operator === 'isnotempty') {
      return renderArrayEmptiness(column, field, operator, params);
    }
```

In `src/dialect/jsonpath.ts`, import `renderArrayEmptiness` from `'./base'`, and add the same short-circuit in `renderArray` after the `isnull`/`isnotnull` block:
```ts
    if (operator === 'isempty' || operator === 'isnotempty') {
      return renderArrayEmptiness(column, field, operator, params);
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm -F @rfjs/jsonb-query vitest:run src/dialect/legacy.spec.ts src/build.spec.ts`
Expected: PASS.

- [ ] **Step 7: Add membership + elemmatch-fallback tests in `src/dialect/base.spec.ts`**

In `describe('assertCondition', …)`:
```ts
  it('accepts isempty / isnotempty for every array element type', () => {
    for (const elementType of ['string', 'numeric', 'date', 'boolean'] as const) {
      expect(c({ field: 'a', dataType: 'array', elementType, operator: 'isempty' })).not.toThrow();
      expect(c({ field: 'a', dataType: 'array', elementType, operator: 'isnotempty' })).not.toThrow();
    }
  });
```

In `describe('groupNeedsSqlFallback', …)`, extend the "true" case:
```ts
  it('isempty / isnotempty force the SQL fallback', () => {
    expect(groupNeedsSqlFallback(g([{ field: 't', dataType: 'array', elementType: 'string', operator: 'isempty' }]))).toBe(true);
    expect(groupNeedsSqlFallback(g([{ field: 't', dataType: 'array', elementType: 'string', operator: 'isnotempty' }]))).toBe(true);
  });
```
(`g` is the existing helper `(filters) => ({ logic: 'and', filters })`.)

- [ ] **Step 8: Verify gate**

Run: `pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query lint`
Expected: PASS (full suite), clean.

- [ ] **Step 9: Commit**

```bash
git add packages/jsonb-query/src
git commit -m "feat(jsonb-query): add array emptiness operators (isempty/isnotempty)"
```

---

## Task 4: README + changeset

**Files:**
- Modify: `packages/jsonb-query/README.md`
- Create: `.changeset/jsonb-query-operator-expansion.md`

- [ ] **Step 1: Update the operator table in `README.md`**

In the "## Supported types & operators" table:
- `string` row — append the case-insensitive operators:
```
| `string`                          | `eq` `neq` `isnull` `isnotnull` `contains` `startswith` `endswith` `terms` `icontains` `istartswith` `iendswith` `ieq` `ineq` |
```
- `object` row — append the key-existence operators:
```
| `object`                          | `eq` `neq` `contains` `isnull` `isnotnull` `haskey` `hasanykey` `hasallkeys`               |
```
- `array` + scalar `elementType` row — append emptiness:
```
| `array` + scalar `elementType`    | element ops (`neq` = value not present) + `containsall` + `isempty` `isnotempty` + `isnull` `isnotnull` |
```

- [ ] **Step 2: Add operator explanations to `README.md`**

After the "### Nested objects" section, add:
```
### Key existence (object)

`haskey` / `hasanykey` / `hasallkeys` test for the presence of object **keys**
(jsonb `?` / `?|` / `?&`), regardless of the value at that key — distinct from
`isnotnull`, which tests the value (a key present with a JSON `null` value is
`haskey: true` but `isnotnull: false`). All three are GIN-indexable.

```typescript
{ field: 'profile', dataType: 'object', operator: 'haskey', value: 'vip' }
//  (("data" #> $1) ? $2)              values: [['profile'], 'vip']
{ field: 'profile', dataType: 'object', operator: 'hasanykey', value: ['vip','premium'] }
//  (("data" #> $1) ?| $2::text[])
{ field: 'profile', dataType: 'object', operator: 'hasallkeys', value: ['vip','level'] }
//  (("data" #> $1) ?& $2::text[])
```

### Case-insensitive text

`icontains` / `istartswith` / `iendswith` / `ieq` / `ineq` match strings
case-insensitively. The legacy dialect lowercases both sides (`lower()`); the
jsonpath dialect uses `like_regex … flag "i"`.

> Case folding differs slightly between dialects on non-ASCII text: `lower()`
> follows the database `LC_CTYPE`, while jsonpath `flag "i"` uses its own Unicode
> rules. ASCII text matches identically.

### Array emptiness

`isempty` / `isnotempty` test whether a scalar-element array field has zero /
at least one element (`jsonb_array_length`). A missing field or non-array value
is **neither** (both operators return false). They render identical SQL in both
dialects.
```

- [ ] **Step 3: Add the indexing section to `README.md`**

Before "## Safety", add:
```
## Indexing

| Operators | Index that helps |
| --- | --- |
| object `contains`/`containsall` (`@>`), `haskey`/`hasanykey`/`hasallkeys` (`?`/`?|`/`?&`) | default `GIN (col jsonb_ops)` |
| `jsonpath` dialect predicates (`@?` / `@@`) | `GIN (col jsonb_path_ops)` |
| `legacy` scalar comparisons on a hot path | b-tree **expression** index, e.g. `CREATE INDEX ON t ((data #>> '{status}'))` |

`contains` / `icontains` / `startswith` / `istartswith` / `endswith` /
`iendswith` are **not** index-served (they scan); for heavy substring search use
a `pg_trgm` GIN index. The jsonpath `elemmatch` SQL-fallback fragment (object or
`containsall` leaf) is not served by a `jsonb_path_ops` GIN index.
```

- [ ] **Step 4: Create the changeset**

Create `.changeset/jsonb-query-operator-expansion.md`:
```md
---
'@rfjs/jsonb-query': minor
---

Add three operator families.

**Added**
- Key-existence object operators `haskey` / `hasanykey` / `hasallkeys` (jsonb
  `?` / `?|` / `?&`), distinct from `isnull`/`isnotnull` (which test the value).
- Case-insensitive text operators `icontains` / `istartswith` / `iendswith` /
  `ieq` / `ineq` for `string` conditions.
- Array emptiness operators `isempty` / `isnotempty` for scalar-element arrays.
- README "Indexing" section mapping operators to GIN / expression indexes.
```

- [ ] **Step 5: Verify build + full suite**

Run: `pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query build`
Expected: PASS, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/jsonb-query/README.md .changeset/jsonb-query-operator-expansion.md
git commit -m "docs(jsonb-query): document key-existence, case-insensitive, emptiness operators + indexing"
```

---

## Task 5: E2E result-asserting cases

Add cases to the self-skipping E2E suite (skips entirely without `PG_E2E_URLS`). Assert query *results*, never SQL text.

**Files:**
- Modify: `packages/jsonb-query/test/jsonb-query.e2e.spec.ts`

- [ ] **Step 1: Extend the seed and add cases**

The existing `SEED` (id 1 `bob`, id 2 `alice`, id 3 `carol` with JSON-null age, id 4 `dave` malformed, …). To exercise `haskey` vs `isnotnull`, ensure a row has a key whose value is JSON null. Change id 3's seed object to include an explicit null-valued key under a `profile`:
```ts
  // JSON null age; profile present with a null-valued key (for haskey vs isnotnull).
  [3, { name: 'carol', age: null, profile: { vip: null } }],
```

Add a new describe block (top level inside the per-URL describe, alongside the others):
```ts
      describe('operator expansion', () => {
        const one = (f: JsonbFilterGroup['filters'][number]): JsonbFilterGroup => ({ logic: 'and', filters: [f] });

        it('haskey detects a null-valued key that isnotnull misses', async () => {
          // id 3 has profile.vip = null: the KEY exists (haskey) but the VALUE is null (isnotnull false).
          await expectIds(one({ field: 'profile', dataType: 'object', operator: 'haskey', value: 'vip' }), [1, 2, 3]);
          await expectIds(one({ field: 'profile.vip', dataType: 'boolean', operator: 'isnotnull' }), [1, 2]);
        });

        it('hasanykey / hasallkeys', async () => {
          await expectIds(one({ field: 'profile', dataType: 'object', operator: 'hasallkeys', value: ['vip', 'level'] }), [1]);
          await expectIds(one({ field: 'profile', dataType: 'object', operator: 'hasanykey', value: ['level', 'nope'] }), [1]);
        });

        it('case-insensitive contains matches regardless of case', async () => {
          await expectIds(one({ field: 'name', dataType: 'string', operator: 'icontains', value: 'BO' }), [1]);
          await expectIds(one({ field: 'name', dataType: 'string', operator: 'ieq', value: 'ALICE' }), [2]);
        });

        it('isempty / isnotempty on the tags array', async () => {
          // id 1 tags:[a,b], id 2 tags:[b,c] → isnotempty [1,2]; none seeded with [] → isempty [].
          await expectIds(one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'isnotempty' }), [1, 2]);
          await expectIds(one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'isempty' }), []);
        });
      });
```
> Verify the actual seed values for `profile`/`name`/`tags` when implementing and adjust the expected id arrays to match the real seed; the assertion is on *results*, so it must reflect the committed seed.

- [ ] **Step 2: Verify it self-skips without a DB**

Run: `pnpm -F @rfjs/jsonb-query vitest:e2e:run`
Expected: PASS, all suites skipped (no `PG_E2E_URLS`).

- [ ] **Step 3 (optional, if Docker available): run against real PG**

Run:
```bash
cd packages/jsonb-query && bash scripts/e2e.sh
```
Expected: PASS on PG 11.16 (legacy) and PG 16 (legacy + jsonpath). If Docker is unavailable, skip and note it.

- [ ] **Step 4: Commit**

```bash
git add packages/jsonb-query/test/jsonb-query.e2e.spec.ts
git commit -m "test(jsonb-query): e2e for key-existence, case-insensitive, emptiness operators"
```

---

## Final verification

- [ ] From repo root: `pnpm -F @rfjs/jsonb-query lint && pnpm -F @rfjs/jsonb-query typecheck && pnpm -F @rfjs/jsonb-query test && pnpm -F @rfjs/jsonb-query build` — all PASS.
- [ ] Confirm the public surface: `JsonbObjectOperator` includes `haskey`/`hasanykey`/`hasallkeys`; `JsonbScalarOperator` includes the five `i*`; `JsonbArrayOperator` includes `isempty`/`isnotempty`.
- [ ] Open a PR `feat/jsonb-query-operators → main` once the user approves.

---

## Self-Review (filled in during planning)

**Spec coverage:** K → Task 1 (types, OBJECT_OPERATORS, guards, render). I → Task 2 (union, OPERATORS_BY_TYPE.string, legacy + jsonpath render). S → Task 3 (union, ARRAY_OPERATORS_BY_ELEMENT, shared `renderArrayEmptiness`, both dialects, `conditionNeedsSqlFallback`). D → Task 4 (README Indexing). Docs/changeset → Task 4; E2E → Task 5. No new error codes (spec confirmed) — guards reuse `INVALID_SCALAR_VALUE`/`INVALID_ARRAY_VALUE`.

**Placeholder scan:** none — every code/test step shows complete code; the E2E step flags that expected id arrays must match the real committed seed (an instruction, not a placeholder).

**Type consistency:** `assertKeyValue`/`assertKeyArray`/`renderArrayEmptiness` names match across base.ts, object-condition.ts, both dialects, and tests; operator spellings (`hasanykey`, `hasallkeys`, `istartswith`, `iendswith`, `isnotempty`) are identical in types, operator sets, render switches, and tests; `JsonbArrayOperator = JsonbScalarOperator | 'containsall' | 'isempty' | 'isnotempty'` matches the operator-set additions and the `conditionNeedsSqlFallback` extension.
