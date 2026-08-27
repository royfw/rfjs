# @rfjs/flow-core

Framework-agnostic 的 **FlowDoc 契約** + 純投影 + 純**狀態機 runtime**,用於簽核／
工作流程。它只做任何簽核流都需要、與場景無關的最小地基——**順序推進 + 決策分支 +
逾時路由**——全是純函式,不碰 React、不碰 IO、不碰持久化。

```
schema.ts       FlowDoc / FlowNode / FlowEdge —— zod 契約 + (反)序列化
projection.ts   projectFlow —— 節點型別過濾投影,自動「縮線」接起邊
runtime.ts      FlowState / FlowEvent / startFlow / advance / FlowError —— 引擎本體
condition.ts    resolveCondition / resolveHandle / validateFlowConditions —— 接
                @rfjs/data-filter:求值,以及用「同一份 copy」的詞彙表驗證
```

FlowDoc 契約原本住在 `apps/web` 的 `flow-builder` 工具裡;現在搬進這個套件,讓
runtime 可以消費它——該工具改成從這裡把它 import 回去。

## 安裝

```bash
npm install @rfjs/flow-core
```

## 快速開始

一條流程就是一個 `FlowDoc`:節點(`start` / `form` / `condition` / `action` /
`end`)+ 邊。`startFlow` 定位 `start` 並推進到第一個「會卡住」的節點;`advance`
依外部事件走一步,回傳下一個 `FlowState`。

```ts
import { startFlow, advance, type FlowDoc } from "@rfjs/flow-core";

// 請假流:start → form → condition(yes/no)→ action → end
// form 另有一條 timeout 邊 → 一個升級用的 condition 節點
const doc: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 0 } },
    { id: "form1", type: "form", position: { x: 0, y: 0 } },
    { id: "cond1", type: "condition", position: { x: 0, y: 0 } },
    { id: "approve", type: "action", position: { x: 0, y: 0 } },
    { id: "reject", type: "action", position: { x: 0, y: 0 } },
    { id: "esc", type: "condition", position: { x: 0, y: 0 } },
    { id: "end", type: "end", position: { x: 0, y: 0 } },
  ],
  edges: [
    { id: "e0", source: "start", target: "form1" },
    { id: "e1", source: "form1", target: "cond1", trigger: "onSubmit" },
    { id: "et", source: "form1", target: "esc", trigger: "timeout" }, // 條件式逾時
    { id: "e2", source: "cond1", target: "approve", sourceHandle: "yes" },
    { id: "e3", source: "cond1", target: "reject", sourceHandle: "no" },
    { id: "e4", source: "approve", target: "end" },
    { id: "e5", source: "reject", target: "end" },
    { id: "e6", source: "esc", target: "end", sourceHandle: "auto" },
  ],
};

let state = startFlow(doc);
// { at: "form1", status: "running", awaiting: "submit", context: {} }

state = advance(doc, state, { type: "submit", data: { days: 5 } });
// { at: "cond1", status: "running", awaiting: "decision", options: ["yes","no"], context: { days: 5 } }

state = advance(doc, state, { type: "decide", handle: "yes" });
// { at: "approve", status: "running", awaiting: "action", context: { days: 5 } }

state = advance(doc, state, { type: "complete", result: { ticket: "T-1" } });
// { at: "end", status: "done", awaiting: null, context: { days: 5, ticket: "T-1" } }
```

`state.context` 會累積每一次 `submit.data` / `complete.result`(淺併);當
`status === 'done'` 時,`context` **就是**這條流程的結果。在事件之間持久化
`FlowState`(存 DB、session……)是消費端的事——引擎本身是純函式、無狀態。

### 逾時與條件式逾時

引擎沒有時鐘。由消費端自己的排程器判斷 `form`／`action` 節點的期限已到,並餵入
`{ type: "timeout" }` 事件——引擎只負責沿該節點的 `trigger: 'timeout'` 邊推進:

```ts
const escalated = advance(
  doc,
  { at: "form1", status: "running", awaiting: "submit", context: {} },
  { type: "timeout" },
);
// → { at: "esc", status: "running", awaiting: "decision", options: ["auto"], context: {} }
```

**條件式逾時**只是一條 `trigger:'timeout'` 邊指向 `condition` 節點,而不是指向
單純的升級節點——引擎對它的處理跟其他 condition 節點完全一樣,不需要額外功能。
節點若沒有 `trigger:'timeout'` 邊,收到 `timeout` 事件會丟 `FlowError('no-edge')`。

### resolveCondition / resolveHandle

`advance` 本身不評估任何條件——呼叫前 `event.handle` 必須已經決定好。
`resolveCondition`／`resolveHandle`(在 `condition.ts`,依賴 `@rfjs/data-filter`)
是選配的輔助函式,給想要自動依 `context` 評估 `edge.condition` 的消費端用:

```ts
import { resolveHandle } from "@rfjs/flow-core";

const handle = await resolveHandle(doc, "cond1", { days: 5 }); // → "yes" | "no" | null
if (handle) state = advance(doc, state, { type: "decide", handle });
```

`edge.condition` 沿用 `@rfjs/data-filter` 的 `FilterMatchQuery` 形狀。邊依序嘗試,
第一個 condition 成立的邊獲勝;沒有 `condition` 的邊視為恆真(可當
default／fallback 分支用)。若都不成立、或該節點沒有出邊,`resolveHandle` 回傳
`null`。

