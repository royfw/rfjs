# @rfjs/data-filter

In-memory data filtering with computed `=` expression slots, alias substitution, and filter mapping.

## Installation

```bash
npm install @rfjs/data-filter
```

## Usage

### Filter Matching

#### `matchQuery(data, filterQuery)`

Check if a single data object matches a filter query. Returns `boolean`.

```typescript
import { matchQuery } from '@rfjs/data-filter';

const filter = {
  logic: 'and',
  filters: [
    { field: 'name', dataType: 'string', operator: 'eq', value: 'Alice' },
    { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
  ],
};

matchQuery({ name: 'Alice', age: 25 }, filter); // true
```

#### `matchQueryArray(data, filters)`

Filter an array of objects against multiple filter queries.

```typescript
import { matchQueryArray } from '@rfjs/data-filter';

const results = matchQueryArray(items, [filter]);
```

### Filter Mapping

#### `matchAndMap(data, mappings, extraData, dataKey)`

Filter and map data using alias substitution. Supports dynamic field resolution via `${field.path}` (or `$field.path`) placeholders, resolved against the source data.

```typescript
import { matchAndMap } from '@rfjs/data-filter';

const results = matchAndMap<T>(
  items,
  [{ filter, mappings }],
  extraData,
  'data'
);
```

### Path Resolution

#### `resolvePath(data, path, options)`

Resolve a plain dot/bracket path (lodash `_.get`). Wildcard/jsonpath forms
(`users[*].name`, `$..x`, `[?(...)]`, slices, unions, `$.` roots) are **not
supported and throw** — use `dataType: 'array'` / `elemmatch`, or an `=`
expression instead.

```typescript
import { resolvePath } from '@rfjs/data-filter';

resolvePath(data, 'a.b.c');
resolvePath(data, 'users[0].name');
resolvePath(data, 'user.missing', { fallbackOnEmpty: false }); // null instead of undefined
```

### Operators

| Category | Operators |
|----------|-----------|
| Default | `eq`, `neq`, `isnull`, `isnotnull` |
| Text | `contains`, `startswith`, `endswith`, `terms` |
| Numeric | `gt`, `gte`, `lt`, `lte`, `range`, `terms` |
| Date | `gt`, `gte`, `lt`, `lte`, `range`, `terms` |
| Boolean | `eq`, `neq`, `isnull`, `isnotnull` |

**Logic operators**: `and`, `or`, `nor`, `not`

### Match Classes

Under-the-hood match classes for each data type:

- `TextMatch` — text comparison operators
- `NumericMatch` — numeric comparison operators
- `BooleanMatch` — boolean equality operators
- `DateMatch` — date range operators

### Collection dataTypes — object / array / elemmatch

```typescript
// object: whole-value match
matchQuery(data, wrap({ field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } }));

// array of scalars: element ops are ∃ ("some element matches"); containsall is ∀-membership
matchQuery(data, wrap({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'contains', value: 'x' }));
matchQuery(data, wrap({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a', 'b'] }));

// arrays of objects: elemmatch — the SAME element must satisfy all sub-conditions
matchQuery(data, wrap({
  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
  filters: { logic: 'and', filters: [
    { field: 'sku', dataType: 'string', operator: 'eq', value: 'A' },
    { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
  ] },
}));
```

`array` `neq` is excluded (use `not` + `eq` for "does not contain"). Wildcard/jsonpath
`field` forms (`users[*].x`) are **not supported and throw** — compose with
`elemmatch`/`array`, or use an `=` expression instead.

#### When to use collection dataTypes

| Need | Use |
|------|-----|
| Concise "some element/row loosely matches" | `dataType:'array'` (∃ over elements), or an `=` expression |
| Explicit, unambiguous array membership | `dataType:'array'` |
| Whole-object match / containment | `dataType:'object'` |
| "Same element satisfies multiple conditions" | `elemmatch` |
| Nested collections (some user's tags contain x) | `elemmatch` + `array` composed |

### Computed `=` expression slots (async)

A condition `field`/`value` — or a `matchAndMap` mapping `value` — that starts
with `=` is a computed [JSONata](https://jsonata.org) expression, powered by
[`@rfjs/data-expr`](../data-expr) (safe: no `eval`; DoS guards on by default).
Expressions require the **async** APIs; the sync APIs throw on `=`-slots.

```typescript
import { compileMatchQuery, matchQueryAsync, matchAndMapAsync } from '@rfjs/data-filter';

// compile once, run per row
const matches = compileMatchQuery({
  logic: 'and',
  filters: [{ field: '=$sum(items.amount)', dataType: 'numeric', operator: 'gt', value: 1000 }],
});
await matches(order);

// count-where on the value side
await matchQueryAsync(order, {
  logic: 'and',
  filters: [{ field: 'paidTarget', dataType: 'numeric', operator: 'eq', value: "=$count(items[status='paid'])" }],
});

// computed mapping values (replaces per-op mapping types like "times")
await matchAndMapAsync(rows, [{
  filter,
  mappings: [{ key: 'bonus', type: 'value', value: '=500 * data.qty' }],
}]);
```

Notes: inside an `=` expression use JSONata paths (not `${}` aliases); an
`undefined` result is a no-match (pass `onUndefined`/`strict` via the options
to observe or throw); `=` inside `elemmatch` sub-filters is not supported; a
literal value that must start with `=` can be written as `"='=foo'"`. See the
`@rfjs/data-expr` README for the JSONPath → JSONata mapping table.

## Types

```typescript
type FilterMatchQuery = {
  logic: 'and' | 'or' | 'nor' | 'not';
  filters: (MatchQueryMetadata | FilterMatchQuery)[];
};

type MatchQueryMetadata = {
  field: string;
  dataType: 'string' | 'numeric' | 'boolean' | 'date';
  operator: DefaultFilterOperator | TextFilterOperator | NumericFilterOperator | DateFilterOperator;
  value: ValueType;
};
```
