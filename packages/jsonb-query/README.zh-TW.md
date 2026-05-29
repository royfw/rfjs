# @rfjs/jsonb-query

PostgreSQL JSONB SQL 查詢建構器，用於產生查詢 JSONB 欄位的 `FROM` 與 `WHERE` 子句。

## 安裝

```bash
npm install @rfjs/jsonb-query
```

## 使用方式

### `toJsonbQuery(jsonb, field, operator, dataType, value)`

為單一 JSONB 欄位條件產生 SQL 查詢片段。

```typescript
import { toJsonbQuery } from '@rfjs/jsonb-query';

const query = toJsonbQuery(
  'data::jsonb',    // jsonb 運算式
  'settings.theme', // 欄位路徑
  'eq',             // 運算子
  'string',         // 資料型別
  'dark'            // 數值
);
// { from: 'data::jsonb', fromAlias: 'j', where: "(data::jsonb -> 'settings' -> 'theme') = 'dark'" }
```

### `genJsonbQuery(jsonb, filterQuery)`

從巢狀過濾條件樹產生完整的 SQL `WHERE` 與 `FROM` 子句。

```typescript
import { genJsonbQuery } from '@rfjs/jsonb-query';

const filter = {
  logic: 'and',
  filters: [
    {
      field: 'name',
      dataType: 'string',
      operator: 'eq',
      value: 'test',
    },
    {
      logic: 'or',
      filters: [
        { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
        { field: 'active', dataType: 'boolean', operator: 'eq', value: true },
      ],
    },
  ],
};

const { where, from } = genJsonbQuery('payload::jsonb', filter);
```

### `toJsonbQueryList(jsonb, metadataList)`

將過濾條件列表轉換為 SQL 查詢物件陣列。

### `JsonbOperatorQuery`

以類別方式逐步建立 JSONB SQL 查詢：

```typescript
import { JsonbOperatorQuery } from '@rfjs/jsonb-query';

const query = new JsonbOperatorQuery('payload::jsonb');
query.eq('name', 'test', 'string');
query.and().gte('age', 18, 'numeric');
// query.getWhere(), query.getFrom()
```

## 運算子

`eq`, `neq`, `isnull`, `isnotnull`, `contains`, `startswith`, `endswith`, `terms`, `gt`, `gte`, `lt`, `lte`, `range`

## 資料型別

所有 `JsonbDataType` 變體：`string`、`numeric`、`date`、`boolean` 及其 `object*` / `array*` / `arrayObject*` 形式。
