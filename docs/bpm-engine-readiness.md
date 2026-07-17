# BPM 引擎就緒 + 缺口交接 brief（rfjs → hq 規劃用）

- 日期：2026-07-16
- 目的：讓 hq 在**準確的現況**上規劃 BPM 產品——rfjs 現在給得出什麼、給不出什麼、以及規劃前必須先拍板的架構分岔。
- 基準：rfjs `main`（stable release 已出，23 套件上 npm）。

---

## 1. 分層現況（**最關鍵的一件事**）

rfjs 目前是「**邏輯層全公開、UI 層全 private**」：

### ✅ 邏輯/引擎層 — 公開、可從 npm 直接消費（任何 repo）
| 套件 | 版本 | 對 BPM 的用途 |
|---|---|---|
| `@rfjs/flow-core` | 0.1.0 | 流程模型（節點/邊/流程文件）+ Phase 2 最小 runtime + 編譯 BPMN |
| `@rfjs/form-builder` | 0.1.0 | 節點表單設定模型（欄位/驗證/規則/動作/結果） |
| `@rfjs/data-schema` | 0.1.0 | 資源 metadata 契約（`DataResourceMeta` / meta.json、request/response 協定） |
| `@rfjs/filter-builder` | 0.1.0 | 條件樹的正典 + 引擎登錄（編譯到各執行目標） |
| `@rfjs/sql-filter` / `pg-filter` / `jsonb-query` | 0.1.0 / 0.0.1 / 0.2.0 | 條件節點 → SQL/JSONB |
| `@rfjs/es-query` / `es-client` | 0.1.0 | 條件 → Elasticsearch |
| `@rfjs/mongo-query` / `data-filter` | 0.1.1 / 0.2.1 | 條件 → Mongo / 記憶體內比對 |
| `@rfjs/decision-table` | 0.1.0 | 決策節點（DMN 式決策表） |
| `@rfjs/ai-assist` | 0.1.0 | BYOK 編輯期 AI（NL→設定）能力層 |
| `@rfjs/data-expr` / `data-label` / `data-transform` / `object-utils` / `jwt` / `retry` | — | 表達式/標籤/轉型/物件/JWT/重試等工具 |
| `@rfjs/pg-toolkit` / `tpl-toolkit` | — | PG 管理 / 樣板設定 factory |

### ⛔ UI 層 — **全部 private，不在 npm 上**（只能在 rfjs monorepo 內用）
| 套件 | 版本 | 內容 |
|---|---|---|
| `@rfjs/web-ui` | 0.1.0 | 設計系統（Tailwind preset + tokens + shadcn/Radix 元件） |
| `@rfjs/filter-builder-ui` | 0.0.1 | `<FilterTreeEditor>` 條件樹編輯器 |
| `@rfjs/form-builder-ui` | 0.1.0 | 表單設計器 UI |
| `@rfjs/table-builder-ui` | 0.1.0 | `ConfigTable` + 資料表 UI |
| `@rfjs/data-schema-ui` | 0.1.0 | `ProtocolPanel` 協定編輯 UI |
| `@rfjs/ai-assist-ui` | 0.0.1 | `<AiPanel>` + `useAiAssist` |
| `@rfjs/bpmn-ui` | 0.0.0 | BPMN 檢視器（bpmn-js 包裝） |
| `@rfjs/web-core` / `@rfjs/core` / `@rfjs/db` | — | 註冊表/schema、workbench 業務邏輯、Drizzle |

（已用 `npm view` 逐一確認上表 UI 套件皆 **NOT on npm**。）

### ⚠️ flow **編輯器 UI 尚未打包**
- 發布的是 `@rfjs/flow-core`（**引擎**：模型 + runtime）。
- 真正的流程**編輯器**（React Flow 畫布、node inspector/slide-over、node-add、BPMN 分頁）目前是 **`apps/web/src/tools/flow-builder/` 的 app code**，**沒有** `flow-builder-ui` 套件。
- 意思：BPM 的 cockpit 流程編輯畫面，**不能 npm-install 現成的**；要嘛自建（在 flow-core 上），要嘛先從 rfjs 抽一個 `flow-builder-ui`。

---

## 2. 規劃前必須先拍板：**UI 層怎麼取得**（決定整個 BPM 形狀）

