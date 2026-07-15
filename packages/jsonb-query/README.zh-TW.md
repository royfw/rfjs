# @rfjs/jsonb-query

參數化 PostgreSQL JSONB 查詢建構器。將過濾條件樹轉換為安全的參數化 `WHERE` 表達式（node-postgres `$1, $2` 佔位符）。

## 安裝

```bash
npm install @rfjs/jsonb-query
```

## 使用方式

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

### 方言（Dialects）

```typescript
buildJsonbQuery('data', filter, { dialect: 'jsonpath' });
```

- `legacy`（預設）— 使用 `#>>` 提取並加型別轉換，相容所有支援的 PostgreSQL 版本。
- `jsonpath` — 使用 `jsonb_path_exists` 搭配 SQL/JSON 路徑，需要 PostgreSQL 12+。`date` 條件會渲染為 `jsonb_path_exists_tz` 搭配 `.datetime()`，需要 PostgreSQL 13+。

兩種方言接受相同的過濾條件格式。

### 嵌入較大的查詢

當片段跟隨現有參數之後時，請使用 `paramOffset`：

```typescript
const { where, values } = buildJsonbQuery('data', filter, { paramOffset: 1 });
await client.query(`SELECT * FROM t WHERE org_id = $1 AND ${where}`, [orgId, ...values]);
```

### 具名參數（TypeORM QueryBuilder、Knex）

位置型 `$N` 輸出可直接餵給 `pg`、TypeORM raw query、Prisma
（`$queryRawUnsafe`）與 Kysely（`CompiledQuery.raw`）。使用**具名**綁定的
查詢層不接受 `$N`——改用 `buildNamedJsonbQuery`：

```typescript
import { buildNamedJsonbQuery } from '@rfjs/jsonb-query';

const { where, params } = buildNamedJsonbQuery('data', filter);
// where:  '(("data" #>> :p1) = :p2)'
// params: { p1: ['name'], p2: 'bob' }
qb.andWhere(where, params); // TypeORM QueryBuilder / knex.whereRaw(where, params)
```

它接受 `buildJsonbQuery` 的所有選項，外加 `prefix`（預設 `"p"`）；
`paramOffset` 會位移參數**名稱**（`:p5`、…），組合多個片段時可避免 key
撞名。同一佔位符被重複引用時（如 `startswith`）仍指向同一個具名參數——
這是 naive 的位置型 `?` 轉換做不到的。若要轉換既有的位置型結果，可使用
底層的 `toNamedParams(result, prefix?)`。

## 錯誤

每個來自呼叫端輸入的問題都會丟出帶有穩定 `code` 的 `JsonbQueryError`；丟出其他型別代表內部 bug。

```typescript
import { JsonbQueryError } from '@rfjs/jsonb-query';

try {
  buildJsonbQuery('data', filter);
} catch (e) {
  if (e instanceof JsonbQueryError) {
    // e.code: 'INVALID_COLUMN' | 'INVALID_DIALECT' | 'UNSUPPORTED_OPERATOR'
    //       | 'INVALID_ELEMENT_TYPE' | 'INVALID_SCALAR_VALUE' | 'INVALID_ARRAY_VALUE'
    //       | 'INVALID_OBJECT_VALUE' | 'EMPTY_FILTER_GROUP' | 'INVALID_PREFIX'
    //       | 'PARAM_MISMATCH' | 'INVALID_SORT'
  }
}
```

## 索引

| 運算子 | 有幫助的索引 |
| --- | --- |
| 物件 `contains`/`containsall`（`@>`）、`haskey`/`hasanykey`/`hasallkeys`（`?`/`?\|`/`?&`） | 預設 `GIN (col jsonb_ops)` |
| `jsonpath` 方言述詞（`@?` / `@@`） | `GIN (col jsonb_path_ops)` |
| 熱路徑上的 `legacy` 純量比較 | b-tree **expression** 索引，例如 `CREATE INDEX ON t ((data #>> '{status}'))` |

`contains` / `icontains` / `startswith` / `istartswith` / `endswith` /
`iendswith` **不**走索引（全表掃描）；大量子字串搜尋請改用 `pg_trgm` GIN 索引。
jsonpath 的 `elemmatch` SQL-fallback 片段（物件或 `containsall` leaf）不會被
`jsonb_path_ops` GIN 索引服務。

## 排序

`buildJsonbOrderBy` 把排序中繼資料轉成參數化的 `ORDER BY` 片段，重用與 `WHERE`
建構器相同的路徑萃取與型別轉換。它**與方言無關**（排序一律萃取純量，jsonpath
沒有排序構造），所以不接受 `dialect` 選項。用 `paramOffset` 接在 `WHERE` 之後組合：

