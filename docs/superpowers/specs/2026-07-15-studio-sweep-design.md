# 設計：Studio 視覺統一補完（table / form / flow / bpmn）

- 日期：2026-07-15
- 分支：`feat-visual-unification`（沿用開啟中的 PR #255）
- 前置：本輪前已完成 `AiPanel` 表頭對齊 studio slab（commit `0435d6b`）。

## 背景與目標

apps/web 的工具展示區已建立一套「studio」視覺語言（見 `docs/superpowers/specs/2026-07-13-visual-unification-design.md`），並在 filter-builder 家族 + `metadata-builder`（參考標竿）上落地。但前一輪刻意把 **table-builder / form-builder / flow-builder / bpmn-viewer** 排除在外，導致這四個「使用者最常用」的工具與參考標竿明顯不一致（使用者以 6 張截圖佐證）。

**目標**：讓這四個工具都說同一套 studio 語言，視覺靠攏 `metadata-builder`。畫布類工具（flow / bpmn）採「畫布外圍套 studio chrome」而非把畫布本身拆成卡片堆。

**非目標**：不動 React Flow / bpmn-js 畫布內部（節點樣式、邊、diagram 反白）；不動任何 engine / 業務邏輯；不改公開 API。

## Studio 語言（既有 primitives，位於 `apps/web/src/components/shared/`）

- `ToolEyebrow` — `text-xs font-semibold uppercase tracking-widest text-muted-foreground`。
- `ToolIntro` — 「這個工具怎麼運作？」可收合 callout；central i18n key（`introQuestion` / `introExpand` / `introCollapse` / `introDismiss`）已存在於 `ToolUI` namespace，每個工具另補 `tagline` + 3 組 `concept{term,desc}`。
- `SectionCard` — 卡片；`section`＝`overflow-hidden rounded-lg border bg-card`。三種表頭：
  - **solo slab**：`bg-muted/30 px-4 py-3` + `<h2 font-mono text-xs uppercase tracking-wide text-muted-foreground>`；
  - **tab-strip**：`flex items-stretch border-b bg-muted/30` + 每 tab `px-4 py-2 text-[13px]`，active＝`bg-card font-semibold text-primary shadow-[inset_0_-2px_0_0_hsl(var(--primary))]`；
  - **collapsible**：前置 chevron；支援 `action` / `bodyClassName` / 受控 `open` / 非受控 `defaultOpen`。
- `ToolTabs` — 分段 pill bar，底層是純 `<button>` + `aria-selected`（**不是** `role="tab"`，以免打破消費端 `getByRole("button")`）。
- `FragmentBar` — 金色狀態條 `bg-primary/10 text-primary` mono `text-[11px]`。

## 三個判斷點（已與使用者確認）

- **A — 內容表頭 vs 系統表頭**：使用者命名的區塊（form 的群組名 Account/Profile、submission 的 Metadata/Data）**保留可讀大小寫**，只對齊色調（`bg-muted/30`）、圓角（`rounded-lg`）、id 用 mono；**只有系統卡**（Palette / JSON / Preview / Fields…）用 mono 大寫 slab 表頭。
- **B — 畫布外框**：canvas 是 `SectionCard` 的 **實心** body，不套虛線（虛線＝filter-logic「可編輯樹」語言的專屬）。
- **C — canvas 補 ToolIntro**：flow / bpmn 比照 reference 補「這個工具怎麼運作？」callout（新增 i18n concepts，en + zh-TW）。

## 逐工具設計

### 1 · table-builder（機械式，風險低）
現況：eyebrow 缺 `uppercase`；頂部分頁列與四面板（`resource/columns/pagination/metadata`）＋預覽卡皆手刻 `rounded-md border p-3 + text-sm font-semibold`（與 `ToolTabs`/`SectionCard` 產出幾乎逐字相同，但為 inline）。

