# @rfjs/decision-table

以 @rfjs 既有套件組合出的 DMN 風格決策表:每列規則的條件是
[`@rfjs/filter-builder`](../filter-builder) 條件樹(任意巢狀 and/or/nor/not + elemmatch),
輸出為常值或 [`@rfjs/data-expr`](../data-expr) 的 `"="` 表達式(對 context 運算),
支援 `first` / `collect` 兩種 hit policy 與可選的 `defaultOutputs`。

## 用法

```ts
import { evaluateTable, type DecisionTable } from '@rfjs/decision-table';

const result = await evaluateTable(table, { amount: 200000 });
// result.outputs → { approver: 'CFO' };result.matched → ['big']
```

- **async**(data-expr / JSONata 本質)。
- 條件用了 data-filter 無法在記憶體評估的運算子時,該列**絕不靜默視為不命中** ——
  會跳過並記入 `result.ruleErrors`(`{ strict: true }` 時直接 throw)。
- 表巢狀(表呼叫表)刻意不做:決策鏈交給編排層(例如 flow 串兩個 decision-table 節點)。
