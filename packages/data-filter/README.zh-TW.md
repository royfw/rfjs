# @rfjs/data-filter

具備計算型 `=` 運算式槽位的記憶體資料過濾工具，支援別名替換與欄位映射。

## 安裝

```bash
npm install @rfjs/data-filter
```

## 使用方式

### 過濾比對

#### `matchQuery(data, filterQuery)`

檢查單一資料物件是否符合過濾條件。回傳 `boolean`。

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

用多個過濾條件篩選物件陣列。

```typescript
import { matchQueryArray } from '@rfjs/data-filter';

const results = matchQueryArray(items, [filter]);
```

### 過濾與映射

#### `matchAndMap(data, mappings, extraData, dataKey)`

過濾資料同時進行欄位映射。支援 `${field.path}`（或 `$field.path`）格式的動態欄位解析，會對照來源資料解析。

```typescript
import { matchAndMap } from '@rfjs/data-filter';

const results = matchAndMap<T>(
  items,
  [{ filter, mappings }],
  extraData,
  'data'
);
```

### 路徑解析

#### `resolvePath(data, path, options)`

純路徑解析(lodash `_.get`)。wildcard/jsonpath 形式(`users[*].name`、`$..x`、
`[?(...)]`、slice、union、`$.` 根)**不支援、會丟錯**——改用 `dataType: 'array'`／
`elemmatch`,或 `=` 運算式。

```typescript
import { resolvePath } from '@rfjs/data-filter';

resolvePath(data, 'a.b.c');
resolvePath(data, 'users[0].name');
resolvePath(data, 'user.missing', { fallbackOnEmpty: false }); // null instead of undefined
```

### 運算子

| 分類 | 運算子 |
|------|--------|
| 預設 | `eq`, `neq`, `isnull`, `isnotnull` |
| 文字 | `contains`, `startswith`, `endswith`, `terms` |
| 文字(不分大小寫) | `icontains`, `istartswith`, `iendswith`, `ieq`, `ineq` |
| 數值 | `gt`, `gte`, `lt`, `lte`, `range`, `terms` |
| 日期 | `gt`, `gte`, `lt`, `lte`, `range`, `terms` |
| 布林 | `eq`, `neq`, `isnull`, `isnotnull` |

`i*` 文字運算子是對應基礎運算子的不分大小寫版本(比對前兩側都轉小寫),與 SQL、JSONB
引擎所提供的 `contains`／`startswith`／`endswith`／`eq`／`neq` 詞彙一致,讓過濾樹能跨引擎沿用。

**邏輯運算子**：`and`, `or`, `nor`, `not`

### 比對類別

各資料型別底層的比對類別：

- `TextMatch` — 文字比對運算子
- `NumericMatch` — 數值比對運算子
- `BooleanMatch` — 布林比對運算子
- `DateMatch` — 日期範圍運算子

### Collection dataType — object / array / elemmatch

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

#### `array` 成員 vs 子字串——選對運算子

`array` dataType 請依語意選運算子——**`contains` 是子字串,不是成員判定**:

| 運算子 | 意義 | 語意 |
|--------|------|------|
| `eq` | 單一成員 | `∃` 某元素**完全等於**該值 |
| `terms` | 任一成員 | `∃` 某元素完全等於**任一個**值(跨引擎可攜) |
| `containsall` | 全部成員 | **每個**值都有一個完全相等的元素 |
| `contains` | 逐元素子字串(**非**成員) | `∃` 某元素以**子字串**包含該值 |

所以 `contains 'manager'` 會命中 `'skip_manager'` 角色(子字串),而 `terms 'manager'`／
`eq 'manager'` 不會(精確成員)。成員判定請用 `terms`(任一)或 `containsall`(全部);
`contains` 只保留給真正的子字串搜尋。`terms` 是能跨 SQL、JSONB 引擎沿用的成員運算子。

`array` 的 `neq` 已排除(「不含」用 `not` + `eq`)。wildcard/jsonpath `field` 形式
(`users[*].x`)**不支援、會丟錯**——用 `elemmatch`／`array` 組合,或 `=` 運算式。

#### 何時用 collection dataType

| 需求 | 用 |
|------|-----|
| 簡潔的「某元素/列鬆散符合」 | `dataType:'array'`(對元素 ∃),或 `=` 運算式 |
| 明確、無歧義的陣列成員判斷 | `dataType:'array'` |
| 整個物件比對 / 包含 | `dataType:'object'` |
| 「同一元素滿足多條件」 | `elemmatch` |
| 巢狀集合(某 user 的 tags 含 x) | `elemmatch` + `array` 組合 |

### 計算型 `=` 運算式槽位(async)

條件的 `field`／`value`——或 `matchAndMap` 映射的 `value`——以 `=` 開頭即為計算型
[JSONata](https://jsonata.org) 運算式,由 [`@rfjs/data-expr`](../data-expr) 驅動(安全:
無 `eval`;DoS 護欄預設開啟)。運算式必須使用 **async** API;sync API 遇 `=` 槽位會丟錯。

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

說明:`=` 運算式內請用 JSONata 路徑(不用 `${}` 別名);結果為 `undefined` 視為不匹配
(可透過 options 傳入 `onUndefined`／`strict` 來觀察或丟錯);`elemmatch` 子條件內不支援
`=`;字面值若必須以 `=` 開頭,可寫成 `"='=foo'"`。JSONPath → JSONata 對照表見
`@rfjs/data-expr` README。

## 型別

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