變更：
- `ui.tsx` eyebrow `<p>` → `ToolEyebrow`。
- 頂部分頁列（`ui.tsx:363`）→ `ToolTabs`（labels 不變：Resource / Columns / Pagination / Metadata）。
- 預覽卡（`ui.tsx:437`）→ `SectionCard`（solo slab title；可加 `FragmentBar` 顯示 rows / paging 狀態）。
- 四個子面板卡改 `SectionCard` slab：`resource-panel.tsx:137` / `columns-panel.tsx:119` / `pagination-panel.tsx:34` / `metadata-panel.tsx:70`（Copy/Download 移到 `action`）。
- 狀態文字（resource summary / matched）改 `FragmentBar`（有意義處）。

測試相容（不可破壞）：所有 tab 與控制按鈕維持 `role="button"` 與原 accessible name；`role="switch"`（外部 ProtocolPanel）、`role="alert"`、seed chips 的 `aria-pressed`、`data-testid="metadata-json"`、`data-testid="column-row-*"` 全保留。**唯一需同步修測試**：`columns-panel.spec.tsx` 的 `getByText("Columns", { selector: "p" })` → SectionCard 標題是 `<h2>`，改該 selector（或改用 role/name 查詢）。

### 2 · form-builder（外殼已 OK，補內部）
現況：已用 `ToolEyebrow` / `ToolIntro` / `ToolTabs` / `AiPanel` / `Section`（＝ SectionCard-backed，`inspector/section.tsx`）。缺口在內部。

變更：
- **浮空調色盤**（`ui.tsx:597`）→ 收進一張 `SectionCard`（系統卡，slab title「Palette / 元件」）；「+ Group」用金色 primary 強調。
- **GroupFrame 表頭**（`ui.tsx:878`）：`bg-muted/40`→`bg-muted/30`、外框 `rounded-xl`→`rounded-lg`、id/count 用 mono；**群組名保留 `text-[15px] font-semibold` 可讀大小寫（判斷 A）**。
- **寫死 hex → token**：`#5b8cff`（CanvasCard 選取環 `ui.tsx:967`、group drop-line `ui.tsx:666,699`、inspector badge `settings-panel.tsx:29,31`）→ `ring-primary` / `bg-primary` / primary token。`KIND_META` 的語義色可保留（是元件類型的刻意色碼）。
- **JSON 分頁**（`ui.tsx:802`）→ `SectionCard` slab（title「Config JSON」，Copy 進 `action`，`bodyClassName="p-0"`）。
- **Inspector 空狀態**（`settings-panel.tsx:39`）→ `border-dashed border-input rounded-lg`。
- **SubmissionPanel 區塊**（`submission-panel.tsx:55,140`）→ 對齊 tint/rounding；`<h3>` Metadata/Data 為內容標頭，保留可讀（判斷 A）。

測試相容：保留 `cursor-grab`（CanvasCard）、`aria-label="reorder group"`、`data-testid="card-inspector"` 及其展開態 `fixed` class、`aria-label="config json"`、`data-testid="rp-frame"`（含 `border` class）、依標題收合的 `Section`（Editor / Live Preview / Submission / Basics / Options…）、**badge 需維持為 toggle 按鈕在同一表頭 parent 內的 sibling**、Preview 分頁 wrapper **不得含 `lg:flex-row`**。

### 3 · flow-builder（畫布，全 bespoke）
現況：eyebrow（缺 uppercase）、無 intro、Edit/BPMN 手刻切換、浮空 node-add 列、`h-[560px] rounded-md border` 畫布、手刻 Flow JSON。

變更：
- eyebrow → `ToolEyebrow`；**新增 `ToolIntro`（判斷 C）**。
- Edit/BPMN 切換（`ui.tsx:86`）→ 做進 `SectionCard` 的 **tab-strip 表頭**（`tabs=[Edit,BPMN]`）；卡 body 依 tab 顯示：edit＝node-add 工具列 + React Flow 畫布；bpmn＝現有 `BpmnViewPanel`。
- node-add 列（`ui.tsx:112`）→ 移進卡 body 頂部工具列（label 不變：+ Form / + Condition / + Action / + End）。
- 畫布維持 `h-[560px]`，作為卡 body（實心，判斷 B）。
- Flow JSON（`ui.tsx:145`）→ `SectionCard` slab collapsible + `FragmentBar`（節點/邊數）；JSON 文字仍在 DOM。

