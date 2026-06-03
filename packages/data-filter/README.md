# @rfjs/data-filter

In-memory data filtering with JSONPath wildcard support, alias substitution, and filter mapping.

## Installation

```bash
npm install @rfjs/data-filter
```

## Usage

### Filter Matching

#### `matchQuery(data, filterQuery)`

Check if a single data object matches a filter query. Returns `boolean`.

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

Filter an array of objects against multiple filter queries.

```typescript
import { matchQueryArray } from '@rfjs/data-filter';

const results = matchQueryArray(items, [filter]);
```

### Filter Mapping

#### `matchAndMap(data, mappings, extraData, dataKey)`

Filter and map data using alias substitution. Supports dynamic field resolution via `${field.path}` (or `$field.path`) placeholders, resolved against the source data.

```typescript
import { matchAndMap } from '@rfjs/data-filter';

const results = matchAndMap<T>(
  items,
  [{ filter, mappings }],
  extraData,
  'data'
);
```

### Path Resolution

#### `resolvePath(data, path, options)`

Resolve a path in an object with JSONPath wildcard support. Falls back to lodash `_.get` for plain paths.

```typescript
import { resolvePath } from '@rfjs/data-filter';

resolvePath(data, 'users[*].name');  // JSONPath wildcard
resolvePath(data, 'a.b.c');           // plain path
```

### Operators

| Category | Operators |
|----------|-----------|
| Default | `eq`, `neq`, `isnull`, `isnotnull` |
| Text | `contains`, `startswith`, `endswith`, `terms` |
| Numeric | `gt`, `gte`, `lt`, `lte`, `range`, `terms` |
| Date | `gt`, `gte`, `lt`, `lte`, `range`, `terms` |
| Boolean | `eq`, `neq`, `isnull`, `isnotnull` |

**Logic operators**: `and`, `or`, `nor`, `not`

### Match Classes

Under-the-hood match classes for each data type:

- `TextMatch` — text comparison operators
- `NumericMatch` — numeric comparison operators
- `BooleanMatch` — boolean equality operators
- `DateMatch` — date range operators

## Types

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
