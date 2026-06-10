# @rfjs/data-label

依資料路徑組成顯示用標籤字串,支援值翻譯與安全的 `${path}` 模板。

## 安裝

```bash
npm install @rfjs/data-label
```

## 用法

```typescript
import { composeLabel } from '@rfjs/data-label';

const source = { contract: [{ type: 'ProductSales' }], qty: 3 };

// 有模板(可用 ${aliasKey}、${_索引}、${path}):
composeLabel(
  {
    fields: [{ path: 'contract[0].type', aliasKey: 'type' }, { path: 'qty' }],
    valueMap: [{ key: 'ProductSales', value: '產品銷售契約' }],
    template: '${type} x${_1}',
  },
  source,
);
// → '產品銷售契約 x3'

// 無模板 → 各欄位值以空白 join:
composeLabel({ fields: [{ path: 'contract[0].type' }, { path: 'qty' }] }, source);
// → 'ProductSales 3'
```

`${token}` 會以**去掉 `[ ] .`** 後的形式查表,所以 `${contract[0]}`、`${_0}`、`${alias1}`
都能解析。未知 token 與 nullish 值會輸出空字串 —— 組字不會丟錯。

## 自訂渲染器

預設引擎只做 `${path}` 取值替換(不執行任何程式碼)。需要進階模板時,自行傳入 `render`:

```typescript
import _ from 'lodash';
import { composeLabel, normalizeKey } from '@rfjs/data-label';

composeLabel(spec, source, {
  render: (template, values) => _.template(normalizeKey(template))(values),
});
```

## API

- `composeLabel(spec, source, options?)` → `string`
- `buildLabelValues(spec, source)` → 查找表(`_N`、原始 path、正規化 path、`aliasKey`)
- `normalizeKey(path)` → 去掉 `[`、`]`、`.` 的 path