```typescript
import { buildJsonbQuery, buildJsonbOrderBy } from '@rfjs/jsonb-query';

const { where, values } = buildJsonbQuery('data', filter);
const ob = buildJsonbOrderBy('data', [
  { field: 'age', dataType: 'numeric', direction: 'desc', nulls: 'last' },
  { field: 'name', dataType: 'string' }, // direction 預設 'asc'
], { paramOffset: values.length });
// ob.orderBy: '("data" #>> $3)::numeric desc nulls last, ("data" #>> $4) asc'
await client.query(
  `SELECT * FROM t WHERE ${where} ORDER BY ${ob.orderBy}`,
  [...values, ...ob.values],
);
```

`nulls` 可省略；省略則用 PostgreSQL 預設（`asc` → `NULLS LAST`，`desc` →
`NULLS FIRST`）。空的 `sorts` 會回傳空字串 `orderBy`（直接省略 `ORDER BY`）。
只有純量 `dataType` 可排序；不合法的 `dataType` / `direction` / `nulls` 會丟
`JsonbQueryError`（code `INVALID_SORT`）。

對具名綁定的查詢層（TypeORM QueryBuilder、Knex），用 `buildNamedJsonbOrderBy`
（`:pN` 輸出）—— 即 `buildNamedJsonbQuery` 的 ORDER BY 對應版：

```typescript
const { orderBy, params } = buildNamedJsonbOrderBy('data', [
  { field: 'age', dataType: 'numeric', direction: 'desc' },
], { prefix: 'o' });
// orderBy: '("data" #>> :o1)::numeric desc'   params: { o1: ['age'] }
qb.addOrderBy(orderBy).setParameters(params);
```

## 安全性

條件的**值**與**欄位路徑**一律透過參數化處理，永遠不會插值到 SQL 中。**column** 引數是由開發者提供的識別符：系統會對其進行驗證並加上引號（`data`、`t.payload`），任何不符合純（選擇性限定）欄位參考的輸入都會被拒絕。

> **API 穩定性：**本建構器輸出的 SQL 文字細節（型別轉換、括號、別名、
> jsonpath 變數名稱）屬於實作細節，可能在 minor 版本之間變動——穩定的只有
> 查詢**語意**與**參數化契約**。請勿在使用端測試中對產出的字串做 snapshot
> 斷言；應改為斷言查詢結果。

## 支援的型別與運算子

| dataType                          | operators                                                                  |
| --------------------------------- | -------------------------------------------------------------------------- |
| `string`                          | `eq` `neq` `isnull` `isnotnull` `contains` `startswith` `endswith` `terms` `icontains` `istartswith` `iendswith` `ieq` `ineq` |
| `numeric`                         | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms`      |
| `date`                            | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms`      |
| `boolean`                         | `eq` `neq` `isnull` `isnotnull`                                            |
| `object`                          | `eq` `neq` `contains` `isnull` `isnotnull` `haskey` `hasanykey` `hasallkeys` |
| `array` + 純量 `elementType`      | 元素運算子（見下方，`neq` = 值不存在）+ `containsall` + `isempty` `isnotempty` + `isnull` `isnotnull` |
| `array` + `elementType: 'object'` | `elemmatch`                                                                |

`range` 接受 2 個元素的 `[lo, hi]` 陣列；`terms` 接受非空陣列。

### 巢狀物件

點記號路徑可存取巢狀純量（`profile.vip`）。`dataType: 'object'` 則比較物件值
本身 — `eq`/`neq` 為 jsonb 結構相等比較，`contains` 為 jsonb 包含（`@>`）：

```typescript
{ field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } }
// legacy 與 jsonpath 皆為: (("data" #> $1) @> $2::jsonb)   values: [['profile'], '{"vip":true}']
```

物件條件在兩種方言中產生相同 SQL（SQL/JSON path 述詞無法比較非純量值），
且 `@>` 可使用 GIN 索引。

### 物件鍵存在

`haskey` / `hasanykey` / `hasallkeys` 測試物件**鍵**是否存在（jsonb `?` / `?|`
/ `?&`），不論該鍵的值 —— 與測試「值」的 `isnotnull` 不同（鍵存在但值為 JSON
`null` 時，`haskey: true` 但 `isnotnull: false`）。三者皆可用 GIN 索引。

```typescript
{ field: 'profile', dataType: 'object', operator: 'haskey', value: 'vip' }
//  (("data" #> $1) ? $2)              values: [['profile'], 'vip']
{ field: 'profile', dataType: 'object', operator: 'hasanykey', value: ['vip','premium'] }
//  (("data" #> $1) ?| $2::text[])
{ field: 'profile', dataType: 'object', operator: 'hasallkeys', value: ['vip','level'] }
//  (("data" #> $1) ?& $2::text[])
```

