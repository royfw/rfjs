# @rfjs/jsonb-query — Operator expansion (key-existence, case-insensitive text, array emptiness, GIN docs)

**Date:** 2026-06-13
**Branch:** `feat/jsonb-query-operators`
**Status:** approved (brainstorming)
**Builds on:** Phase 2 (`JsonbQueryError`, elemmatch nesting, array `neq`, empty-group identity — merged to main via #142)

## Context

`@rfjs/jsonb-query` renders filter metadata to a parameterized PostgreSQL `WHERE`
expression across two dialects (`legacy` `#>>`, `jsonpath` `jsonb_path_exists`).
This round adds three operator families plus indexing docs. Parity with
`@rfjs/data-filter`'s operator set is **explicitly not a goal** — the two
packages serve different surfaces (in-memory filtering vs SQL generation).

All additions follow the established pattern: extend the operator union + the
runtime operator set, render in both dialects, co-locate tests, update README.
**No new error codes** are introduced (existing value guards / codes are reused).

## Scope

- **K — key-existence:** `haskey` / `hasanykey` / `hasallkeys` on `object`
  conditions, rendered dialect-independently with jsonb `?` / `?|` / `?&`.
- **I — case-insensitive text:** `icontains` / `istartswith` / `iendswith` /
  `ieq` / `ineq` on `string` conditions.
- **S — array emptiness:** `isempty` / `isnotempty` on scalar-element `array`
  conditions, rendered dialect-independently.
- **D — GIN index guide:** a README section mapping operators to index types.

Out of scope: `isempty`/`isnotempty` on arrays of objects (needs a type change —
deferred); projection/SELECT builder; ORDER BY (separate spec).

---

## K — Key-existence operators

### Semantics

`haskey` tests whether a jsonb **object** contains a key (or a jsonb **array**
contains a string element), regardless of the value at that key. This differs
from `isnotnull`, which tests the *value*: a key present with a JSON `null`
value (`{"vip": null}`) is `haskey: true` but `isnotnull: false`.

### Type changes (`src/types.ts`)

```ts
export type JsonbObjectOperator =
  | 'eq' | 'neq' | 'contains' | 'isnull' | 'isnotnull'
  | 'haskey' | 'hasanykey' | 'hasallkeys';
```

`JsonbObjectCondition.value` widens to carry key arguments:

```ts
export interface JsonbObjectCondition {
  field: string;
  dataType: 'object';
  operator: JsonbObjectOperator;
  value?: JsonbObjectValue | string | string[];
  elementType?: never;
  filters?: never;
}
```

> **Type-design tradeoff:** a discriminated variant per operator would be more
> precise, but the package already uses loose value typing on conditions
> (`JsonbScalarCondition.value?: JsonbValue | JsonbValue[]`) with runtime guards.
> We follow that convention: widen the union, enforce per-operator at runtime.

### Validation (`src/dialect/base.ts`)

- Add the three operators to `OBJECT_OPERATORS`.
- `haskey` requires a single **string** → new guard `assertKeyValue` (reuses
  `INVALID_SCALAR_VALUE` with message `Operator "haskey" requires a single
  string key`).
- `hasanykey` / `hasallkeys` require a **non-empty string[]** → reuse
  `assertArrayValue` (non-empty) plus a string-element check (reuses
  `INVALID_ARRAY_VALUE`, message `Operator "<op>" requires a non-empty array of
  string keys`).

### Rendering (`src/object-condition.ts`, both dialects)

Object conditions already render identically in both dialects via
`renderObjectCondition`. Key-existence joins them:

```ts
{ field: 'profile', dataType: 'object', operator: 'haskey', value: 'vip' }
// (("data" #> $1) ? $2)                values: [['profile'], 'vip']

{ field: 'profile', dataType: 'object', operator: 'hasanykey', value: ['vip','premium'] }
// (("data" #> $1) ?| $2::text[])       values: [['profile'], ['vip','premium']]

{ field: 'profile', dataType: 'object', operator: 'hasallkeys', value: ['vip','level'] }
// (("data" #> $1) ?& $2::text[])       values: [['profile'], ['vip','level']]
```

Keys are parameterized (never interpolated). `?` / `?|` / `?&` are served by the
default `jsonb_ops` GIN index.

> **node-postgres note:** `?` is the placeholder character in some drivers, but
> node-postgres uses `$N` exclusively, so a literal `?` in SQL is safe. The
> README will warn that query layers using `?` placeholders (e.g. some Knex
> configs) must use the named variant or escape — same caveat that already
> applies to any literal `?`.

---

## I — Case-insensitive text operators

### Type changes (`src/types.ts`)

```ts
export type JsonbScalarOperator =
  | 'eq' | 'neq' | 'isnull' | 'isnotnull'
  | 'contains' | 'startswith' | 'endswith'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'range' | 'terms'
  | 'icontains' | 'istartswith' | 'iendswith' | 'ieq' | 'ineq';
```

Only valid for `string` — added to `OPERATORS_BY_TYPE.string` only (the type
union is shared across scalar types, gated at runtime, exactly as `contains`
already is).

### Rendering — legacy (`src/dialect/legacy.ts` `renderScalarOp`)

Both sides lowered with `lower()`; literal matching (no `LIKE`, so value
metacharacters like `%`/`_` are never interpreted):

```ts
case 'ieq':        return `(lower(${F}) = lower(${v}))`;
case 'ineq':       return `(lower(${F}) <> lower(${v}))`;
case 'icontains':  return `(position(lower(${v}) in lower(${F})) > 0)`;
case 'istartswith':return `(left(lower(${F}), char_length(${v})) = lower(${v}))`;
case 'iendswith':  return `(right(lower(${F}), char_length(${v})) = lower(${v}))`;
```

(`v = params.add(assertScalarValue(operator, value))`, added once per op.)

### Rendering — jsonpath (`src/dialect/jsonpath.ts` `scalarPredicate`)

`like_regex` with `flag "i"` (PG 12+, which jsonpath already requires). The value
is regex-escaped (`escapeRegexLiteral`) then jsonpath-string-escaped
(`escapeJsonpathString`), exactly as `contains`/`endswith` do today:

```ts
case 'icontains':   return { pred: `${acc} like_regex "${lit}" flag "i"`, compound: false };
case 'istartswith': return { pred: `${acc} like_regex "^${lit}" flag "i"`, compound: false };
case 'iendswith':   return { pred: `${acc} like_regex "${lit}$" flag "i"`, compound: false };
case 'ieq':         return { pred: `${acc} like_regex "^${lit}$" flag "i"`, compound: false };
case 'ineq':        return { pred: `!(${acc} like_regex "^${lit}$" flag "i")`, compound: true };
```

These are string predicates: they operate on the text accessor (`acc`), never
`.datetime()`.

> **Divergence note (documented):** `lower()` (legacy) is locale/`LC_CTYPE`
> dependent; jsonpath `flag "i"` uses its own Unicode case-folding. For ASCII
> text they agree; for some non-ASCII characters they may differ. README will
> note this alongside the existing dialect-divergence caveats.

---

## S — Array emptiness operators

### Type changes (`src/types.ts`)

```ts
export type JsonbArrayOperator = JsonbScalarOperator | 'containsall' | 'isempty' | 'isnotempty';
```

Added to all four element sets in `ARRAY_OPERATORS_BY_ELEMENT`. They take **no
value** (like `isnull`/`isnotnull`).

### Rendering (dialect-independent, like `containsall`)

A shared helper (`renderArrayEmptiness` in `src/dialect/base.ts`), called from
both dialects' `renderArray` before the element-predicate path (next to the
existing `isnull`/`isnotnull` and `containsall` short-circuits):

