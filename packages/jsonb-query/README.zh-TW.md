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
- `jsonpath` — 使用 `jsonb_path_exists` 搭配 SQL/JSON 路徑，需要 PostgreSQL 12+（`date` 比較使用 `.datetime()`，需要 PostgreSQL 13+）。

兩種方言接受相同的過濾條件格式。

### 嵌入較大的查詢

當片段跟隨現有參數之後時，請使用 `paramOffset`：

```typescript
const { where, values } = buildJsonbQuery('data', filter, { paramOffset: 1 });
await client.query(`SELECT * FROM t WHERE org_id = $1 AND ${where}`, [orgId, ...values]);
```

## 安全性

條件的**值**與**欄位路徑**一律透過參數化處理，永遠不會插值到 SQL 中。**column** 引數是由開發者提供的識別符：系統會對其進行驗證並加上引號（`data`、`t.payload`），任何不符合純（選擇性限定）欄位參考的輸入都會被拒絕。

## 支援的型別與運算子

| dataType | operators |
|----------|-----------|
| `string` | `eq` `neq` `isnull` `isnotnull` `contains` `startswith` `endswith` `terms` |
| `numeric` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms` |
| `date` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms` |
| `boolean` | `eq` `neq` `isnull` `isnotnull` |

`range` 接受 2 個元素的 `[lo, hi]` 陣列；`terms` 接受非空陣列。

> 巢狀物件、JSON 陣列及物件陣列的支援規劃於後續版本推出。
