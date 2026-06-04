# jsonb-query Parameterized Redesign — Design (Phase 1)

**Status:** approved-pending-review
**Date:** 2026-06-03
**Package:** `@rfjs/jsonb-query` (currently held back from publish via changeset `ignore`)

## 1. Background & Motivation

`@rfjs/jsonb-query` builds PostgreSQL `WHERE`/`FROM` clauses for querying JSONB
columns from a nested filter-metadata tree. The current implementation builds
SQL by **unescaped string interpolation**, which is a SQL-injection vector, and
it carries several latent correctness bugs that survived because the package has
no consumers, was never published, and its tests are tautologies
(`expect('toQuery').toEqual('toQuery')`) that assert nothing about the generated
SQL.

This redesign replaces string interpolation with **parameterized queries**
(node-postgres positional `$1, $2` placeholders) and introduces a **dual SQL
dialect** so the same filter metadata can target either legacy JSONB operators
or the newer SQL/JSON path syntax.

### Bugs eliminated by the rewrite
- `= is` / `= is not` invalid SQL in `arrayBoolean`/`objectBoolean` eq/neq.
- `date` eq interpolates an unquoted Date; `date` neq uses `=` instead of `!=`.
- `genJsonbQuery` mutates the caller-supplied `from` array.
- README documents a `JsonbOperatorQuery` fluent API that does not exist.
- Tautology tests replaced with exact-SQL assertions.

## 2. Scope

### In scope (Phase 1)
- **Scalar data types only:** `string`, `numeric`, `date`, `boolean`.
- **Both dialects:** `legacy` and `jsonpath`.
- **All operators** valid for scalar types (see §6).
- **Full parameterization** of user-controlled inputs (values and field paths).
- **Exact-SQL unit tests** for every operator × dialect, plus injection tests.
- New clean public API; old exports removed.
- README rewritten to match the real API.

### Out of scope (Phase 2 / later)
- Non-scalar types: `object*`, `array*`, `arrayObject*` (the
  `jsonb_to_record`/`jsonb_to_recordset` + FROM-alias machinery). The result
  shape reserves a `from: string[]` field for this.
- Real-database tests (pglite / Docker e2e). Phase 1 asserts exact SQL strings
  only. Because there is no DB execution, expected SQL must be written against
  correct PostgreSQL syntax with care.
- Un-holding the package from the changeset `ignore` list. That decision is the
  user's, made after Phase 1 (scalar-only) or Phase 2 is deemed publishable.

## 3. Public API

```ts
export type JsonbDialect = 'legacy' | 'jsonpath';

/** Scalar JSONB data types supported in Phase 1. */
export type JsonbScalarType = 'string' | 'numeric' | 'date' | 'boolean';

/** Value a filter condition can carry. No `any`. */
export type JsonbValue = string | number | boolean | Date;

export type JsonbLogicalOperator = 'and' | 'or';

export type JsonbScalarOperator =
  | 'eq' | 'neq' | 'isnull' | 'isnotnull'
  | 'contains' | 'startswith' | 'endswith'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'range' | 'terms';

export interface JsonbCondition {
  /** Dot path into the JSONB document, e.g. "name" or "address.city". */
  field: string;
  dataType: JsonbScalarType;
  operator: JsonbScalarOperator;
  /** Omitted for isnull/isnotnull; array for terms/range; scalar otherwise. */
  value?: JsonbValue | JsonbValue[];
}

export interface JsonbFilterGroup {
  logic: JsonbLogicalOperator;
  filters: Array<JsonbCondition | JsonbFilterGroup>;
}

export interface JsonbQueryResult {
  /** Parameterized SQL boolean expression, ready to drop into a WHERE clause. */
  where: string;
  /** Values for $1..$N in order. */
  values: unknown[];
  /** FROM fragments. Always empty in Phase 1 (scalar). Reserved for Phase 2. */
  from: string[];
}

export interface BuildJsonbOptions {
  /** Default 'legacy'. */
  dialect?: JsonbDialect;
  /** First placeholder index minus 1. Default 0 → first param is $1. Lets the
   *  fragment be embedded after existing params in a larger query. */
  paramOffset?: number;
}

export function buildJsonbQuery(
  column: string,
  filter: JsonbFilterGroup,
  options?: BuildJsonbOptions,
): JsonbQueryResult;
```

