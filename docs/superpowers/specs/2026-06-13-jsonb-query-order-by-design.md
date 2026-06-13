# @rfjs/jsonb-query — ORDER BY builder

**Date:** 2026-06-13
**Branch:** `feat/jsonb-query-order-by` (separate from `feat/jsonb-query-operators`; its own PR, started after the operator-expansion work merges so it can reuse the shared CAST/named-rewrite refactors)
**Status:** approved (brainstorming)
**Builds on:** Phase 2 + Operator expansion (shares `quoteJsonbColumn`, `ParamBuilder`, the scalar CAST map, and `toNamedParams`)

## Context

`@rfjs/jsonb-query` currently produces only `WHERE` fragments. Real consumers
(admin tables, list endpoints) send **sort** metadata alongside filters and need
a matching `ORDER BY` fragment that reuses the same path-extraction and casting
logic. This spec adds a small, isolated ORDER BY builder.

`ORDER BY` is inherently **dialect-independent**: you always order by an
extracted scalar (`(col #>> '{path}')::type`); the `jsonpath` dialect has no
ordering construct. So there is no `dialect` option.

## Scope

- `buildJsonbOrderBy(column, sorts, options?)` — positional `$N` output.
- `buildNamedJsonbOrderBy(column, sorts, options?)` — `:pN` output for named-
  binding query layers (TypeORM QueryBuilder, Knex).
- Per-column `direction` (default `asc`) and optional `nulls` (`first`/`last`).
- A small shared refactor: extract the scalar CAST map so legacy and order-by
  share one source of truth.

Out of scope: computed/expression sort keys, sorting by array/object values,
sort over `jsonb_path_query` results.

---

## New module `src/order-by.ts`

### Types

```ts
export type JsonbSortDirection = 'asc' | 'desc';
export type JsonbNullsOrder = 'first' | 'last';

export interface JsonbSortSpec {
  field: string;
  /** Only scalar types are orderable. */
  dataType: JsonbScalarType;
  /** Default 'asc'. */
  direction?: JsonbSortDirection;
  /** Omit to use PostgreSQL's default (NULLS LAST for asc, NULLS FIRST for desc). */
  nulls?: JsonbNullsOrder;
}

export interface JsonbOrderByResult {
  orderBy: string;
  values: unknown[];
}

export interface BuildJsonbOrderByOptions {
  paramOffset?: number;
}
```

### `buildJsonbOrderBy`

```ts
export function buildJsonbOrderBy(
  column: string,
  sorts: JsonbSortSpec[],
  options: BuildJsonbOrderByOptions = {},
): JsonbOrderByResult;
```

- Validates `column` via `quoteJsonbColumn` (reused).
- For each spec, renders:
  `(${quoted} #>> ${params.add(fieldSegments(field))})${SCALAR_CASTS[dataType]} ${direction}${nulls ? ` nulls ${nulls}` : ''}`
- Joins specs with `', '`.
- Empty `sorts` → `{ orderBy: '', values: [] }` (the consumer simply omits
  `ORDER BY` — unlike `WHERE`, an empty `ORDER BY` string needs no sentinel).
- `paramOffset` shifts the first `$N` so the fragment composes after `WHERE`
  values.

Worked example:

```ts
const { where, values } = buildJsonbQuery('data', filter);     // values.length = 2
const ob = buildJsonbOrderBy('data', [
  { field: 'age',  dataType: 'numeric', direction: 'desc', nulls: 'last' },
  { field: 'name', dataType: 'string' },
], { paramOffset: values.length });
// ob.orderBy: '("data" #>> $3)::numeric desc nulls last, ("data" #>> $4) asc'
// ob.values:  [['age'], ['name']]
await client.query(
  `SELECT * FROM t WHERE ${where} ORDER BY ${ob.orderBy}`,
  [...values, ...ob.values],
);
```

### `buildNamedJsonbOrderBy`

```ts
export interface BuildNamedJsonbOrderByOptions extends BuildJsonbOrderByOptions {
  /** Named-parameter prefix (default "p"). */
  prefix?: string;
}
export interface NamedOrderByResult {
  orderBy: string;
  params: Record<string, unknown>;
}
export function buildNamedJsonbOrderBy(
  column: string,
  sorts: JsonbSortSpec[],
  options?: BuildNamedJsonbOrderByOptions,
): NamedOrderByResult;
```

