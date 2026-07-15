# @rfjs/flow — 視覺流程建構器 設計方向(design doc)

- 日期:2026-06-30
- 狀態:**設計方向已定,尚未進入實作 spec。** 這是 north star / 架構決策紀錄;真正要做 v1 時,再由此走 brainstorming → spec → plan → 實作(像 `@rfjs/bpmn` 那樣)。
- 相關:`@rfjs/bpmn`(已上線,唯讀 BPMN 檢視器,與本案**正交**)、`@rfjs/form-builder`、`@rfjs/filter-builder`、`@rfjs/data-filter`、`@rfjs/data-transform`。
- 對應 memory:`rfjs-flow-canvas-direction`。

> ⚠️ 本文不含任何要立即實作的程式。所有 schema / 介面皆為**草案**,供討論定稿。

## 1. 目標

讓**產品的終端使用者**在我們的 App 裡,用 no-code 視覺畫布**建立流程**,流程以**我們自有的 JSON** 表示,節點直接內嵌我們既有的工具(form-builder 的表單、filter-builder 的條件)。

### 1.1 為什麼自己做(build-vs-buy)

評估過直接用 **n8n / Windmill / Temporal**。結論:

- **內部自動化(ops/開發者在用)→ 直接用 n8n,不要自己做**(它的畫布、Merge=join、item 模型、IF/Switch、AI 節點、Wait/webhook 近似簽核、可自架 —— 都成熟)。
- **本案是「產品內、給終端使用者、深度綁我們的 form/filter/資料/品牌/多租戶」→ 自己做才對**:n8n 嵌入產品困難、fair-code 授權限制「把它當成你販售產品的一部分」、其 Form 陽春、UX 是給開發者非終端使用者。

決策(2026-06-30,使用者確認「**產品的終端使用者**」):**自己做 native slice。** 但**重的 server 執行不自己蓋**,可借引擎(見 §6 runtime registry,甚至「export 到 n8n/Temporal」當一個 target)。

## 2. 核心架構:一張 canonical graph → 可插拔 runtime registry

借用 repo 既有的 **filter-builder 哲學**(一棵 canonical tree → 多個 compile/execute 目標),往上提一層:

```
一張 canonical flow graph(鎖 schema)
        │  編輯:React Flow 畫布 + 節點 kind(內嵌 form/filter)
        ▼  執行:可插拔 runtime registry(像 getEngine)
   ┌───────────────┬───────────────┬────────────────┐
   navigation       workflow         durable          (export)
   client 狀態機     server 跑 DAG     可暫停/待辦       → n8n/Temporal
   = 頁面流程/wizard  = data/AI flow    = 人員簽核
```

**關鍵領悟:畫布是「通用圖編輯器」,各種用途是「同一張圖的不同 runtime」**,不是各做一套引擎。

## 3. 一個模型,長出四種用途

| 用途 | 加哪種 node kind | runtime |
| --- | --- | --- |
| 純 data flow(含 join/select/merge) | `data-op`(委派給 data-ops 引擎) | workflow(server) |
| AI 情景 | `ai.generate` / `agent` / `tool` | workflow(server) |
| 人員簽核 + 申請 | `human-task`(form)+ `condition` + 上述混用 | durable(server,可暫停) |
| **no-code 頁面流程 / wizard** | `page`/`screen`(內嵌 form-builder 頁) | **navigation(client)** |

全部重用 form-builder / filter-builder / context,差別只在 node kind 與 runtime。

## 4. 套件邊界

**不按用途拆 flow 套件**(page/approval/data 是 runtime + node kind,屬同一個 `@rfjs/flow`)。**重的資料運算拆成獨立 engine 套件給 flow 消費** —— 沿用既有 edit↔execute 分層:

```
@rfjs/flow            畫布 + canonical graph schema + node kinds + runtime registry(編排)
  └─ data-op 節點  ──委派──▶  @rfjs/<data-ops>   join/select/merge/aggregate 引擎(執行)
                              (與 data-filter / data-transform 同一家族)
(可選)@rfjs/flow-ui    若畫布要被多 app 共用,再抽 React Flow wrapper;否則先內含
```

- `@rfjs/flow` 只負責編排;join/select 這種關聯運算另立 engine,`data-op` 節點委派(就像 filter-builder→data-filter/pg-filter)。
- **不要因為「資料運算很重」就讓 flow 套件膨脹。**

## 5. flow JSON schema(草案)

完全自有、用 zod 定。重點是**現在就保留兩個維度**,免得 data-flow 之後逼著改格式:

