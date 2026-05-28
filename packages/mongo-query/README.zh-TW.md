# @rfjs/mongo-query

MongoDB 查詢建構器，從結構化的過濾條件產生 MongoDB 查詢文件。

## 安裝

```bash
npm install @rfjs/mongo-query
```

## 使用方式

### `toQuery(field, type, condition, value)`

為單一欄位條件產生 MongoDB 查詢。

```typescript
import { toQuery } from '@rfjs/mongo-query';

toQuery('name', 'string', 'eq', 'Alice');
// { name: { '$eq': 'Alice' } }

toQuery('age', 'number', 'gte', 18);
// { age: { '$gte': 18 } }

toQuery('tags', 'string', 'terms', ['admin', 'active']);
// { tags: { '$in': ['admin', 'active'] } }
```

條件：`'eq' | 'neq' | 'nin' | 'terms' | 'term' | 'gt' | 'gte' | 'lt' | 'lte' | 'range' | 'regex'`

### `genFilterQuery(filterMetadata)`

從過濾條件樹建立巢狀 MongoDB 查詢。

```typescript
import { genFilterQuery } from '@rfjs/mongo-query';

const result = genFilterQuery({
  logic: 'and',
  filters: [
    { field: 'name', condition: 'eq', dataType: 'string', value: 'test' },
    {
      logic: 'or',
      filters: [
        { field: 'age', condition: 'gt', dataType: 'number', value: 18 },
        { field: 'address', condition: 'eq', dataType: 'string', value: null },
      ],
    },
  ],
});
// { '$and': [ { name: { '$eq': 'test' } }, { '$or': [ { age: { '$gt': 18 } }, { address: { '$eq': null } } ] } ] }
```

### 查詢類別

內建的查詢類別，用於常見操作：

- `EqQuery`、`NeQuery`、`NinQuery`、`TermsQuery` — 相等與成員比對
- `GTQuery`、`GTEQuery`、`LTQuery`、`LTEQuery`、`RangeQuery` — 範圍比較
- `RegexQuery` — 正規表示式比對
- `LogicalQuery` — `$and`、`$or`、`$nor` 組合

## 型別

```typescript
interface MgoFieldCondition {
  field: string;
  condition: MgoConditionType;
  dataType: MgoDataType;
  value: ValueType;
}

interface MgoFilterMetadata {
  logic: 'and' | 'or' | 'nor';
  filters: Array<MgoFieldCondition | MgoFilterMetadata>;
}
```
