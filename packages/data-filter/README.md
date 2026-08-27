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
| Text (case-insensitive) | `icontains`, `istartswith`, `iendswith`, `ieq`, `ineq` |
| Numeric | `gt`, `gte`, `lt`, `lte`, `range`, `terms` |
| Date | `gt`, `gte`, `lt`, `lte`, `range`, `terms` |
| Boolean | `eq`, `neq`, `isnull`, `isnotnull` |

The `i*` text operators are the case-insensitive counterparts of their base
operators (both sides are lower-cased before comparison); they match the
`contains`/`startswith`/`endswith`/`eq`/`neq` vocabulary exposed by the SQL and
JSONB engines, so a filter tree stays portable across engines.

**Logic operators**: `and`, `or`, `nor`, `not`

### Condition vocabulary — validate before you evaluate

A condition can be perfectly well-*shaped* and still name a `dataType` or
`operator` the engine has never heard of. The evaluator throws on it, which for
a consumer that validated at authoring time and evaluated later means a 500 at
runtime rather than a 400 at save time:

```typescript
matchQuery(data, { logic: 'and', filters: [
  { field: 'x', dataType: 'wat', operator: 'eq', value: 1 },
]});
// Error: [data-filter] unsupported dataType 'wat'
```

The vocabulary the evaluator dispatches on is exported, so a consumer checks the
condition against the engine's own tables instead of hand-rolling a copy that
drifts:

```typescript
import { validateCondition, validateMatchQuery, supportedOperators } from '@rfjs/data-filter';

validateCondition({ field: 'x', dataType: 'wat', operator: 'eq', value: 1 });
// { ok: false, issues: [{ code: 'unsupportedDataType',
//                         message: "[data-filter] unsupported dataType 'wat'", path: '' }] }

validateMatchQuery(tree);          // walks nested groups and elemmatch sub-groups
supportedOperators('array', 'string');  // readonly ['eq', 'contains', …] — populate a picker
```

| Export | What it is |
|--------|------------|
| `validateCondition(condition)` | One leaf: `{ ok: true }` or `{ ok: false, issues }`. Descends into an `elemmatch` sub-group. |
| `validateMatchQuery(query)` | A whole `FilterMatchQuery`: walks nested groups, also checks each group's `logic`. Every issue carries a `path` (`filters[1].filters[0]`). |
| `supportedOperators(dataType, elementType?)` | The operators the engine accepts there, or `undefined` if the type combination itself is not evaluable. |
| `MATCH_QUERY_DATA_TYPES` | Every `dataType` a leaf may declare — `string`, `numeric`, `date`, `boolean`, `object`, `array`. |
| `MATCH_QUERY_ELEMENT_TYPES` | Every `elementType` an `array` leaf may declare (adds `object`). |
| `LOGICAL_OPERATORS` | `and`, `or`, `nor`, `not`. |
| `OPERATORS_BY_DATA_TYPE`, `ARRAY_OPERATORS_BY_ELEMENT`, `STRING_OPERATORS` … | The raw allowlists the matchers pass to `assertOperator`. |
| `assertOperator(dataType, operator, allowed)` | The throwing check the matchers use. |

These are the *same* arrays the matchers assert against, and
`MATCH_QUERY_DATA_TYPES` is what `createMatchQuery` gates on before it
dispatches — so the exported vocabulary cannot say "yes" to something the
engine then rejects. The lists are `Object.keys` of presence maps typed against
`MatchQueryMetadata`, so a dataType added to the union (and therefore to the
`never`-exhaustive dispatch switch) fails to compile until it is listed.

Scope: **vocabulary only**. It does not check the tree's shape (use
`parseFilterGroup` from [`@rfjs/filter-builder`](../filter-builder)) nor whether
`value` suits the operator (`range` wanting exactly two values is still a
runtime throw).

> `MatchQueryDataType` is **not** this list — it is the narrower scalar/element
> vocabulary (`string | numeric | boolean | date`), which is what an `array`
> condition's `elementType` may be. The leaf-level set is
> `MatchQueryConditionDataType` (= `MatchQueryMetadata['dataType']`).

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

#### `array` membership vs substring — pick the right operator

For an `array` dataType, choose the operator by intent — **`contains` is
substring, not membership**:

| Operator | Meaning | Semantics |
|----------|---------|-----------|
| `eq` | single membership / 單一成員 | `∃` element **exactly equal** to the value |
| `terms` | any-membership / 任一成員 | `∃` element exactly equal to **any** of the values (cross-engine portable) |
| `containsall` | all-membership / 全部成員 | **every** value has an exactly-equal element |
| `contains` | per-element substring / 逐元素子字串 (NOT membership) | `∃` element that **substring-contains** the value |

So `contains 'manager'` matches a `'skip_manager'` role (substring), whereas
`terms 'manager'` / `eq 'manager'` do not (exact membership). Use `terms` (any)
or `containsall` (all) for membership; reserve `contains` for genuine substring
search. `terms` is the membership operator that stays portable across the SQL
and JSONB engines.

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

// A discriminated union, one variant per dataType — an operator invalid for its
// dataType is a compile error. `MATCH_QUERY_DATA_TYPES` is the runtime list of
// the discriminants below.
type MatchQueryMetadata =
  | StringCondition   // dataType: 'string'
  | NumericCondition  // dataType: 'numeric'
  | DateCondition     // dataType: 'date'
  | BooleanCondition  // dataType: 'boolean'
  | ObjectCondition   // dataType: 'object'
  | StringArrayCondition | NumericArrayCondition | DateArrayCondition | BooleanArrayCondition
  | ElemMatchCondition;  // dataType: 'array', elementType: 'object'

// The scalar/element vocabulary — an `array` condition's `elementType`.
// NOT the leaf-level dataType set; that is `MatchQueryConditionDataType`.
type MatchQueryDataType = 'string' | 'numeric' | 'boolean' | 'date';
```