Notes:
- The package defines its **own** `JsonbScalarType` / `JsonbValue` rather than
  importing `@rfjs/data-transform`'s `any`-laden `ValueType`. This also removes
  the cross-package coupling that previously blocked cleaning `any` from
  data-transform.
- Old exports (`toJsonbQuery`, `genJsonbQuery`, `toJsonbQueryList`,
  `JsonbOperatorQuery`, the `jsonb*Operator` maps, `type.ts` operator types) are
  **removed**. No consumers exist in the repo.

## 4. Trust boundary: what is parameterized vs quoted

| Input | Origin | Handling |
|-------|--------|----------|
| condition **value(s)** | end-user | always a `$N` parameter |
| **field** path | end-user | legacy: `text[]` path parameter; jsonpath: embedded in the jsonpath string **as a parameter value**, after jsonpath member-escaping |
| **column** | developer (trusted) | validated + quoted as an identifier; never a parameter (a column reference cannot be a parameter) |

`column` validation/quoting (`quoteJsonbColumn`):
- Accept a simple identifier or a dotted `table.column` (each segment matched by
  `/^[A-Za-z_][A-Za-z0-9_$]*$/`), quoting each segment: `data` → `"data"`,
  `t.payload` → `"t"."payload"`.
- A segment that fails the pattern → throw `Error('Invalid JSONB column: ...')`.
- This rejects injection while supporting the common `alias.column` form. A
  caller needing a complex expression (e.g. a cast) is out of scope; document
  that `column` must be a plain (optionally qualified) column reference.

## 5. Internal architecture

Files are small and single-purpose:

- `param-builder.ts` — `ParamBuilder`: assigns `$N` indices and accumulates
  values. Threaded through the whole build so nested groups share one
  contiguous, correctly-numbered parameter list.
- `column.ts` — `quoteJsonbColumn(column)` (§4).
- `escape.ts` — `escapeJsonpathMember(segment)` and `escapeRegexLiteral(value)`
  (jsonpath member escaping; regex-literal escaping for `like_regex`).
- `dialect.ts` — `ScalarDialect` interface.
- `dialect-legacy.ts` — `legacyDialect: ScalarDialect`.
- `dialect-jsonpath.ts` — `jsonpathDialect: ScalarDialect`.
- `build.ts` — `buildJsonbQuery` + the recursive group composer.
- `types.ts` — the public types from §3.
- `index.ts` — re-exports the public surface.

### ParamBuilder

```ts
class ParamBuilder {
  constructor(offset = 0);
  /** Append a value, return its placeholder text e.g. "$3". */
  add(value: unknown): string;
  /** All values in order. */
  readonly values: unknown[];
}
```

### ScalarDialect interface

```ts
interface ScalarDialect {
  /**
   * Render one condition into a SQL boolean expression, pushing any values
   * onto `params`.
   * @param column already-quoted column SQL (e.g. `"data"`)
   * @param field  the raw dot path (e.g. "address.city")
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
```

### Recursive composer (`build.ts`)

- `buildJsonbQuery` quotes the column, creates a `ParamBuilder(offset)`, selects
  the dialect, calls `buildGroup`, returns `{ where, values, from: [] }`.
- `buildGroup(group, ctx)`:
  - Maps each child: a `JsonbFilterGroup` (has `logic` + `filters`) → recurse and
    wrap in parentheses; a `JsonbCondition` → `dialect.render(...)`.
  - Joins non-empty child expressions with ` and ` / ` or ` per `group.logic`.
  - Empty group (no filters) → `where: ''` (caller treats empty as "no filter").
  - A single child is **not** wrapped in extra parentheses; each `render` output
    is already self-parenthesized, and each nested group is wrapped once.
- The same `ParamBuilder` instance is threaded through all recursion so
  parameter numbers are globally contiguous.

### Validation / error handling
- Unknown `operator` for the given `dataType` → `Error('Unsupported operator
  "<op>" for type "<dataType>"')`.
- `range` requires `value` to be a 2-element array; `terms` requires a non-empty
  array; eq/neq/comparisons require a defined scalar `value`; isnull/isnotnull
  ignore `value`. Violations → a clear `Error`.
