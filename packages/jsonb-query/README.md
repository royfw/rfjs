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
- `jsonpath` — `jsonb_path_exists` with SQL/JSON path. Requires PostgreSQL 12+.
  `date` conditions render `jsonb_path_exists_tz` with `.datetime()` and
  require PostgreSQL 13+.

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

> **API stability:** the exact SQL text this builder emits (casts, parentheses,
> alias names, jsonpath variable names) is an implementation detail and may
> change between minor versions — only the query **semantics** and the
> **parameterization contract** are stable. Don't snapshot-assert the generated
> strings in consumer tests; assert query results instead.

## Supported types & operators

| dataType                          | operators                                                                  |
| --------------------------------- | -------------------------------------------------------------------------- |
| `string`                          | `eq` `neq` `isnull` `isnotnull` `contains` `startswith` `endswith` `terms` |
| `numeric`                         | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms`      |
| `date`                            | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms`      |
| `boolean`                         | `eq` `neq` `isnull` `isnotnull`                                            |
| `object`                          | `eq` `neq` `contains` `isnull` `isnotnull`                                 |
| `array` + scalar `elementType`    | element ops (see below) + `containsall` + `isnull` `isnotnull`             |
| `array` + `elementType: 'object'` | `elemmatch`                                                                |

`range` takes a 2-element `[lo, hi]` value; `terms` takes a non-empty array.

### Nested objects

Dot paths reach nested scalars (`profile.vip`). `dataType: 'object'` compares the
object value itself — `eq`/`neq` are structural jsonb equality, `contains` is
jsonb containment (`@>`):

```typescript
{ field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } }
// legacy & jsonpath: (("data" #> $1) @> $2::jsonb)   values: [['profile'], '{"vip":true}']
```

Object conditions render the same SQL in both dialects (SQL/JSON path predicates
cannot compare non-scalar values), and `@>` is GIN-indexable.

### JSON arrays (scalar elements)

Declare `dataType: 'array'` with the element type in `elementType`. Scalar
operators match with **"some element matches"** (∃) semantics; `isnull`/
`isnotnull` test the array field itself; `containsall` (string/numeric elements)
requires every listed value to be present. `neq` is not allowed on elements
(exists-vs-forall ambiguity).

```typescript
{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }
// legacy:   (exists (select 1 from jsonb_array_elements_text(...) as e1(v) where (e1.v = $2)))
// jsonpath: $."tags"[*] ? (@ == $v)

{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a', 'b'] }
// both: (("data" #> $1) @> $2::jsonb)
```

Element operators: string → `eq contains startswith endswith terms`;
numeric → `eq gt gte lt lte range terms`; date → `eq gt gte lt lte range terms`;
boolean → `eq`.

### Arrays of objects (`elemmatch`)

All sub-conditions must hold on the **same element**. Sub-`field`s are relative
to the element; nested `and`/`or` groups and nested `elemmatch` are supported.
Object-valued and scalar-array conditions inside `elemmatch` are not supported
yet (rejected in both dialects).

```typescript
{
  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
  filters: {
    logic: 'and',
    filters: [
      { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
      { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
    ],
  },
}
// legacy:   (exists (select 1 from jsonb_array_elements(...) as e1
//             where ((e1.value #>> $2) = $3) and ((e1.value #>> $4)::numeric > $5)))
// jsonpath: $."items"[*] ? (@."sku" == $v0 && @."qty" > $v1)
```

### Group logic (`and` / `or` / `nor` / `not`)

Group `logic` is aligned with `@rfjs/data-filter`'s `LogicalOperator`:

| logic | matches when | SQL |
|-------|--------------|-----|
| `and` | all children match | `A and B` |
| `or` | any child matches | `A or B` |
| `not` | NOT(all children match) | `not (A and B)` |
| `nor` | NOT(any child matches) | `not (A or B)` |

`not` with a single array condition expresses **"array does not contain"**
(∀ semantics), consistently in both dialects:

```typescript
{
  logic: 'not',
  filters: [
    { field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' },
  ],
}
// legacy:   not ((exists (select 1 from jsonb_array_elements_text(...) where (e1.v = $2))))
// jsonpath: not (jsonb_path_exists("data", $1::jsonpath, $2::jsonb))
// A missing field or non-array value counts as "does not contain" in both dialects.
```

> **SQL three-valued logic caveat:** negating a **scalar** condition on a
> *missing* field yields SQL `NULL`, so the row does **not** match — unlike
> `@rfjs/data-filter`, which evaluates the same `not` in memory and matches.
> When "missing field" should match, add an explicit `isnull` condition:
> `{ logic: 'or', filters: [{ logic: 'not', ... }, { field, dataType, operator: 'isnull' }] }`.
> Array conditions are not affected (the empty-array guard keeps both dialects
> consistent).

### Semantics notes

- Array element values destined for `::jsonb` parameters are `JSON.stringify`-ed
  by the builder; pass plain JS values as usual.
- When the stored value is **not** an array: the legacy dialect treats it as an
  empty array (no match); the jsonpath dialect (lax mode) auto-wraps a scalar as
  a one-element array. Keep stored shapes consistent to avoid the divergence.
- `containsall` on `date` elements is rejected: jsonb containment would compare
  ISO text, not datetimes.
- **jsonpath `date` format caveat:** PG's `.datetime()` does not recognize the
  trailing `Z` that JS `Date#toISOString()` emits. Query-side values are
  normalized by the builder (`Z` → `+00:00`, `Date` instances serialized with
  an offset), but **stored** `"…Z"` strings fail to parse and lax mode silently
  treats them as non-matching. Store offset formats (`+00:00`) — or use the
  legacy dialect, whose `::timestamptz` cast accepts every common format.
