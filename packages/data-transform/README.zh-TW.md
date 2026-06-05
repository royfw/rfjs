# @rfjs/data-transform

資料型別轉換工具，用於在字串、數值、布林、日期之間進行轉換。

## 安裝

```bash
npm install @rfjs/data-transform
```

## 使用方式

### `typeTransfer(value, type)`

將數值轉換為指定的資料型別。

```typescript
import { typeTransfer } from '@rfjs/data-transform';

typeTransfer('42', 'number');       // 42
typeTransfer('true', 'boolean');    // true
typeTransfer('2024-01-01', 'date'); // Date 物件
typeTransfer('hello', 'string');    // 'hello'
```

支援型別：`'string' | 'number' | 'integer' | 'boolean' | 'date' | 'any'`

### `jsonbTransfer(value, type)`

為 PostgreSQL JSONB 查詢情境轉換數值。支援 16 種型別變體，涵蓋一般、物件、陣列形式。

```typescript
import { jsonbTransfer } from '@rfjs/data-transform';

jsonbTransfer('42', 'numeric');         // 42
jsonbTransfer('2024-01-01', 'date');    // '2024-01-01T00:00:00...'
jsonbTransfer('true', 'boolean');       // true
jsonbTransfer('42', 'arrayNumeric');    // 42
```

支援型別：`'string' | 'numeric' | 'date' | 'boolean'` 及其 `object*` / `array*` / `arrayObject*` 變體。

### `toBoolean(value)`

從字串解析布林值，或直接透過已存在的布林值。

```typescript
import { toBoolean } from '@rfjs/data-transform';

toBoolean('true');    // true
toBoolean('false');   // false
toBoolean(true);      // true
toBoolean('');        // false
```

### `toDateString(value)`

將日期字串或時間戳轉換為 ISO 格式字串。

```typescript
import { toDateString } from '@rfjs/data-transform';

toDateString('2024-01-15');      // '2024-01-15T00:00:00.000Z'
toDateString(1705276800000);     // '2024-01-15T00:00:00.000Z'
```