BPM 是 cockpit（UI 很重），但 rfjs 的 UI 全 private。三條路，trade-off 不同：

| 選項 | 做法 | 優點 | 代價 |
|---|---|---|---|
| **A. BPM 進 rfjs monorepo** | 用 `transpilePackages` 直接吃私有 UI | 最快複用全部 UI，零抽取 | 產品耦進 rfjs，違反「products→獨立 repo」；rfjs 混入產品關注點 |
| **B. 獨立 repo + 只吃公開引擎 + 自建 cockpit UI** | npm 裝引擎，UI 自己刻（可參考 rfjs 的樣式） | 產品乾淨獨立；引擎照原則消費 | cockpit UI 要自建（flow 編輯器、表單、條件面板…重做一輪） |
| **C. 把 UI 套件也發布公開** | 將 `*-ui` + `web-ui` 轉公開、發 npm | 獨立 repo 可 npm-install 全套 UI | 要**穩定並對外承諾** 各 `*-ui` 的 API + web-ui 設計系統；維護面擴大；flow 編輯器仍需先抽 `flow-builder-ui` |

**建議**：依你們既定原則（products→獨立 repo），走 **B 或 C**。務實路徑常是 **先 B**（薄 cockpit 自建 UI on 引擎，快速驗證產品），等哪些 UI 真的要跨產品複用，再逐一抽成 **C**（公開套件）。A 只在「想最快出 demo、且接受耦合」時才選。

---

## 3. 已知引擎缺口（BPM 場景一跑就會撞到 → 回 rfjs 補）

- **flow-core 三塊**（本來就等 BPM 場景來定形）：
  1. **editor↔runtime 落差** — 編輯期模型與執行期的對接。
  2. **parallel-voting / subflow** — 平行分支/會簽、子流程。
  3. **durable 執行體** — 可持久化/可恢復的長時間執行。
- **flow 編輯器 UI 未打包**（見 §1）——要 BPM 用就得自建或先抽 `flow-builder-ui`。
- 次要：`es-query` 的 `*`/`?` wildcard escape（小正確性 bug）、filter `operator` 型別收斂（內部硬化）——都不擋 BPM 規劃。

---

## 4. 消費模型 / 介面契約

- **安裝**：`npm/pnpm install @rfjs/flow-core @rfjs/form-builder @rfjs/data-schema @rfjs/filter-builder @rfjs/pg-filter …`（公開引擎）。
- **環境**：Node ≥18（rfjs 用 24.16）、pnpm ≥10.24、TS 5.7+。UI 套件（若走 C）走 Next `transpilePackages`。
- **介面契約**（跨層的穩定邊界）：
  - 資源 → `DataResourceMeta`（meta.json）。
  - 條件 → filter-builder 的 `FilterGroupLike` / `treeToPgFilterGroup` 產出的 pg-filter tree（== `apps/api` `/datasets/query` body）。
  - 流程 → flow-core 的 flow doc（可編譯 BPMN）。
  - 表格 → `TableConfig`。
- **參考實作**：`apps/workbench`（dataset-explorer）示範了 workbench→api→core→db 的四層消費法；`apps/web` 各 tool 示範引擎+UI 的組裝。

---

## 5. 給 hq 的建議第一步

1. **先定 §2 的 UI 決策（A/B/C）** —— 它決定 BPM 是進 monorepo、自建 UI、還是要 rfjs 先發布 UI。
2. **挑一個真實場景端到端**（例：一條請假/採購審批流：表單節點 → 條件節點 → 動作節點 → 結束；能建、能存、能看 BPMN、能跑最小 runtime）。
3. **scenario-first**：讓那條流去逼出 flow-core 三塊缺口的**具體需求**，再回 rfjs 補（rfjs 只當引擎供應商）。
4. cockpit MVP 範圍、UX、商業面 → hq 規劃；引擎缺口 → rfjs。

---

## 附：rfjs 對 BPM 的角色

> rfjs = **引擎供應商 + 參考實作**。BPM 需要而引擎還沒有的能力，才回 rfjs 立 spec（沿用 spec→plan→ultracode→SDD→release 流程）。BPM 的產品規劃/程式在 hq / BPM repo，不進 rfjs。