- Non-scalar `dataType` (e.g. someone passes `'arrayString'` cast as any) →
  `Error('Unsupported data type ...')`.

## 6. SQL templates per operator × dialect

Below, `col` is the quoted column (e.g. `"data"`), `$f` the field-path
parameter, `$v`/`$lo`/`$hi` value parameters. In **legacy**, field extraction is
uniform: `F = (col #>> $f)` where `$f` is a `text[]` path (e.g. `['address',
'city']`); this handles flat and nested paths identically and parameterizes the
field fully. Casts: string→none, numeric→`::numeric`, date→`::timestamptz`,
boolean→`::boolean`. Let `Fc` be `F` with the type cast applied.

`isnull` / `isnotnull` are **dialect-independent** and always use the legacy
null check (robust across both): `(F is null)` / `(F is not null)`.

### 6a. Legacy dialect

| operator | types | SQL |
|---|---|---|
| eq | all | `(Fc = $v)` (string: `(F = $v)`) |
| neq | all | `(Fc <> $v)` |
| isnull | all | `(F is null)` |
| isnotnull | all | `(F is not null)` |
| gt / gte / lt / lte | numeric, date | `(Fc > $v)` / `>=` / `<` / `<=` |
| range | numeric, date | `(Fc between $lo and $hi)` |
| terms | string, numeric, date | `(Fc = ANY($v::<type>[]))` — `$v` is an array param cast to the matching element-array type (e.g. `::text[]`, `::numeric[]`, `::timestamptz[]`) |
| contains | string | `(position($v in F) > 0)` |
| startswith | string | `(left(F, char_length($v)) = $v)` |
| endswith | string | `(right(F, char_length($v)) = $v)` |

`contains`/`startswith`/`endswith` use `position`/`left`/`right` rather than
`LIKE` so the value is matched **literally** with no LIKE-wildcard escaping
needed.

Example — numeric gt, field `age`, value 18, offset 0:
`where = ((“data” #>> $1)::numeric > $2)`, `values = [['age'], 18]`.

### 6b. jsonpath dialect (PG12+)

Wrapper: `jsonb_path_exists(col, $p::jsonpath, $vars::jsonb)`.
- `$p` = a jsonpath string parameter built as `P ? (<pred>)`, where `P` is the
  member path: `$` then `."seg"` per segment, each segment passed through
  `escapeJsonpathMember`. The field is therefore carried **as a parameter value**
  (no SQL injection); only jsonpath syntax escaping applies.
- `$vars` = a JSONB object parameter providing the comparison values referenced
  as `$v`, `$lo`, `$hi`, `$v0`, `$v1`, … in the predicate.

| operator | types | predicate | vars |
|---|---|---|---|
| eq | string, numeric, boolean | `@ == $v` | `{v}` |
| eq | date | `@.datetime() == $v.datetime()` | `{v}` |
| neq | string, numeric, boolean | `@ != $v` | `{v}` |
| neq | date | `@.datetime() != $v.datetime()` | `{v}` |
| gt/gte/lt/lte | numeric | `@ > $v` … | `{v}` |
| gt/gte/lt/lte | date | `@.datetime() > $v.datetime()` … | `{v}` |
| range | numeric | `@ >= $lo && @ <= $hi` | `{lo, hi}` |
| range | date | `@.datetime() >= $lo.datetime() && @.datetime() <= $hi.datetime()` | `{lo, hi}` |
| terms | string, numeric, date | `@ == $v0 || @ == $v1 …` (date: `@.datetime() == $vN.datetime()`) | `{v0, v1, …}` |
| startswith | string | `@ starts with $v` | `{v}` |
| contains | string | `@ like_regex "<lit>"` — no vars (2-arg form) | — |
| endswith | string | `@ like_regex "<lit>$"` — no vars (2-arg form) | — |
| isnull / isnotnull | all | (legacy null check, see above) | — |

