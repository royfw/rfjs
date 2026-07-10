# @rfjs/flow-core:Flow Phase 2 最小 runtime 設計

- 日期:2026-07-09
- 狀態:設計已與使用者逐段確認,待寫實作計畫(writing-plans)
- 分支 / worktree:`feat-flow-runtime`(`.claude/worktrees/feat-flow-runtime`,由 `origin/main` ae7e413 建立)
- 背景:flow-builder Phase 1(#226/#227 可編輯畫布)+ BPMN 檢視/匯出(#228)已 ship,FlowDoc 契約住在 app 工具。本案是 Phase 2 的**最小執行 runtime**:讀 FlowDoc + 目前狀態 + 事件 → 算出下一步狀態。抽成可發布的 `@rfjs/flow-core`,未來 BPM 產品(hq)消費。memory:`rfjs-flow-canvas-direction`。

## 1. 定位與紀律

- **最小核心,被場景拉動**:只做任何簽核流都需要、與場景無關的地基 —— **順序推進 + 決策分支**。richer 語意(見 §7)一律 defer 到 hq 場景明確後再拉。
- **純函式引擎**:runtime 是 pure `advance(doc, state, event) → nextState`,不碰 React、不碰 IO、不碰持久化(狀態存哪是消費端的事)。副作用(通知、寫 DB)由消費端執行後回報。
- **消費既有 FlowDoc 契約**:`schema.ts` 的 `trigger`/`condition`/`sourceHandle` 早已預留給 Phase 2,本案只是「啟用」它們,契約不改。

## 2. 套件結構

抽 `@rfjs/flow-core`(`packages/flow-core`,publishable):

```
@rfjs/flow-core (packages/flow-core/src)
  schema.ts       ← 從 apps/web/src/tools/flow-builder/schema.ts 搬入(FlowDoc 契約 + zod,純)
  projection.ts   ← 從 apps/web/src/tools/flow-builder/projection.ts 搬入(projectFlow,純)
  runtime.ts      ← 新:FlowState / FlowEvent / startFlow / advance / FlowError
  condition.ts    ← 新:resolveCondition(選配 helper,依賴 @rfjs/data-filter)
  index.ts        ← barrel
```

- **核心零依賴**(schema/projection/runtime 只用 zod;zod 已是 schema 既有依賴)。
- **`condition.ts` 依賴 `@rfjs/data-filter`**(workspace dep)—— 選配,消費端不用可不 import。
- **app 端改動**:`apps/web/src/tools/flow-builder/` 內原本 `from "./schema"` / `from "./projection"` 的檔案(bpmn-view/model/nodes/ui/bpmn + 各 spec)改成 `from "@rfjs/flow-core"`;刪除搬走的兩個檔。**行為不變**,安全網 = 既有 flow-builder 測試全綠。
- 經 Next.js `transpilePackages` 消費(同 filter-builder 慣例);publishable → 附 changeset、雙語 README、tsdown/vitest 用 tpl-toolkit config factory。

## 3. Runtime 契約

**統一模型**:引擎推進到「需要外部輸入的節點」就暫停,回報 `awaiting`。start 自動前進到第一個真實節點;form/condition/action 都 block;end = 完成。

```ts
interface FlowState {
  at: string;                                          // 目前節點 id
  status: 'running' | 'done' | 'failed';
  awaiting: 'submit' | 'decision' | 'action' | null;   // 目前節點在等什麼(done/failed 時為 null)
  options?: string[];                                  // awaiting==='decision' 時,可走的 handle 清單
  context: Record<string, unknown>;                    // 累積資料(表單提交 + action 結果)
}

type FlowEvent =
  | { type: 'submit';   data: Record<string, unknown> }     // 給 form → data 併進 context
  | { type: 'decide';   handle: string }                    // 給 condition → 走該 handle 的 out-edge
  | { type: 'complete'; result?: Record<string, unknown> }  // 給 action → result 併進 context
  | { type: 'fail';     error?: unknown }                   // action 失敗 → 進 failed 終態
  | { type: 'timeout' };                                    // 逾時 → 走該節點 trigger:'timeout' 的 out-edge

/** 進入流程:定位到 start,沿其唯一 out-edge 前進到第一個 block 節點。 */
function startFlow(doc: FlowDoc): FlowState;

/** 走一步:事件須配得上目前 awaiting,否則丟 FlowError。 */
function advance(doc: FlowDoc, state: FlowState, event: FlowEvent): FlowState;

/** 選配:用 @rfjs/data-filter 對 context 評估 edge.condition,回傳該 edge 是否成立(供消費端算 handle)。
 * async —— data-filter 的 matchQueryAsync 是 async(compile-once 契約)。 */
function resolveCondition(edge: FlowEdge, context: Record<string, unknown>): Promise<boolean>;
```

**推進規則**:
- 事件的 `type` 必須對應目前節點的 `awaiting`(form↔submit/timeout、condition↔decide、action↔complete/fail/timeout),否則丟 `FlowError('wrong-event')`。
- **非 condition 節點(form/action/start)的出邊,依「事件性質」選**:`submit`/`complete` 走**非 timeout 邊**(`trigger !== 'timeout'`,即正常 onSubmit / 單一出邊);`timeout` 走 `trigger === 'timeout'` 的出邊。取不到對應邊丟 `FlowError('no-edge')`。(單一正常出邊 + 選配一條 timeout 邊 = 常見形狀;更複雜的多出邊路由 defer。)
- **condition 節點**:依 `event.handle` 找 `sourceHandle === handle` 的 out-edge;找不到丟 `FlowError('unknown-handle')`。
- 前進後「落」在目標節點,依其型別設 `awaiting`:form→`'submit'`、condition→`'decision'`(+ `options` = 各 out-edge 的 sourceHandle)、action→`'action'`、end→`status:'done'` / `awaiting:null`。
- `submit.data` 與 `complete.result` **淺併**進 `context`。
- `fail` 事件(僅 action 節點):`status:'failed'`、`awaiting:null`,停下;`error` 存入 `context.__error`(消費端可讀)。**失敗後怎麼走**(error edge / 退回 / 重試)= defer。

**Timeout(逾時路由)**:引擎只認 `timeout` **事件** —— 由消費端的排程器在 deadline 到點時餵入(引擎無時鐘,見下)。收到 `timeout` 就走該節點 `trigger:'timeout'` 的出邊;沒有這條邊 → `FlowError('no-edge')`。
- **單純逾時 escalate**:`trigger:'timeout'` 邊 → 直接指向升級/通知節點。
- **條件式逾時**:讓 `trigger:'timeout'` 邊**指向一個 condition 節點** → 之後走既有 condition 分支(`resolveCondition`/filter 對 context 判斷)。**這不是額外功能,是 timeout 路由 + condition 節點的組合**,引擎零改動。
- **「多久」不進引擎**:deadline 時長是消費端排程器讀的 metadata(放節點 config,如 `deadline:'24h'`);引擎不知道時長,只在收到 `timeout` 事件時路由。排程機制(數時間、到點觸發、人先動就取消)= 消費端 / hq(§7)。

**result 收集**:`context` 累積全程資料;`status:'done'` 時 **`context` 即 flow 的最終 result**。引擎只把 context 穿過 state 回傳,**持久化由消費端負責**(存 DB/session 皆可)。**獨立的 result 映射層**(指定官方輸出欄位、轉換)= future work(§7),最小核心不做。

## 4. resolveCondition(選配 helper)

- 輸入:`edge.condition`(FlowDoc 預留的 unknown)+ 目前 `context`。
- 用 `@rfjs/data-filter` 的 match 對 context(單一物件)評估 `condition`,回 boolean。
- 消費端典型用法:對 condition 節點的每條 out-edge 呼叫 `resolveCondition`,挑第一個成立的 `sourceHandle` 當 `event.handle` 餵回 `advance`。**核心 `advance` 不呼叫它**(維持純導航);消費端要開箱即用就用、要自訂判斷就自己算 handle。
- `edge.condition` 的具體 schema:沿用 `@rfjs/data-filter` 既有的 filter 形狀(實作時以其 public 型別為準);flow-core 不另立標準。

## 5. 錯誤處理

- **結構驗證**:沿用既有 `parseFlow`(zod)—— 消費端在進 runtime 前先驗 FlowDoc 結構。
- **執行期**:`advance` 對契約違反丟具名 `FlowError`(class,`kind: 'wrong-event' | 'no-edge' | 'unknown-handle' | 'no-path'`,同 `AiError` 風格)—— 這些是消費端接錯,該修不該吞(不用 Result)。
- `startFlow`:start 無 out-edge → `FlowError('no-path')`。

## 6. 測試策略

純函式,vitest 直接測(`packages/flow-core/src/**/*.spec.ts`):
- **runtime 整條**:用內建 sample 請假流跑完整條 —— `startFlow` → submit → decide(yes/no 兩路各測)→ action complete → end done;逐步斷言 `at`/`awaiting`/`options`/`context`。
- **result**:done 時 `context` 含 submit data + action result。
- **fail**:action `fail` → `status:'failed'`、`context.__error` 存在。
- **timeout**:節點有 `trigger:'timeout'` 邊時,`timeout` 事件走該邊(單純逾時);`trigger:'timeout'` 邊指向 condition 節點時,落地為 `awaiting:'decision'`(條件式逾時 —— 驗證組合成立);無 timeout 邊時 `timeout` 丟 `FlowError('no-edge')`。
- **錯誤**:wrong-event(如 awaiting decision 卻餵 submit)、unknown-handle、no-edge(節點缺出邊)、no-path(start 無出邊)各丟對應 `FlowError.kind`。
- **resolveCondition**:對固定 condition + context 回正確 boolean(接 data-filter);消費端「挑第一個成立 handle」的典型組合跑一次。
- **schema/projection 遷移**:搬檔後既有 `schema.spec`/`projection.spec` 跟著進套件,斷言不變、全綠。
- **app 回歸**:`pnpm --filter web vitest:run` 全綠(flow-builder 工具 import repoint 後行為不變);check-types / lint / `pnpm --filter web build` / `pnpm --filter workbench build`。
- **e2e**:flow-builder 既有 e2e 不受影響(runtime 不碰 UI);本案不新增 e2e(純引擎)。

## 7. 非目標(defer 到 hq 場景拉動)

並行 / 會簽(join / 多簽核人)、退回 / back-transition、action 失敗後的路由(error edge / 重試)、**timeout 排程機制本身**(數時間、到點觸發、人先動則取消 —— 引擎只認 timeout 事件,排程由消費端做)、子流程、**獨立 result 映射層**(官方輸出欄位 + 轉換)、runtime 的持久化 / 排程(消費端負責)。這些等 hq 第一個簽核場景明確後再逐一拉進來。

**注意**:timeout **事件路由**(含條件式 timeout = timeout 邊 → condition 節點)**在本案範圍內**;只有「數時間的排程器」defer 給消費端。

## 8. 慣例

spec/plan 繁中;commit/PR 英文 conventional(subject 全小寫,trailer 前空行,結尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`);worktree 內開發;**HOLD PR**。動 `packages/*` → 附 changeset(新 publishable 套件 `@rfjs/flow-core` minor)。開工前 `git fetch` 對齊最新 main(有平行 session 在 feat-api-filter,區域不重疊 —— 本案動 flow-builder + 新套件)。
