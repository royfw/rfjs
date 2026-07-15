# Filter 家族 AI 助理區塊(Wave 1:解釋/問答 + 重新擺位)設計

- 日期:2026-07-08
- 狀態:設計討論已核可(對話中確認),待使用者審 spec → writing-plans
- 分支 / worktree:`feat-filter-ai-block`(`.claude/worktrees/feat-filter-ai-block`,由 `origin/main` 5ad3141 建立)
- 背景:AI assist v1(#233,已 merge)給 filter 家族做了 NL→條件樹,但入口藏在輸出面板的 `{ }` 分頁裡。本案是 **A+B 並存 roadmap 的 Wave 1**(memory `rfjs-ai-assist-direction`):把 filter 工具的 AI 升級成一個完整的助理區塊 —— 產生、解釋、問答 —— 並搬到使用者實際建條件的地方。

## 1. 目標與範圍

| # | 項目 | 說明 |
| --- | --- | --- |
| ④ | **重新擺位** | AI 從 `{ }` 分頁**搬家**(非複製)到 FILTER LOGIC 區塊頂部,成為 `AiAssistBlock` |
| ①a | **解釋** | 單鍵「解釋目前條件」:tree + schema + 編譯輸出 → 白話說明(當前語系) |
| ①b | **問答** | 輸入問題(例:「這組條件能不能挑出 30 歲以上的活躍使用者?」)→ 帶完整 context 的單發回答 |
| — | **回答堆疊 + 持久化** | 產生/解釋/問答的成功結果在區塊內堆疊(最新在上),**存 localStorage(每工具一個 key,上限 50 筆)**,附「清除紀錄」;紀錄介面 `AiLogStore` 開在 seam 層,為 Wave 2 重新套用與 Wave 3 聊天歷史鋪路 |

**範圍**:6 個 filter 工具(data-filter-builder、jsonb-query-builder、sql-filter-builder、mongo-query-builder、pg-filter-builder、es-query-builder),全部經 `_filter-builder` scaffold 一次改。**只動 `apps/web`**;`packages/*` 零改動(不需 changeset);decision-table / form-builder 不在本案。

**已鎖定決策**(對話核可):
- 一個輸入框、兩個意圖按鈕(產生條件 / 提問)+ 一顆免輸入的「解釋目前條件」。
- 解釋與問答是 **display-only**:純文字顯示、不落地任何狀態、不需驗證閘門(鐵律只約束會改變畫面狀態的輸出;「產生」仍走既有 `onCanonicalChange` → `parseFilterGroup` 閘門,完全不變)。
- `{ }` 分頁的 AI 列移除;`QueryOutputPanel` / data-filter 的 `DataPanel` 上的 `aiRow` slot prop 一併刪除(v1 引入,唯二使用者就是這 6 個工具)。

## 2. UI 設計

FILTER LOGIC `<section>` 的 header 與 `<FilterTreeEditor>` 之間插入 `AiAssistBlock`:

```
┌ FILTER LOGIC ──────────────────────────────────────────────┐
│ ✨ [描述條件或提出問題…____________] [產生條件] [提問] │ 解釋目前條件 │
│    (未設定 AI:按鈕 disabled + 「請先設定 AI 連線(右上 ✨)」)  │
│ ┌─ 回答堆疊(有內容才出現)──────────────────────────┐ │
│ │ ❓ 這組條件能挑出…嗎?                                    │ │
│ │    可以。age > 30 且 active = true 會…(AI 建議聲明)      │ │
│ │ 📝 解釋:這組條件會選出…                                  │ │
│ │ ⚡ 產生:「30歲以上活躍」→ 已套用(2 條件)                 │ │
│ │                                            [清除紀錄]      │ │
│ └────────────────────────────────────────────────┘ │
│  ALL · all match   [+condition] [+group] …(FilterTreeEditor)   │
└────────────────────────────────────────────────────┘
```

- **輸入 + 動作**:單一 `Input`;「產生條件」與「提問」共用它(空輸入時兩顆都 disabled);「解釋目前條件」永遠可按(樹為空時 prompt 會如實說明是空樹)。Enter 預設觸發「產生條件」(沿用 v1 行為)。
- **loading**:三個動作共用 `useAiAssist` 的單一 in-flight(新請求自動取消舊的,hook 既有行為);執行中顯示「取消」。
- **錯誤**:沿用 v1 慣例 —— `role="alert"` + `[kind] message`,`parse` 類附「檢視原始輸出」摺疊區。錯誤不進堆疊。
- **堆疊項目**:三種 kind 各有小圖示與標籤;`generate` 項顯示輸入的描述與「已套用」摘要(不重複貼 JSON,JSON 在 `{ }` 分頁看);`ask` 項顯示問題+回答;`explain` 項顯示回答。回答以 `whitespace-pre-wrap` 純文字呈現(**不 render HTML/Markdown**)。
- **AI 建議聲明**:堆疊容器 header 帶一行小字(同 decision-table 的 advisory 慣例):回答為 AI 建議,非引擎判定。
- **清除紀錄**:清空堆疊(僅 UI state;不碰樹)。

## 3. 架構與資料流

```
apps/web/src/tools/_filter-builder/
  ai-nl-filter.ts     (既有)產生:buildNlFilterPrompt / parseNlFilterResponse —— 不動
  ai-explain.ts       (新)解釋/問答 prompt 組裝:
                        buildExplainPrompt({ canonicalJson, schema, compiled, engineId, locale })
                        buildAskPrompt({ ...同上, question })
  ai-assist-block.tsx (新)AiAssistBlock —— 取代 ai-nl-row.tsx(刪除)
  ai-nl-row.tsx       (刪除;測試併入 ai-assist-block.spec.tsx)
  query-output-panel.tsx(修改)移除 aiRow prop

apps/web/src/tools/data-filter-builder/ui/data-panel.tsx(修改)移除 aiRow prop
apps/web/src/tools/{6 個工具}/ui.tsx(修改)FILTER LOGIC 區塊插入 AiAssistBlock、移除 aiRow 接線
```

`AiAssistBlock` props(各工具 ui.tsx 傳入):

```ts
interface AiAssistBlockProps {
  schema: FieldSchema[];
  canonicalJson: string;            // fb.canonicalJson
  compiled: string | null;          // 編譯輸出 primary(失敗時 null)
  engineId: string;                 // 'pg-filter' | 'jsonb' | ...(給 prompt 說明目標引擎)
  onApply: (text: string) => void;  // fb.onCanonicalChange(閘門不變)
  logKey: string;                   // 'rfjs.ai.log.<toolId>'(持久化 key)
}
```

堆疊資料形狀(**對齊 Wave 2/3**,將來可直接餵聊天歷史):

```ts
interface AiAssistEntry {
  id: string;                        // crypto.randomUUID()
  kind: 'generate' | 'ask' | 'explain';
  prompt?: string;                   // generate=NL 描述;ask=問題;explain=無
  answer?: string;                   // ask/explain=回答;generate=無
  appliedJson?: string;              // generate=套用的 canonical JSON(Wave 2 重新套用用)
  at: string;                        // ISO 時間戳
}
```

**持久化介面(seam 層,`apps/web/src/lib/ai/log.ts`,新增)**:

```ts
interface AiLogStore {
  list(): AiAssistEntry[];           // 損毀 JSON / SSR → []
  append(entry: AiAssistEntry): AiAssistEntry[];  // 寫入並回傳新列表;超過上限裁掉最舊
  clear(): void;
}
export const AI_LOG_LIMIT = 50;
export function createAiLog(storageKey: string): AiLogStore;  // localStorage 後端
```

- key 慣例:`rfjs.ai.log.<toolId>`(每工具獨立;由各工具 ui.tsx 傳入 `AiAssistBlock` 的 `logKey` prop)。
- `AiAssistBlock` 掛載時 `list()` 還原堆疊、成功時 `append()`、「清除紀錄」= `clear()` + 清 UI state。
- 放 `lib/ai/`(而非 scaffold)的理由:這是未來 `@rfjs/ai-assist` 的一部分 —— Wave 2 重新套用讀 `appliedJson`,Wave 3 聊天歷史可換後端而呼叫端不變。decision-table / form-builder 後續接紀錄時直接重用。

**Prompt 內容**(`ai-explain.ts`;皆為單發、`json: false`,回覆為純文字):
- system:「你是 {engineId} 篩選條件的助理。使用者的欄位定義:{schema 摘要}。目前條件樹(canonical JSON):{canonicalJson}。編譯結果:{compiled ?? '(無)'}。用 {locale} 語言、純文字(不要 Markdown)回答,簡潔。」
- explain 的 user:「解釋這組條件會選出什麼資料;如果是空樹,請說明目前沒有任何條件。」
- ask 的 user:使用者輸入的問題原文。

## 4. 錯誤處理

沿用 v1 全套:`AiError` kinds(config/http/timeout/abort/parse);abort 不顯示為錯誤;未設定時按鈕 disabled + 引導文案(既有中央 `aiNotConfigured`)。解釋/問答沒有結構驗證(純文字),故不會有 parse 閘門錯誤 —— 但 client 回非預期 payload 仍是 `parse`。

## 5. i18n

新增鍵全部進**中央 ToolUI**(6 工具共用,沿用 v1 的 `ai*` 前綴;en 與 zh-TW 鍵集合一致,`tools/index.spec.ts` 的中央/fragment 不衝突檢查必須過):

| 鍵 | en | zh-TW |
| --- | --- | --- |
| `aiBlockPlaceholder` | Describe a filter or ask a question… | 描述條件或提出問題… |
| `aiGenerate`(既有) | — | — |
| `aiAsk` | Ask | 提問 |
| `aiExplain` | Explain current filter | 解釋目前條件 |
| `aiAnswers` | AI answers | AI 回答 |
| `aiAdvisory` | AI suggestions, not engine verdicts | AI 建議,非引擎判定 |
| `aiApplied` | Applied | 已套用 |
| `aiClear` | Clear | 清除紀錄 |
| `aiCancel` / `aiNotConfigured` / `aiViewRaw`(既有) | — | — |

`aiNlPlaceholder`(v1 的舊 placeholder)若無其他使用處則移除(en/zh-TW 同步刪,保持鍵集合一致)。

## 6. 測試策略

- **`lib/ai/log.ts` 單元**:list/append/clear 往返;超過 `AI_LOG_LIMIT` 裁掉最舊;損毀 JSON → `[]`;SSR(無 window)安全;不同 key 互不干擾。
- **`ai-explain.ts` 單元**:explain/ask prompt 含 schema 欄位、canonical JSON、compiled、locale、問題原文;`json` 未設(非 JSON 模式)。
- **`AiAssistBlock` 元件**(mock `useAiAssist`):
  - 產生:成功 → `onApply` 收到回應原文、堆疊出現 generate 項(v1 `ai-nl-row.spec` 的案例遷移過來);失敗 → 錯誤列、堆疊不變。
  - 提問:成功 → 堆疊出現問題+回答;空輸入 → 按鈕 disabled。
  - 解釋:成功 → 堆疊出現回答;免輸入可按。
  - 未設定:三顆按鈕 disabled + 引導文案。
  - 持久化:掛載時從 `AiLogStore.list()` 還原堆疊;成功後 `append`(以 mock storage 斷言);清除 → 堆疊清空且 `clear()` 被呼叫。
  - parse 錯誤:`aiViewRaw` 摺疊區出現。
- **6 工具接線**:各 ui.tsx 傳入正確 engineId/compiled(以 pg-filter-builder 為代表做一個整合斷言;其餘靠 typecheck)。
- **既有測試遷移**:`query-output-panel.spec` 移除 aiRow 相關斷言;`ai-nl-row.spec.tsx` 刪除。
- **e2e 煙霧**(production server,無真 AI):filter 工具頁 FILTER LOGIC 區塊內可見 AI 輸入列與「解釋」按鈕、未設定時 disabled + 引導。
- **完整 gates**:web vitest / check-types / lint、`pnpm --filter web build`、`pnpm --filter workbench build`、e2e、light/dark 截圖。

## 7. 非目標與 Wave 對齊

**非目標(本案)**:重新套用歷史(Wave 2;`appliedJson` 已存好)、聊天面板/多輪對話/tab sessions/`stream()`(Wave 3)、decision-table 與 form-builder 的解釋問答與紀錄(後續;`AiLogStore` 可直接重用)、`@rfjs/ai-assist` 抽離(Wave 3 觸發)。

**Wave 對齊**:`AiAssistEntry` 的形狀就是 Wave 2 紀錄的資料模型(`appliedJson` 預留給重新套用);Wave 3 聊天層的 context provider 將重用 `ai-explain.ts` 的 context 組裝(schema 摘要 + canonical + compiled)。

## 8. 慣例

spec/plan 繁中;commit/PR 英文 conventional(subject 全小寫開頭,結尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`,trailer 前空行);worktree 內開發;**HOLD PR**。Changeset:本案只動 `apps/web` → **不需要**;若實作中意外動到 `packages/*`,依政策補(private 也要)。
