# table-builder UX 輪:編輯區頁籤 + Metadata 匯出 + AI 區塊 — 設計規格

日期:2026-07-09
分支:`feat-table-ux`(獨立 worktree,基於含 #238 的 `origin/main` @ `712169b`)
狀態:已與使用者確認(B 版面定案;Metadata 可參照化為使用者明確要求;AI = NL→TableConfig,篩選器 AI 緩到 api filter 輪)

## 目標

table-builder 工具頁的一輪 UX 收整,三件事(同一頁、同一 PR):

1. **B 版面 — 編輯區頁籤化**:「資料來源 / 欄位 / 分頁 / Metadata」四個編輯頁籤;**預覽表格恆在下方**(不進頁籤 —— 保住「改任何設定→預覽立刻反映」的核心迴路,是先前否決整頁頁籤 C 案的理由)。每個面板拿到全寬:欄位列不再折行、JSON 貼上框可放大。
2. **Metadata 頁籤 — 把資料描述變成可參照的產物**:目前 `DataResourceMeta` 是匯入管線的隱形中間產物(infer 完立刻被 derive 吃掉)。本輪把它反向投影出來:engine 加純函式 `tableConfigToResourceMeta`,工具顯示即時 metadata JSON + Copy + 下載。**Columns 面板就是 metadata 的編輯介面** —— 不做第二個編輯面(derive 是單向編譯,雙邊編輯會分叉真相)。
3. **AI 區塊 — NL→TableConfig**:比照 form-builder 的 `AiPanel` 模式,「描述你要的表格調整」→ AI 回完整 TableConfig JSON → `parseTableConfig` 驗證閘 → 套用。附 ask(詢問目前配置)。

## 非目標(明確不做)

- **整頁頁籤(C 案)** — 已否決,預覽必須恆在。
- **Metadata 編輯器 / 獨立 metadata 工具 / 改 meta 觸發 re-derive** — 等第二個真實 meta 消費者(form 骨架衍生或 workbench 輪)再做。
- **內嵌篩選器的 NL 助手** — 需要 ConfigTable 增 controlled filter-tree props(動 table-builder-ui),排到 api filter 輪一起。
- **AI 進 `@rfjs/*` 套件** — AI 只住 apps/web 工具層,套件保持 AI-free(既定紀律)。
- 紅線:不碰 `packages/form-builder*/**`、`apps/web/src/tools/form-builder/**`、`packages/table-builder-ui/**`(本輪 UI 套件零改動)。

## 1. Engine(`@rfjs/table-builder`):`tableConfigToResourceMeta`

`deriveTableConfig` 的反向投影(repo 有 reverse-parse 先例:filter-builder):

```ts
export function tableConfigToResourceMeta(
  config: TableConfig,
  request?: RequestMeta,
  response?: ResponseMeta,
): DataResourceMeta;
```

- `columns` → `fields`:帶 `key`/`label`/`dataType`/`format`/`options`/`sortable`/`filterable`(選填欄缺省不寫,比照 derive 的條件展開);**丟棄純顯示欄** `pin`/`visible`/`align`(不屬於資料描述)。
- label/options **複製**(不共享參照 —— 比照 derive 在 #237 學到的教訓)。
- `request`/`response` 有給就原樣帶入(工具在 fetcher 模式傳當前協定),沒給就不寫。
- 純函式、不改輸入;產出能通過 `parseDataResourceMeta`。
- **round-trip 語義**:`tableConfigToResourceMeta(deriveTableConfig(meta))` ≈ `meta.fields`(對 fields 的共有欄位相等;display-only 欄與 request/response 除外)—— 以測試釘住。
- changeset:`@rfjs/table-builder` **minor**。

## 2. 工具版面(apps/web `table-builder`)

### 2.1 編輯區頁籤

- 頁籤列(沿用 form-builder/flow-builder 的 segmented tabs 視覺模式):**來源 Source / 欄位 Columns / 分頁 Pagination / Metadata**,預設 Source。
- 頁籤下方 = 該面板全寬;三個既有面板元件(source-panel/columns-panel/pagination-panel)**內容不變**,只是掛載位置從三欄 grid 改為當前頁籤。
- 預覽區(`<ConfigTable>`)恆在頁籤區下方,行為不變(key/`source` memo/labels 全保留)。
- 手機版自然受益(原本三欄在窄幅本來就直疊,現在變頁籤更省高度)。

### 2.2 Metadata 頁籤

- 內容:`tableConfigToResourceMeta(config, request?, response?)` 的即時 pretty JSON(`<pre>`,樣式比照工具內既有 JSON 面板)。
  - `rows` 模式:只帶 fields(無 request/response)。
  - fetcher 模式:帶當前策略的 `request`(`samplePaginationMeta(mode)` 組出的那份)與 `SAMPLE_META.response`。
- 動作:**Copy**(clipboard)+ **下載**(`meta.json`,Blob 下載,模式比照 flow-builder 的 `.bpmn` 下載)。
- 一句說明文案:「此為目前表格配置對應的資料描述(DataResourceMeta),可供其他工具/日後的 form 骨架、api filter 使用。」(en+zh-TW)。
- 即時性:任何 Columns/來源編輯 → JSON 立刻反映(直接 useMemo,不快取)。

### 2.3 AI 區塊(NL→TableConfig)

- 位置:eyebrow 之下、編輯頁籤之上(比照 form-builder 把 AiPanel 放頁面頂部的模式)。
- 元件:共用 `AiPanel`(`@/components/shared/ai-panel`),兩個 actions:
  - **generate**(primary、needsInput):`useAiAssist().run({ ...buildNlTablePrompt(input, config), json: true }, parseNlTableResponse)` → 成功 `setConfig(JSON.parse(out))`;回傳 `{ kind: 'generate', prompt, appliedJson }` 供 reapply/log(AiPanel 內建)。
  - **ask**(needsInput):詢問目前配置(prompt 附 config JSON;串流輸出走 AiPanel 既有 ask 模式,比照 form-builder 的 ask action)。
- 新檔 `ai-nl-table.ts`(比照 `form-builder/ai-nl-form.ts` 的形狀):
  - `buildNlTablePrompt(nl: string, config: TableConfig): { system: string; user: string }` —— system 說明 TableConfig 形狀(columns 欄位字彙:key/label/dataType/format/options/sortable/filterable/visible/pin/align + pagination/defaultSort/emptyText;format×dataType 相容規則)、**附上目前 config JSON**、要求回傳「完整修改後的 TableConfig JSON」(不是 patch)、不得增刪 `key`(欄位集合固定 —— key 對應資料欄位,AI 只能調顯示屬性與順序;必要時可改 visible 隱藏)。
  - `parseNlTableResponse(raw: string): string` —— 驗證閘:strip code fence → `JSON.parse` → `parseTableConfig`(zod)試跑,失敗 throw(AiPanel 顯示錯誤);回傳正規化 JSON 字串。
  - **額外守門**:驗證回傳的 columns key 集合 ⊆ 目前資料欄位可解性 —— v1 從簡:只驗 `parseTableConfig` 通過即可(key 亂寫的欄位渲染時顯示空值,無害;守門規則寫進 system prompt 即可,不做程式硬驗)。
- `appliedSummary`:回報欄位數(`t("tbAiApplied", { count })`,placeholder 走 `t()` 帶值 —— 老陷阱)。
- AI 未設定連線時 AiPanel 既有的降級提示照舊(`ai.ready`)。

## 3. i18n

新增 ToolUI 鍵(en+zh-TW 對齊):頁籤名 `tbTabSource/tbTabColumns/tbTabPagination/tbTabMetadata`、`tbMetaHint/tbMetaCopy/tbMetaCopied/tbMetaDownload`、AI `tbAiGenerate/tbAiApplied({count})`;ask 沿用共用目錄既有的 `aiAsk` 鍵(已確認存在於 `src/messages/{en,zh-TW}.json`,form-builder/decision-table 同用)。

## 4. 錯誤處理 / 邊界

- AI 回爛 JSON / 不合 schema → 驗證閘 throw → AiPanel 錯誤顯示,config 不動。
- AI 套用後 `columnsToFilterSchema` 等下游全走既有反應鏈(config state 驅動),無需特別處理;`dataVersion` 不變(資料沒換,ConfigTable 不重掛,執行時篩選樹保留 —— 若 AI 把某 filterable 欄關掉,既有「篩選引用不存在欄位安全略過」行為兜底)。
- Copy 失敗(無 clipboard 權限)→ 按鈕顯示錯誤態或 fallback(選 textarea 全選);從簡:`navigator.clipboard.writeText` + 成功顯示 `tbMetaCopied`,失敗顯示錯誤文字。
- 頁籤切換不重置任何面板 state(面板持續掛載或狀態上提 —— 實作採**條件渲染 + 狀態全在 ui.tsx/面板自身 props**,面板本身無內部關鍵 state;source-panel 的貼上文字是內部 state,切走再回會重置為 defaultText —— 可接受,v1 註記)。

## 5. 測試

| 層 | 內容 |
|---|---|
| `@rfjs/table-builder` | `tableConfigToResourceMeta`:欄位映射(含選填缺省不寫)、display-only 欄丟棄、label/options 複製(參照不共享)、request/response 傳遞、round-trip(derive→reverse ≈ 原 fields)、產出過 `parseDataResourceMeta` |
| 工具 | 頁籤切換(四頁籤、面板互換、預覽恆在);Metadata 頁籤(JSON 含 fields、fetcher 模式含 request、Copy 呼叫 clipboard、下載觸發);`ai-nl-table` 驗證閘(合法過、爛 JSON/壞 schema throw、code-fence strip);AI generate(mock useAiAssist)套用 config → columns 面板反映 |
| e2e | 一條:切到 Metadata 頁籤 → JSON 區塊含 `"fields"`;(既有 e2e 的面板互動 selector 若受頁籤化影響,同步修:先切對應頁籤再操作) |
| 真渲染 | `next build` + start + light/dark 截圖:四頁籤各一張 + AI 區塊 + 預覽 |

**⚠ 既有測試連動**:版面改頁籤後,`ui.spec.tsx`/e2e 內「直接找 Columns 面板元素」的測試需要先切頁籤 —— plan 裡明列逐條檢查,不得刪測試遷就版面。

## 6. 慣例

- Changesets:`@rfjs/table-builder` minor(engine 反向投影);table-builder-ui 零改動無 changeset;apps 不寫。
- Commit/PR 英文 conventional(subject 全小寫、≤90 字元),`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;spec/plan 繁中;HOLD PR。
- e2e port 撞 3002 → `E2E_PORT=3013`。