```jsonc
{
  "version": 1,
  "nodes": [
    { "id": "n1", "type": "page",      "position": {"x":0,"y":0}, "config": { /* FormConfig 原樣內嵌 */ } },
    { "id": "n2", "type": "condition", "position": {"x":0,"y":0}, "config": { /* filter tree 原樣內嵌 */ } },
    { "id": "n3", "type": "data-op",   "position": {"x":0,"y":0}, "config": { "op": "join", /* 委派 data-ops */ } },
    { "id": "n4", "type": "action",    "position": {"x":0,"y":0}, "config": { "kind": "notify", "params": {} } }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2", "trigger": "onSubmit" },
    { "id": "e2", "source": "n2", "target": "n3", "sourceHandle": "yes", "condition": { /* optional */ } }
  ]
}
```

**兩個刻意保留(便宜、避免日後重寫):**
1. **節點可多輸入**(join ≥2 input handle)。
2. **節點輸出可為集合/多筆**(非只 scalar)。

**約定:** `node.config` 直接內嵌既有工具的 JSON(FormConfig / filter tree),**不發明新子格式**。`edge.trigger` 服務 navigation(`onSubmit`/`onClick(btnId)`),`edge.condition` 服務分支;不同 runtime 各取所需。

## 6. context 模型 + runtime registry

- **context = 各節點輸出的 map(`{ nodeId → output }`)**,而非單一合併 blob。如此 `data-op`/`join` 可讀多個前置輸出(n8n 式引用),不需一開始就上「型別埠」。型別埠(每條線帶 schema)留作未來強化,**v1 不做**。
- **runtime registry(像 `getEngine`)**:每個 runtime 拿同一張 graph 去執行。
  - `navigation`(client 狀態機):渲染目前 page、等使用者事件 → 依 trigger/condition 跳下一個 node;context = wizard 累積資料。**v1。**
  - `workflow`(server):把 DAG 跑完,action/ai/data-op 節點各自執行。
  - `durable`(server):同 workflow 但可在 `human-task` 暫停、持久化 run 狀態、待辦收件匣、resume、逾時/升級。
  - `export`(可選):把 graph 編譯/匯出給 n8n / Temporal 執行。

## 7. 視覺方向

採 **方向 A:經典節點圖(React Flow `@xyflow/react`,MIT)**,**預設由左到右 auto-layout(dagre/elk)+「整理」按鈕**(借泳道的可讀性,但底層仍是自由圖)。否決方向 B(泳道,當主編輯器太硬)、方向 C(混合脊椎,為 UX 甜頭多寫兩套佈局)。
mockup:`docs/mockups/2026-06-30-flow-canvas-directions.html`(三方向對照,含 palette/canvas/inspector 與節點內嵌縮影)。

## 8. 路線圖(按 runtime 分階,各由真實場景驅動)

1. **v1 — navigation / wizard(client)**:畫布 + `page`/`condition` 節點 + client 狀態機 + context 累積。**不碰 server 引擎、不碰持久化**,最大重用 form/filter,風險最低,可先當「給使用者的 no-code 多步驟表單/流程」功能出貨。
2. **v2 — workflow(server,data + AI)**:`action`/`ai`/`data-op` 節點;`@rfjs/<data-ops>` 引擎做 join/select。可考慮借引擎執行。
3. **v3 — durable(人員簽核)**:可暫停/待辦/resume 的 durable workflow(這是最重的 80%,等簽核場景明確再做,或評估 Temporal)。

## 9. 非目標(YAGNI / 明確不做)

- v1 **不做** server durable 引擎、不做持久化、不做人工待辦。
- **不**採 n8n 作為「產品內、給終端使用者」的編輯器(評估後不合);但內部 ops 自動化仍可另用 n8n,與本案無關。
- **不**發明新的 form/filter 子格式(一律內嵌既有 JSON)。
- v1 **不做**型別化每條邊的資料埠(先用 context map);不做迴圈/平行(分支足矣)。
- **不**自己重造一套通用工作流引擎去跟 n8n/Temporal 競爭 server 執行 —— 需要時借。

## 10. 未決 / 待真實場景定

- **第一個要給使用者做的具體 flow 是什麼?**(intake 表單?onboarding?申請單?)—— v1 可先做通用 wizard,但有具體場景能更準。
- collections/items 模型細節(節點處理單筆 vs 多筆;n8n 的 items 模型值得參考)。
- `data-ops` 引擎的運算詞彙(join 類型、select/project、aggregate……)—— 等 data-flow 場景出現再定。
- 多租戶 / 權限 / flow 版本(產品化才需要)。

## 11. 慣例

spec/plan 繁中;commit/PR 英文 conventional(結尾 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`);worktree 內開發;HOLD PR 由人工合併。
