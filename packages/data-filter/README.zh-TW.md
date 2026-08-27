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

### 條件詞彙——求值前先驗證

條件的**形狀**完全合法,卻寫了引擎不認得的 `dataType` 或 `operator`,是兩回事。後者引擎
會丟例外——對「編輯時驗證、之後才求值」的消費端來說,那是執行期的 500,而不是存檔當下
的 400:

```typescript
matchQuery(data, { logic: 'and', filters: [
  { field: 'x', dataType: 'wat', operator: 'eq', value: 1 },
]});
// Error: [data-filter] unsupported dataType 'wat'
```

引擎派送時依據的詞彙表已對外開放,消費端可直接拿引擎那份來驗,不必自己抄一份、然後
慢慢走鐘:

```typescript
import { validateCondition, validateMatchQuery, supportedOperators } from '@rfjs/data-filter';

validateCondition({ field: 'x', dataType: 'wat', operator: 'eq', value: 1 });
// { ok: false, issues: [{ code: 'unsupportedDataType',
//                         message: "[data-filter] unsupported dataType 'wat'", path: '' }] }

validateMatchQuery(tree);          // 會走進巢狀群組與 elemmatch 子群組
supportedOperators('array', 'string');  // readonly ['eq', 'contains', …] — 可直接餵給選單
```

| 匯出 | 說明 |
|------|------|
| `validateCondition(condition)` | 單一葉節點:`{ ok: true }` 或 `{ ok: false, issues }`;會下探 `elemmatch` 子群組。 |
| `validateMatchQuery(query)` | 整棵 `FilterMatchQuery`:走訪巢狀群組,並檢查每個群組的 `logic`。每個 issue 都帶 `path`(`filters[1].filters[0]`)。 |
| `supportedOperators(dataType, elementType?)` | 該型別組合下引擎接受的運算子;型別組合本身不可求值時回 `undefined`。 |
| `MATCH_QUERY_DATA_TYPES` | 葉節點可宣告的所有 `dataType`——`string`、`numeric`、`date`、`boolean`、`object`、`array`。 |
| `MATCH_QUERY_ELEMENT_TYPES` | `array` 葉節點可宣告的所有 `elementType`(多一個 `object`)。 |
| `LOGICAL_OPERATORS` | `and`、`or`、`nor`、`not`。 |
| `OPERATORS_BY_DATA_TYPE`、`ARRAY_OPERATORS_BY_ELEMENT`、`STRING_OPERATORS` … | 比對類別丟給 `assertOperator` 的原始允許清單。 |
| `assertOperator(dataType, operator, allowed)` | 比對類別自己用的那個會丟例外的檢查。 |

這些就是比對類別實際拿來斷言的**同一批**陣列,而 `MATCH_QUERY_DATA_TYPES` 是
`createMatchQuery` 派送前把關的那份——所以詞彙表不可能說 OK、引擎卻拒收。清單本身是
以 `MatchQueryMetadata` 定型的 presence map 取 `Object.keys` 而來,union(以及因此
`never` 窮盡的派送 switch)新增一個 dataType 時,沒補進來就編不過。

範圍:**只驗詞彙**。不驗樹的形狀(那是
[`@rfjs/filter-builder`](../filter-builder) 的 `parseFilterGroup`),也不驗 `value`
與運算子的搭配(`range` 需要剛好兩個值,仍是執行期例外)。

> `MatchQueryDataType` **不是**這份清單,它是較窄的純量/元素詞彙
> (`string | numeric | boolean | date`),也就是 `array` 條件的 `elementType` 可用值。
> 葉節點層級的集合叫 `MatchQueryConditionDataType`(= `MatchQueryMetadata['dataType']`)。

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

// 以 dataType 區分的 discriminated union,一個 dataType 一個變體——用錯運算子會編譯失敗。
// `MATCH_QUERY_DATA_TYPES` 就是下面這些判別值的執行期清單。
type MatchQueryMetadata =
  | StringCondition   // dataType: 'string'
  | NumericCondition  // dataType: 'numeric'
  | DateCondition     // dataType: 'date'
  | BooleanCondition  // dataType: 'boolean'
  | ObjectCondition   // dataType: 'object'
  | StringArrayCondition | NumericArrayCondition | DateArrayCondition | BooleanArrayCondition
  | ElemMatchCondition;  // dataType: 'array', elementType: 'object'

// 純量/元素詞彙——即 `array` 條件的 `elementType`。
// 這不是葉節點層級的 dataType 集合,那個叫 `MatchQueryConditionDataType`。
type MatchQueryDataType = 'string' | 'numeric' | 'boolean' | 'date';
```