測試相容：Edit/BPMN 需維持兩顆 `<button>`、accessible name `Edit`/`BPMN`（`SectionCard` tab-strip 底層是 button + aria-selected，符合）；node-add 四顆按鈕 name 不變；JSON 文字（`"version": 1` / `"flow-builder"` / `"start"`）仍需出現在 DOM；`NodeSheet` 的 `role="dialog"` / aria-label / close 按鈕、`BpmnViewPanel` 的 switch（`human tasks only`）/download 按鈕全不動。

### 4 · bpmn-viewer（畫布，全 bespoke）
現況：eyebrow（缺 uppercase）、無 intro、控制列（sample select / upload / zoom）浮在畫布上方、`h-[600px] rounded-md border` 檢視器、裸 XML 貼上區。

變更：
- eyebrow → `ToolEyebrow`；**新增 `ToolIntro`（判斷 C）**。
- 畫布 → 包進 `SectionCard`（title「Diagram / 圖」，`bodyClassName="p-0"`）；控制列（sample `Select` + upload + zoom cluster）移到表頭 `action`；`FragmentBar` 顯示狀態（sample 名 / element 數）。canvas className 的高度/反白處理保留在 viewer div 上。
- XML 貼上區（`ui.tsx:142`）→ `SectionCard` slab（title「BPMN XML / 來源」），textarea + Render 按鈕在 body。

測試相容：保留 `data-testid="bpmn-viewer"`、`data-testid="bpmn-file-input"`、`<label htmlFor="bpmn-paste">` 關聯、accessible name 恰為「Render」的按鈕、錯誤節點 `role="alert"`。

## i18n 新增

- 既有 central key（`introQuestion` / `introExpand` / `introCollapse` / `introDismiss`）已在 `ToolUI` 共用 namespace，不需再加。
- **新增**（en + zh-TW，各自的 `messages.ts`）：
  - flow-builder：`flowIntroTagline`、`flowIntroC1t/C1d`、`flowIntroC2t/C2d`、`flowIntroC3t/C3d`。
  - bpmn-viewer：`bpmnIntroTagline`、`bpmnIntroC1t/C1d`、`bpmnIntroC2t/C2d`、`bpmnIntroC3t/C3d`。
  - 視需要：`*Palette`（form）、`*Diagram`/`*Source`（bpmn）、`FragmentBar` 標籤等 slab 標題 key。
- **測試陷阱**（來自前輪 ToolIntro rollout）：`introQuestion` 是 central-only key，local-fragment 的測試 provider 取不到會 crash。flow-builder / bpmn-viewer 的 `ui.spec.tsx` 若用 local-fragment provider，加入 `ToolIntro` 後需改用 `assembleMessages("en")` provider（或補齊 central key）。table/form 已在前輪處理過，不受影響。

## Changeset

- `apps/web` 變更 → `"web": patch`（依 [[rfjs-changeset-policy]]；若本分支已有 web patch changeset 可沿用，不重複）。
- `@rfjs/ai-assist-ui` 的 version-only changeset 已於 `0435d6b` 隨附。
- 本輪不動任何 `packages/*` / `libs/*`。

## 驗收

- `pnpm -F web vitest:run` 全綠（含同步修改的 `columns-panel.spec`）。
- 四個工具各出一張 dev build 截圖，與 `metadata-builder` 並排比對，確認 slab 表頭、金色 accent、FragmentBar、tab-strip、intro 一致。
- 深淺主題各檢查一次（canvas 反白不受影響）。
- 不 push、不動 primary checkout；HOLD PR 直到使用者說「PR」。