`like_regex` requires a **string-literal** pattern (a jsonpath variable is not
valid there), so `contains`/`endswith` embed the pattern in the jsonpath string
and use the 2-arg `jsonb_path_exists(col, $p::jsonpath)`. `<lit>` is
`escapeJsonpathString(escapeRegexLiteral(value))` (regex-escape first so the
value matches literally, then jsonpath-string-escape); `endswith` appends the
`$` anchor before the jsonpath-string-escape.

Version note: `.datetime()` requires PostgreSQL 13+. `starts with`, `like_regex`,
`jsonb_path_exists` require PG12+. Documented as the dialect's minimum.

Example — string eq, field `address.city`, value `'Taipei'`, offset 0:
`where = jsonb_path_exists(“data”, $1::jsonpath, $2::jsonb)`,
`values = ['$."address"."city" ? (@ == $v)', { v: 'Taipei' }]`.

### 6c. Parameter value representations (deterministic for exact-SQL tests)

So that tests can assert `values` exactly, the builder pushes these concrete
representations:
- **legacy field path** `$f` → a JS string array (`['address','city']`).
  node-postgres binds it as `text[]`, matching `#>>`.
- **legacy scalar value** `$v` → the raw JS value (`string`/`number`/`boolean`/
  `Date`). `terms` pushes a JS array of raw values for `= ANY($v)`.
- **jsonpath `$p`** → the jsonpath string (e.g. `'$."address"."city" ? (@ == $v)'`).
- **jsonpath `$vars`** → a **plain JS object** (e.g. `{ v: 'Taipei' }`).
  node-postgres JSON-serializes plain objects for the `::jsonb` cast. Tests
  assert the object via `toEqual`.
- **date values** are pushed as-is (`Date` or ISO string); the SQL cast
  (`::timestamptz` legacy, `.datetime()` jsonpath) handles parsing.

## 7. Testing strategy (exact-SQL assertions)

Per the agreed scope, Phase 1 uses **exact-SQL string + values assertions** (no
DB execution). For each dialect:

1. **Per-operator output tests** — every operator × applicable scalar type:
   assert `where` equals the exact expected string and `values` equals the exact
   expected array. Cover flat and nested field paths.
2. **Composition tests** — nested and/or groups produce correctly-parenthesized
   SQL with globally contiguous `$N` numbering; `paramOffset` shifts numbering.
3. **Validation tests** — unsupported operator/type, bad `range`/`terms` arity,
   missing value → clear thrown errors.
4. **Injection tests** — a value like `x'; DROP TABLE t; --` appears only in
   `values` (never in `where`); a field containing `"` is jsonpath-escaped in
   `legacy` it travels in the `text[]` param; a `column` like `data; DROP` →
   throws.
5. **Bug-regression tests** — explicit cases pinning the previously-broken
   behaviour: boolean eq/neq emit valid SQL (no `= is`); date neq uses `<>`;
   building twice does not accumulate/mutate shared state.

Each `it` asserts one behaviour. No tautologies.

## 8. Migration & compatibility
- No repo consumers, so removing the old API breaks nothing internally.
- Input metadata shape changes (`JsonbCondition`/`JsonbFilterGroup` with
  `field/dataType/operator/value`) — close to the old `QueryMetadata` shape, so
  downstream adoption is straightforward.
- README fully rewritten: real `buildJsonbQuery` usage, both dialects, the
  trust-boundary note, and the PG-version requirement for `jsonpath`.
- A changeset bumps `@rfjs/jsonb-query` (minor — new API). The package stays in
  the changeset `ignore` list until the user decides to publish.

## 9. File structure summary

```
packages/jsonb-query/src/
  types.ts              # public types (§3)
  param-builder.ts      # ParamBuilder
  column.ts             # quoteJsonbColumn
  escape.ts             # escapeJsonpathMember, escapeRegexLiteral
  dialect.ts            # ScalarDialect interface
  dialect-legacy.ts     # legacyDialect
  dialect-jsonpath.ts   # jsonpathDialect
  build.ts              # buildJsonbQuery + buildGroup
  index.ts              # public re-exports
  *.spec.ts             # co-located tests per unit
```

Old files (`jsonbOperator.ts`, `jsonbOperatorQuery.ts`, `jsonbFromWhere.ts`,
`genJsonbQuery.ts`, `toJsonbQueryList.ts`, `toQuery.ts`, `type.ts`) and their
specs are deleted.