Builds the positional result, then converts via the shared positional→named
rewrite (see refactor). `paramOffset` shifts the parameter *names* (`:p5`, …),
matching `buildNamedJsonbQuery`.

```ts
const { orderBy, params } = buildNamedJsonbOrderBy('data', [
  { field: 'age', dataType: 'numeric', direction: 'desc' },
], { prefix: 'o' });
// orderBy: '("data" #>> :o1)::numeric desc'
// params:  { o1: ['age'] }
qb.addOrderBy(orderBy).setParameters(params);
```

### Validation

TS types constrain `direction`/`dataType`, but untyped callers can pass garbage:

- Unknown `dataType` (not in the scalar CAST map) → throw `JsonbQueryError(..,
  'INVALID_SORT')`.
- `direction` other than `asc`/`desc` (when provided) → `INVALID_SORT`.
- `nulls` other than `first`/`last` (when provided) → `INVALID_SORT`.
- Invalid `column` → `INVALID_COLUMN` (via `quoteJsonbColumn`).

**New error code** added to the union in `src/errors.ts`:

```ts
export type JsonbQueryErrorCode =
  | /* …existing 10… */
  | 'INVALID_SORT';        // sort spec has an invalid dataType / direction / nulls
```

---

## Shared refactor — scalar CAST map

`src/dialect/legacy.ts` currently owns:

```ts
const CASTS: Record<JsonbScalarType, string> = {
  string: '', numeric: '::numeric', date: '::timestamptz', boolean: '::boolean',
};
```

Extract it to `src/dialect/base.ts` as an exported `SCALAR_CASTS`, have
`legacy.ts` import it, and `order-by.ts` import it too — one source of truth for
the extract-and-cast convention. (`ARRAY_CASTS` stays in `legacy.ts`; it is
legacy-only.)

## Shared refactor — positional→named rewrite

`src/named-params.ts` `toNamedParams` currently inlines the `$N`→`:pN` regex
rewrite over a `JsonbQueryResult` (`{ where, values, from }`). Extract the core
into a private helper:

```ts
function positionalToNamed(
  sql: string,
  values: unknown[],
  prefix: string,
): { sql: string; params: Record<string, unknown> };
```

`toNamedParams` keeps its exact public signature/behavior (wraps the helper,
maps `sql`→`where`, keeps the contiguity check). `buildNamedJsonbOrderBy` uses
the same helper (maps `sql`→`orderBy`). No public API change to `toNamedParams`.

---

## Testing

- **Unit `src/order-by.spec.ts`:**
  - single column asc (default direction), each `dataType` cast.
  - `desc` + `nulls first`/`last`; omitted `nulls` emits no `NULLS` clause.
  - multi-column comma join; contiguous `$N`; `paramOffset` shift.
  - empty `sorts` → `{ orderBy: '', values: [] }`.
  - invalid `dataType`/`direction`/`nulls` → `JsonbQueryError` code `INVALID_SORT`;
    invalid column → `INVALID_COLUMN`.
  - `buildNamedJsonbOrderBy`: `:pN` output, params object, custom prefix,
    `paramOffset` shifts names.
- **Regression:** existing `named-params.spec.ts` and `legacy.spec.ts` stay green
  after the two refactors (behavior-preserving).
- **E2E (`test/jsonb-query.e2e.spec.ts`):** one combined
  `WHERE ${where} ORDER BY ${ob.orderBy}` query asserting row order (numeric desc
  with nulls last over the seed); assert the *ordering*, not SQL text.

## Docs & release

- README: new "## Sorting" section with both usage examples, the dialect-
  independence note, and the NULLS-default note.
- Changeset: **minor** (new public functions). Body lists `buildJsonbOrderBy` /
  `buildNamedJsonbOrderBy` under "Added".

## Build sequence (for the implementation plan)

1. Refactor: extract `SCALAR_CASTS` to `base.ts`; extract `positionalToNamed`
   in `named-params.ts` (both behavior-preserving; existing tests stay green).
2. `INVALID_SORT` error code.
3. `order-by.ts` types + `buildJsonbOrderBy` + validation.
4. `buildNamedJsonbOrderBy` via the shared rewrite.
5. Barrel exports + README "## Sorting" + changeset.
6. E2E ordering case.
