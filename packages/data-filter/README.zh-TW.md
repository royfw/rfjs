# @rfjs/data-filter

具備 JSONPath 萬用字元支援的記憶體資料過濾工具，支援別名替換與欄位映射。

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

解析物件中的路徑，支援 JSONPath 萬用字元。一般路徑自動回退至 lodash `_.get`。

```typescript
import { resolvePath } from '@rfjs/data-filter';

resolvePath(data, 'users[*].name');  // JSONPath 萬用字元
resolvePath(data, 'a.b.c');           // 一般路徑
```

### 運算子

| 分類 | 運算子 |
|------|--------|
| 預設 | `eq`, `neq`, `isnull`, `isnotnull` |
| 文字 | `contains`, `startswith`, `endswith`, `terms` |
| 數值 | `gt`, `gte`, `lt`, `lte`, `range`, `terms` |
| 日期 | `gt`, `gte`, `lt`, `lte`, `range`, `terms` |
| 布林 | `eq`, `neq`, `isnull`, `isnotnull` |

**邏輯運算子**：`and`, `or`, `nor`, `not`

### 比對類別

各資料型別底層的比對類別：

- `TextMatch` — 文字比對運算子
- `NumericMatch` — 數值比對運算子
- `BooleanMatch` — 布林比對運算子
- `DateMatch` — 日期範圍運算子

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