> **`?` 佔位符衝突：**這些運算子會在 SQL 裡輸出字面的 `?` / `?|` / `?&`。
> node-postgres 用 `$N` 佔位符，所以沒問題。把 `?` 當綁定佔位符的查詢層
> （如 Knex `whereRaw`）會誤判 —— 請改用 `buildNamedJsonbQuery`（`:pN` 輸出），
> 或使用 `$N` 的驅動。

### 不分大小寫文字

`icontains` / `istartswith` / `iendswith` / `ieq` / `ineq` 以不分大小寫比對字串。
legacy 方言對兩側做 `lower()`；jsonpath 方言用 `like_regex … flag "i"`。

> 兩種方言在非 ASCII 文字上的大小寫折疊略有差異：`lower()` 依資料庫 `LC_CTYPE`，
> jsonpath `flag "i"` 用自己的 Unicode 規則。ASCII 文字結果相同。

### 陣列是否為空

`isempty` / `isnotempty` 測試純量元素陣列欄位是否有零個 / 至少一個元素
（`jsonb_array_length`）。欄位不存在或非陣列值則**兩者皆非**（兩個運算子都回
false）。兩種方言產生相同 SQL。

### JSON 陣列（純量元素）

宣告 `dataType: 'array'` 並以 `elementType` 指定元素型別。純量運算子採
**「任一元素符合」**（∃）語意；`isnull`/`isnotnull` 檢查陣列欄位本身；
`containsall`（限 string/numeric 元素）要求所有列出的值皆存在。
元素不支援 `neq`（存在 ∃ 與全稱 ∀ 語意混淆）。

```typescript
{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }
// legacy:   (exists (select 1 from jsonb_array_elements_text(...) as e1(v) where (e1.v = $2)))
// jsonpath: $."tags"[*] ? (@ == $v)

{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a', 'b'] }
// 兩種方言皆為: (("data" #> $1) @> $2::jsonb)
```

元素運算子：string → `eq contains startswith endswith terms`；
numeric → `eq gt gte lt lte range terms`；date → `eq gt gte lt lte range terms`；
boolean → `eq`。

### 物件陣列（`elemmatch`）

所有子條件必須在**同一個元素**上成立。子條件的 `field` 為相對於元素的路徑；
支援巢狀 `and`/`or` 群組與巢狀 `elemmatch`。`elemmatch` 內尚不支援物件條件與
純量陣列條件（兩種方言皆會拒絕）。

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

### 群組邏輯（`and` / `or` / `nor` / `not`）

群組的 `logic` 與 `@rfjs/data-filter` 的 `LogicalOperator` 對齊：

| logic | 符合條件 | SQL |
|-------|---------|-----|
| `and` | 所有子條件皆符合 | `A and B` |
| `or` | 任一子條件符合 | `A or B` |
| `not` | NOT（所有子條件皆符合） | `not (A and B)` |
| `nor` | NOT（任一子條件符合） | `not (A or B)` |

`not` 包住單一陣列條件即可表達**「陣列不包含」**（∀ 語意），兩種方言行為一致：

```typescript
{
  logic: 'not',
  filters: [
    { field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' },
  ],
}
// legacy:   not ((exists (select 1 from jsonb_array_elements_text(...) where (e1.v = $2))))
// jsonpath: not (jsonb_path_exists("data", $1::jsonpath, $2::jsonb))
// 欄位缺失或非陣列值在兩種方言都視為「不包含」（符合條件）。
```

> **SQL 三值邏輯注意事項：**對**純量**條件取反時，若欄位**缺失**會得到 SQL
> `NULL`，該 row **不會**符合——這與 `@rfjs/data-filter` 在記憶體中對同一個
> `not` 的求值結果（符合）不同。若「欄位缺失」也應符合，請明確加上 `isnull`
> 條件組合：`{ logic: 'or', filters: [{ logic: 'not', ... }, { field, dataType, operator: 'isnull' }] }`。
> 陣列條件不受影響（空陣列 guard 讓兩種方言行為一致）。

### 語意注意事項

- 進入 `::jsonb` 參數的陣列／物件值會由建構器自動 `JSON.stringify`；照常傳入
  一般 JS 值即可。
- 當儲存的值**不是**陣列時：legacy 方言視為空陣列（不符合）；jsonpath 方言
  （lax 模式）會把純量自動包裝成單元素陣列。請保持資料形狀一致以避免差異。
- `date` 元素不支援 `containsall`：jsonb 包含比較的是 ISO 文字而非時間值。
- **jsonpath `date` 格式注意事項：**PG 的 `.datetime()` 不認得 JS
  `Date#toISOString()` 輸出的 `Z` 後綴。查詢端的值由建構器自動正規化
  （`Z` → `+00:00`、`Date` 實例序列化為帶偏移量的格式），但**儲存端**的
  `"…Z"` 字串會解析失敗，且 lax 模式會默默視為不符合。請以偏移量格式
  （`+00:00`）儲存——或改用 legacy 方言，其 `::timestamptz` 轉型接受所有
  常見格式。
