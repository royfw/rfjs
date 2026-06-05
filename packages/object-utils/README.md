# @rfjs/object-utils

Object manipulation utilities for TypeScript/JavaScript projects.

## Installation

```bash
npm install @rfjs/object-utils
```

## Usage

### `flatten(nestedObj, prefix?)`

Convert a nested object to a flat object with dot-notation keys.

```typescript
import { flatten } from '@rfjs/object-utils';

const result = flatten({
  a: 1,
  b: { c: 10, d: 9 },
});
// { a: 1, 'b.c': 10, 'b.d': 9 }
```

### `keysToNested(keys, value, target, depth)`

Convert an array of strings into a nested object structure.

```typescript
import { keysToNested } from '@rfjs/object-utils';

const result = keysToNested(['a', 'b'], 10);
// { a: { b: 10 } }
```

### `toJSONString(obj, pretty)`

Convert an object to a JSON string. Optionally format with indentation.

```typescript
import { toJSONString } from '@rfjs/object-utils';

toJSONString({ a: 1 });        // '{"a":1}'
toJSONString({ a: 1 }, true);  // '{\n  "a": 1\n}'
```

### `toFlatString(obj)`

Convert a nested object to a flat, human-readable string with dot-notation keys.

```typescript
import { toFlatString } from '@rfjs/object-utils';

toFlatString({ a: { b: 10 }, c: 'abc' });
// 'a.b: 10, c: abc'
```
