# @rfjs/es-query

> [English](./README.md) · [繁體中文](./README.zh-TW.md)

把與框架無關的 **filter-tree** 編譯成 Elasticsearch / OpenSearch 的
**Query DSL `bool` query**。純函式、無 client、無網路 —— 是
[`@rfjs/mongo-query`](../mongo-query) 與 [`@rfjs/jsonb-query`](../jsonb-query) 的
Elasticsearch 版手足。

支援**現代 Elasticsearch（8.x / 9.x）**與 **OpenSearch（2.x / 3.x）**。以 `dialect`
旗標閘住兩者之間少數有差異的子句。

## 安裝

```bash
pnpm add @rfjs/es-query
```

## filter-tree 結構

一棵樹是一個 `logic` 群組（`and` / `or` / `not` / `nor`），其 `filters` 可以是欄位條件或
巢狀群組：

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

- `buildEsQuery(tree, opts?)` → 只回 `bool` query 物件（自己再組合）。
- `buildSearchBody(tree, opts?)` → 完整 search body（不含 `index`）：把 query 包起來並加上
  `sort` / `size` / `from` / `search_after`。

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

## 群組邏輯 → `bool`

| 群組 | bool 子句 |
|---|---|
| `and` | `must` |
| `or`  | `should`（+ `minimum_should_match: 1`） |
| `not` | `must_not` |
| `nor` | `must_not` |

## 運算子 → 子句

`condition` 直接對映到 Elasticsearch 子句。`eq` / `neq` 設定 `fieldType: 'text'` 會改用
`match` 而非 `term`。值會透過選填的 `dataType` 以
[`@rfjs/data-transform`](../data-transform) 轉換。

| 運算子 | 子句 |
|---|---|
| `eq` / `neq` | `term`（keyword）或 `match`（text）；`neq` 包進 `must_not` |
| `in` / `notIn` | `terms` |
| `lt` / `lte` / `gt` / `gte` / `between` | `range` |
| `contains` / `startsWith` / `endsWith` | `wildcard` / `prefix` |
| `exists` / `isNull` | `exists`（`isNull` 包進 `must_not`） |
| `match` / `matchPhrase` / `multiMatch` | `match` / `match_phrase` / `multi_match` |
| `combinedFields` | `combined_fields`（僅 Elasticsearch） |
| `fuzzy` | `fuzzy` |
| `regex` | `regexp` |

`multiMatch` / `combinedFields` 讀取條件上的 `fields` 陣列。

## Dialect

```ts
buildEsQuery(tree, { dialect: 'opensearch' });
```

共用的 `bool` / `term` / `terms` / `range` / `match` / `wildcard` / `fuzzy` / `exists`
DSL 在兩個目標上完全相同。有差異的子句會被閘控：例如 `combined_fields` 僅
Elasticsearch 支援，因此用 `dialect: 'opensearch'` 編譯它會丟出 `UnsupportedClauseError`。

## 授權

ISC
