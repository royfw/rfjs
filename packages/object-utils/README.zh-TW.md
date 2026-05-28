# @rfjs/object-utils

TypeScript / JavaScript 物件操作工具集。

## 安裝

```bash
npm install @rfjs/object-utils
```

## 使用方式

### `flatten(nestedObj, prefix?)`

將巢狀物件轉換為使用點號鍵名的扁平物件。

```typescript
import { flatten } from '@rfjs/object-utils';

const result = flatten({
  a: 1,
  b: { c: 10, d: 9 },
});
// { a: 1, 'b.c': 10, 'b.d': 9 }
```

### `keysToNested(keys, value, target, depth)`

將字串陣列轉換為巢狀物件結構。

```typescript
import { keysToNested } from '@rfjs/object-utils';

const result = keysToNested(['a', 'b'], 10);
// { a: { b: 10 } }
```

### `toJSONString(obj, pretty)`

將物件轉換為 JSON 字串，可選擇格式化輸出。

```typescript
import { toJSONString } from '@rfjs/object-utils';

toJSONString({ a: 1 });        // '{"a":1}'
toJSONString({ a: 1 }, true);  // '{\n  "a": 1\n}'
```

### `toFlatString(obj)`

將巢狀物件轉換為易讀的扁平字串，使用點號鍵名。

```typescript
import { toFlatString } from '@rfjs/object-utils';

toFlatString({ a: { b: 10 }, c: 'abc' });
// 'a.b: 10, c: abc'
```
