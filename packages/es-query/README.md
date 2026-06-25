# @rfjs/es-query

> [English](./README.md) · [繁體中文](./README.zh-TW.md)

Compile a framework-agnostic **filter-tree** into an Elasticsearch / OpenSearch
**Query DSL `bool` query**. Pure functions, no client, no network — the Elasticsearch
sibling of [`@rfjs/mongo-query`](../mongo-query) and [`@rfjs/jsonb-query`](../jsonb-query).

Targets **modern Elasticsearch (8.x / 9.x)** and **OpenSearch (2.x / 3.x)**. A `dialect`
flag gates the few clauses that differ between the two.

## Install

```bash
pnpm add @rfjs/es-query
```

## The filter-tree shape

A tree is a `logic` group (`and` / `or` / `not` / `nor`) whose `filters` are either field
conditions or nested groups:

```ts
import { buildEsQuery, type EsFilterMetadata } from '@rfjs/es-query';

const tree: EsFilterMetadata = {
  logic: 'and',
  filters: [
    { field: 'status', condition: 'eq', value: 'open' },
    {
      logic: 'or',
      filters: [
        { field: 'age', condition: 'gt', dataType: 'number', value: 18 },
        { field: 'vip', condition: 'eq', dataType: 'boolean', value: true },
      ],
    },
  ],
};

buildEsQuery(tree);
// {
//   bool: {
//     must: [
//       { term: { status: 'open' } },
//       { bool: {
//           should: [{ range: { age: { gt: 18 } } }, { term: { vip: true } }],
//           minimum_should_match: 1,
//       } },
//     ],
//   },
// }
```

## `buildEsQuery` vs `buildSearchBody`

- `buildEsQuery(tree, opts?)` → just the `bool` query object (compose it yourself).
- `buildSearchBody(tree, opts?)` → a full search body (minus `index`): wraps the query and
  adds `sort` / `size` / `from` / `search_after`.

```ts
import { buildSearchBody } from '@rfjs/es-query';

buildSearchBody(tree, {
  sort: [{ field: 'createdAt', order: 'desc' }],
  size: 20,
  searchAfter: ['2020-01-01', 'id-1'],
});
// { query: { bool: { … } },
//   sort: [{ createdAt: { order: 'desc' } }],
//   size: 20,
//   search_after: ['2020-01-01', 'id-1'] }
```

## Group logic → `bool`

| group | meaning | bool clause |
|---|---|---|
| `and` | all match | `must: [...]` |
| `or`  | any match | `should: [...]` (+ `minimum_should_match: 1`) |
| `not` | not all — `¬(a ∧ b)` | `must_not: [{ bool: { must: [...] } }]` |
| `nor` | none match — `¬(a ∨ b)` | `must_not: [...]` |

`not` and `nor` differ once a group has two or more children (for a single child both reduce to `must_not: [child]`) — matching `@rfjs/jsonb-query` / `@rfjs/sql-filter` (`not (a and b)` vs `not (a or b)`).

## Operators → clauses

The `condition` maps directly to an Elasticsearch clause. For `eq` / `neq`, set
`fieldType: 'text'` to emit `match` instead of `term`. Values are coerced with
[`@rfjs/data-transform`](../data-transform) via the optional `dataType`.

| operator | clause |
|---|---|
| `eq` / `neq` | `term` (keyword) or `match` (text); `neq` wrapped in `must_not` |
| `in` / `notIn` | `terms` |
| `lt` / `lte` / `gt` / `gte` / `between` | `range` |
| `contains` / `startsWith` / `endsWith` | `wildcard` / `prefix` |
| `exists` / `isNull` | `exists` (`isNull` wrapped in `must_not`) |
| `match` / `matchPhrase` / `multiMatch` | `match` / `match_phrase` / `multi_match` |
| `combinedFields` | `combined_fields` *(Elasticsearch only)* |
| `fuzzy` | `fuzzy` |
| `regex` | `regexp` |

`multiMatch` / `combinedFields` read the `fields` array on the condition.

## Dialect

```ts
buildEsQuery(tree, { dialect: 'opensearch' });
```

The shared `bool` / `term` / `terms` / `range` / `match` / `wildcard` / `fuzzy` / `exists`
DSL is identical across both targets. Clauses that diverge are gated: e.g.
`combined_fields` is Elasticsearch-only, so compiling it with `dialect: 'opensearch'`
throws an `UnsupportedClauseError`.

## License

ISC