### validateFlowConditions——存檔當下就擋掉壞條件

schema 裡 `edge.condition` 是 `unknown`,所以一片寫了引擎不認得的 `dataType` 或
`operator` 的葉節點,存得進去也發佈得出去,等到 `resolveCondition` 求值時才丟例外——
爆的時機是使用者送出的那一刻,不是作者存檔的那一刻。存檔前先驗:

```ts
import { validateFlowConditions } from "@rfjs/flow-core";

const result = validateFlowConditions(doc);
if (!result.ok) return badRequest(result.issues);
// [{ edgeId: 'e2', code: 'unsupportedDataType',
//    message: "[data-filter] unsupported dataType 'wat'", path: 'filters[0]' }]
```

flow-core 也轉出底層的 condition 詞彙:`validateCondition`、`validateMatchQuery`、
`supportedOperators`、`MATCH_QUERY_DATA_TYPES`、`MATCH_QUERY_ELEMENT_TYPES`、
`LOGICAL_OPERATORS`、`OPERATORS_BY_DATA_TYPE`、`ARRAY_OPERATORS_BY_ELEMENT`。

**請從這裡 import,不要直接從 `@rfjs/data-filter` 拿。** `resolveCondition` 是用
**flow-core 依賴樹裡**那份 `@rfjs/data-filter` 求值的。消費端若另外自己依賴
`@rfjs/data-filter`,可能解析到另一份(pnpm 完全可以同時裝兩份),於是驗證用的詞彙表
和求值用的引擎分家。從 flow-core 拿,物理上就不會發生。

範圍:只驗詞彙。樹的**形狀**是
[`@rfjs/filter-builder`](../filter-builder) 的 `parseFilterGroup`;運算子與值的搭配
(`range` 需要兩個值)仍是執行期例外。

## 契約

### `FlowState`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `at` | `string` | 目前節點 id |
| `status` | `'running' \| 'done' \| 'failed'` | |
| `awaiting` | `'submit' \| 'decision' \| 'action' \| null` | 目前節點在等什麼;`done`／`failed` 時為 `null` |
| `options` | `string[]`(選填) | `awaiting === 'decision'` 時出現——各出邊的 `sourceHandle` |
| `context` | `Record<string, unknown>` | 累積資料;`status === 'done'` 時即為流程結果 |

### `FlowEvent`

| 變體 | 適用節點型別 | 效果 |
| --- | --- | --- |
| `{ type: 'submit', data }` | `form` | `data` 淺併進 `context`;沿非 timeout 出邊推進 |
| `{ type: 'decide', handle }` | `condition` | 沿 `sourceHandle === handle` 的出邊推進 |
| `{ type: 'complete', result? }` | `action` | `result` 淺併進 `context`;沿非 timeout 出邊推進 |
| `{ type: 'fail', error? }` | `action` | 終態:`status: 'failed'`、`awaiting: null`;`error` 存入 `context.__error` |
| `{ type: 'timeout' }` | `form` \| `action` | 沿該節點的 `trigger: 'timeout'` 出邊推進 |

### `FlowError`

一個名為 `FlowError` 的 `Error` 子類別,帶 `kind`:

| Kind | 何時發生 |
| --- | --- |
| `wrong-event` | 事件型別對不上目前節點的 `awaiting`(含對已 `done`／`failed` 的流程餵事件) |
| `no-edge` | 節點沒有配得上事件的出邊(如缺 `trigger:'timeout'` 邊,或非 timeout 出邊不是恰好一條) |
| `unknown-handle` | `decide` 的 handle 對不上任何出邊的 `sourceHandle` |
| `no-path` | 沒有 `start` 節點,或 `start` 沒有非 timeout 出邊 |

### 其他匯出

- **`startFlow(doc)`** — 定位 `start`,沿其非 timeout 出邊推進到第一個會卡住的節點。
- **`projectFlow(doc, { keep })`** — 節點型別過濾投影:移除不在 `keep` 集合的中間
  節點,並自動「縮線」把它們的入邊×出邊接起來,保持圖連通(例如只投影出
  `action`／`end` 節點做摘要視圖)。
- **`parseFlow(json)`** / **`flowToJson(doc)`** / **`emptyFlow()`** —
  zod 驗證的(反)序列化,以及一顆全新、只有單一 `start` 的文件。

## 非目標(目前)

這是刻意做到最小的引擎:順序推進、分支、逾時**路由**。以下項目刻意 defer,等
真實下游場景拉動再做(理由詳見[設計 spec](../../docs/superpowers/specs/2026-07-09-rfjs-flow-core-runtime-design.md)
§7):

- 並行／多簽核人會簽(AND/OR/M-of-N)——需要多活躍 token 的狀態模型,不只是單一
  `at` 游標。
- `fail` 後的退回／重試。
- 逾時**排程**本身——量測經過時間、到點觸發是消費端的事;引擎只在收到 `timeout`
  事件時負責路由。
- 子流程。
- 獨立的 result 映射層——`context` **就是**結果;輸出欄位的改名／轉換留給消費端。
- `FlowState` 在事件之間的持久化或排程。

## 相關套件

- **[@rfjs/data-filter](../data-filter)** — 支撐 `resolveCondition`／
  `resolveHandle` 對 `context` 評估 `edge.condition`。
- `apps/web` 的 `flow-builder` 工具 —— 產出這個 runtime 所執行 `FlowDoc` 的視覺化編輯器。