```ts
// isempty
(jsonb_typeof("data" #> $1) = 'array' and jsonb_array_length("data" #> $1) = 0)
// isnotempty
(jsonb_typeof("data" #> $1) = 'array' and jsonb_array_length("data" #> $1) > 0)
```

A missing field or non-array value has `jsonb_typeof <> 'array'` → both operators
are **false** (it is neither an empty array nor a non-empty array). The field
path is parameterized once and reused.

---

## D — GIN index guide (README)

A new "## Indexing" section, concise and practical:

| Operator(s) | Index that helps |
|---|---|
| `object` `contains` / `containsall` (`@>`), `haskey`/`hasanykey`/`hasallkeys` (`?`/`?|`/`?&`) | default `GIN (col jsonb_ops)` |
| `jsonpath` dialect predicates (`@?` / `@@`) | `GIN (col jsonb_path_ops)` |
| `legacy` scalar comparisons (`(col #>> '{path}')::type`) | b-tree **expression** index per path |
| `eq`/`terms` on a hot scalar path | expression index, e.g. `CREATE INDEX ON t ((data #>> '{status}'))` |

Note that `icontains`/`istartswith`/`iendswith` (and `contains` family) are
**not** index-served (they scan); recommend `pg_trgm` GIN for heavy substring
search. Note the hybrid-fallback elemmatch fragment loses `jsonb_path_ops` GIN
(already documented in Phase 2).

---

## Testing

- **Unit (co-located `*.spec.ts`):**
  - `object-condition.spec.ts` — `haskey`/`hasanykey`/`hasallkeys` SQL + params;
    value guards (haskey non-string → `INVALID_SCALAR_VALUE`; hasany/hasall
    empty or non-string-element → `INVALID_ARRAY_VALUE`).
  - `legacy.spec.ts` — the five `i*` operators render with `lower()`; `isempty`/
    `isnotempty` render the typeof+length guard.
  - `jsonpath.spec.ts` — the five `i*` operators render `like_regex … flag "i"`
    (escaped); `ineq` negates; `isempty`/`isnotempty` render the same SQL as
    legacy (dialect-independent).
  - `base.spec.ts` — operator-set membership: `i*` valid only for `string`;
    `isempty`/`isnotempty` valid for every element type; `haskey` family valid
    for `object`; invalid combinations still throw the right codes.
  - `build.spec.ts` — end-to-end through `buildJsonbQuery` for one operator of
    each family in both dialects, with contiguous params + `paramOffset`.
- **E2E (`test/jsonb-query.e2e.spec.ts`, self-skips):** add result-asserting
  cases — `haskey` distinguishes a JSON-null-valued key from a missing key;
  `icontains` matches case-insensitively; `isempty` vs `isnotempty` on present /
  empty / missing / malformed-shape rows. Assert query *results*, not SQL text.

## Docs & release

- README: operator table rows for the new operators; the new "## Indexing"
  section; case-insensitivity locale caveat; key-existence vs `isnotnull` note.
- Changeset: **minor** (additive operators). Body lists K / I / S under "Added".

## Build sequence (for the implementation plan)

1. K — object key-existence (types, `OBJECT_OPERATORS`, guards, render).
2. I — case-insensitive (types, `OPERATORS_BY_TYPE.string`, legacy + jsonpath render).
3. S — array emptiness (types, operator sets, shared `renderArrayEmptiness`, both dialects).
4. README (operator table, Indexing section, caveats) + changeset.
5. E2E cases.
