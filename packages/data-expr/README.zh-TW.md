# @rfjs/data-expr

安全的 JSON 運算式引擎 —— 薄薄一層 [JSONata](https://jsonata.org) wrapper,提供 compile-once
求值、DoS 護欄與 typed error。**不執行任意 JavaScript(no `eval`)** —— 運算式被解析成 AST 後以
函式式求值,運算式字串永遠無法執行程式碼。

## 安裝

```bash
npm install @rfjs/data-expr
```

## 用法

```typescript
import { compile, evaluate } from '@rfjs/data-expr';

const order = {
  items: [
    { sku: 'A', status: 'paid', amount: 400 },
    { sku: 'B', status: 'open', amount: 700 },
  ],
};

// 編譯一次、多次求值(求值為 async —— jsonata v2)
const total = compile('$sum(items.amount) * 2');
await total.evaluate(order); // 2200

// 一次性便利版(非 hot path 用)
await evaluate("$count(items[status='paid'])", order); // 1
await evaluate("items[0].sku & '-' & items[0].status", order); // 'A-paid'
```

### Slot helpers

下游(例如 `@rfjs/data-filter`)用 `=` 前綴標記「計算槽位」:

```typescript
import { isExpression, stripExpressionPrefix } from '@rfjs/data-expr';

isExpression('=$sum(items.amount)'); // true
stripExpressionPrefix('=$sum(items.amount)'); // '$sum(items.amount)'
```

## 選項

```typescript
compile(expr, {
  timeoutMs: 1000,   // 每次 evaluate() 的 wall-clock 預算(預設 1000)
  maxDepth: 100,     // 求值深度預算(預設 100)
  strict: false,     // true → undefined 結果改為 reject
  onUndefined: (expression) => console.warn('undefined result:', expression),
});
```

編譯後的運算式可**循序**重用(編譯一次、逐列求值);同一實例不支援並行 `evaluate()`。

## 錯誤

所有失敗都是帶 `kind` 判別的 `DataExprError`:

| kind | 意義 |
|------|------|
| `compile` | 運算式解析失敗(`compile` 同步丟出)|
| `evaluate` | 求值丟錯(型別錯誤、函式參數錯誤等)|
| `timeout` | 超過 `timeoutMs` 預算(失控運算式)|
| `depth` | 超過 `maxDepth` 預算(過深/不終止的遞迴)|
| `undefined` | `strict` 模式且結果為 `undefined` |

## 安全

- **無 RCE:** JSONata 不執行 JavaScript;本套件也**不向運算式暴露額外 binding**(只有你傳入的資料
  物件)—— 別把機密放進去。
- **DoS 護欄預設開啟:** 運算式視為可能不可信;`timeoutMs` / `maxDepth` 會中止失控求值。只在
  運算式為開發者/設定控制時才放寬。
- **ReDoS 注意:** `$match` / `$replace` 搭配*動態*(來自資料或使用者的)regex pattern 是 ReDoS
  面;timeout 會兜底,但請優先使用靜態 pattern。

## JSONata 易踩點

**序列塌縮** —— 同一條路徑運算式,回傳形狀隨命中數改變:

| 命中數 | `items[status='paid']` 回傳 |
|--------|------------------------------|
| 0 | `undefined` |
| 1 | 該物件本身(**不是** 單元素陣列)|
| n | 陣列 |

**從 JSONPath 過來?** 對照表:

| JSONPath | JSONata |
|----------|---------|
| `items[*].amount` | `items.amount`(路徑自動映射陣列 —— 不寫 `[*]`)|
| `items[?(@.amount > 500)]` | `items[amount > 500]` |
| `$..name` | `**.name` |
| `$.a.b` | `a.b`(沒有 `$.` 根前綴)|
| —(做不到)| `$sum(items.amount)`、`$count(items[status='paid'])`、字串函式、算術 |
