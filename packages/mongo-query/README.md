# @rfjs/mongo-query

MongoDB query builder. Generates MongoDB query documents from structured filter metadata.

## Installation

```bash
npm install @rfjs/mongo-query
```

## API

### `toQuery(field, type, condition, value)`

Generate a MongoDB query for a single field condition.

```typescript
import { toQuery } from '@rfjs/mongo-query';

toQuery('name', 'string', 'eq', 'Alice');
// { name: { '$eq': 'Alice' } }

toQuery('age', 'number', 'gte', 18);
// { age: { '$gte': 18 } }

toQuery('tags', 'string', 'terms', ['admin', 'active']);
// { tags: { '$in': ['admin', 'active'] } }
```

Conditions: `'eq' | 'neq' | 'nin' | 'terms' | 'term' | 'gt' | 'gte' | 'lt' | 'lte' | 'range' | 'regex'`

### `genFilterQuery(filterMetadata)`

Build a nested MongoDB query from a filter metadata tree.

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

## Types

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
