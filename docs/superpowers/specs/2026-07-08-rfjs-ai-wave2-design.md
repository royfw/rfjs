# AI Wave 2:AiPanel 外殼抽取 + 重新套用 + dt/fb 接入 設計

- 日期:2026-07-08
- 狀態:設計已在對話核可(兩決策點:dt Check 併入 panel、fb 產生列併入 panel),待使用者審 spec → writing-plans
- 分支 / worktree:`feat-ai-wave2`(`.claude/worktrees/feat-ai-wave2`,由 `origin/main` 9dd7a50 建立)
- 背景:A+B roadmap 的 Wave 2(memory `rfjs-ai-assist-direction`)。Wave 1(#234)已給 6 個 filter 工具獨立的「✨ AI ASSIST」section;本案把外殼泛化成 `AiPanel`,補「重新套用」,並讓 decision-table 與 form-builder 用同一形狀。

## 1. 目標

| # | 項目 | 說明 |
| --- | --- | --- |
| ① | **`AiPanel` 通用外殼** | 從 `AiAssistBlock` 抽出:收合標題列(沿用全站偏好 `rfjs.ai.block.open`)、自動長高輸入(Enter=主動作、Shift+Enter 換行、IME 防護)、**動作插槽**、取消、錯誤慣例、`AiLogStore` 紀錄堆疊 + 清除 + advisory |
| ② | **重新套用** | 有 `appliedJson` 的紀錄項顯示「重新套用」:走該工具的套用閘門(filter=`onCanonicalChange`、fb=`jsonToCards` 同路徑),**整份取代**(存的是完整快照) |
| ③ | **decision-table 接入** | 頁面新增同款 AI ASSIST section,動作 = 檢查表格(免輸入)/ 提問 / 解釋這張表;**移除** Rules 表頭的 AI Check 按鈕、舊 findings 面板與卡片內錯誤列 |
| ④ | **form-builder 接入** | 動作 = 產生表單(主)/ 提問 / 解釋表單;**移除** tabs 下方的舊 ✨ 產生列 |

**已鎖定決策**:AI 輸出永不直接落地(閘門不變:filter `parseFilterGroup`、fb `parseNlFormResponse`/`jsonToCards`、dt findings zod + 幻覺 ruleId 過濾);`packages/*` 零改動;繁/英 i18n 鍵集合一致。

## 2. `AiPanel` 介面(`apps/web/src/components/shared/ai-panel.tsx`,新)

```tsx
export interface AiPanelAction {
  key: string;                 // 對應 entry.kind:'generate' | 'ask' | 'explain' | 'check'
  label: string;
  needsInput?: boolean;        // true=需輸入(空輸入時 disabled);false=免輸入
  primary?: boolean;           // 主色按鈕;第一個 primary 動作也是 Enter 的目標
  run: (input: string) => Promise<Omit<AiAssistEntry, "id" | "at"> | null>;
                               // 工具側做 prompt 組裝 + 驗證閘門 + 套用;回 null=失敗/取消(錯誤在 hook 狀態)
}

export function AiPanel(props: {
  title: string;               // 標題列文字(中央 aiBlockTitle)
  placeholder: string;
  actions: AiPanelAction[];
  logKey: string;              // 'rfjs.ai.log.<toolId>'
  ai: ReturnType<typeof useAiAssist>;   // 工具側建立並傳入(工具的 run 閉包共用同一實例)
  onReapply?: (entry: AiAssistEntry) => void;  // 給了才在有 appliedJson 的項顯示「重新套用」
}): JSX.Element;
```

外殼負責:收合(全站 key)、輸入狀態、動作按鈕列(primary/outline、分隔線放在「需輸入」與「免輸入」動作之間)、loading→取消、`role="alert"` `[kind] message` + parse 摺疊原始輸出、掛載還原 `log.list()`、成功 `append`、清除、堆疊呈現(newest-first、max-h 內捲、kind 圖示與標籤、`appliedJson` 項顯示已套用摘要 + 重新套用鈕)。

**`AiAssistEntry.kind` 擴充**:`'generate' | 'ask' | 'explain' | 'check'`(`lib/ai/log.ts` 的 KINDS 加 `check`;既有資料相容)。中央 i18n 新增 `aiKindCheck`、`aiReapply`。

## 3. 三處接入

### 3.1 filter 家族(重構,行為不變 + 重新套用)
`AiAssistBlock` 改為薄組合層:對外 props 不變(6 工具接線零改動),內部改為建三個 `AiPanelAction`(generate=primary/needsInput、ask=needsInput、explain=免輸入)+ `onReapply = (e) => onApply(e.appliedJson!)`。既有測試遷移到新結構(斷言不變,收合/IME/堆疊測試移至 AiPanel 自己的 spec,block spec 留 filter 特有行為)。

### 3.2 decision-table
- `ui.tsx`:規則卡片**上方**新增 `<AiPanel>`(sibling);動作:
  - **檢查表格**(primary、免輸入):沿用 `buildCheckPrompt`/`parseCheckResponse`;findings 文字化為紀錄項 —— 每行 `[kind] (ruleIds) message`,空 findings 用既有 `dtAiNoFindings` 文案;entry kind `check`。
  - **提問**(需輸入)/ **解釋這張表**(免輸入):新 `ai-explain-table.ts` —— context = `tableToJson(table)` + locale,純文字回覆(同 filter 的 ai-explain 形狀)。
- **移除**:Rules 表頭的 AI Check 按鈕與 `dtAiChecking`、`dt-ai-findings` 面板、卡片內 `ai.error` 列(panel 接手);`findings` state 刪除。
- i18n(dt fragment):新增 `dtAiAsk`、`dtAiExplain`;移除不再使用的鍵(`dtAiChecking`、`dtAiFindings`;`dtAiCheck`/`dtAiNoFindings`/`dtAiDisclaimer` 依實際使用去留 —— disclaimer 已由中央 `aiAdvisory` 取代則移除),en/zh-TW 同步。
- logKey:`rfjs.ai.log.decision-table`。

### 3.3 form-builder
- `ui.tsx`:tabs 列下方的舊 ✨ 產生列**整段移除**(含 `aiNl` state、`onAiGenerate`),原位置改放 `<AiPanel>`;動作:
  - **產生表單**(primary、需輸入):沿用 `buildNlFormPrompt` + `parseNlFormResponse`,成功走既有套用路徑(groups/cards 更新),entry `{ kind:'generate', prompt, appliedJson: <FormConfig JSON> }`,已套用摘要顯示欄位數。
  - **提問**(需輸入)/ **解釋表單**(免輸入):新 `ai-explain-form.ts` —— context = 目前 FormConfig(JSON)+ locale。
- **重新套用**:`onReapply` 把 `appliedJson` 走 `parseNlFormResponse` 同路徑重新載入畫布(仍經閘門,防舊資料損毀)。
- i18n(fb fragment):新增 `fbAiAsk`、`fbAiExplain`;`fbAiPlaceholder`/`fbAiGenerate`/`fbAiCancel`/`fbAiNotConfigured` 若被中央鍵取代則移除(placeholder/cancel/not-configured 用中央 `aiBlockPlaceholder`/`aiCancel`/`aiNotConfigured`;產生按鈕文字工具化 → `fbAiGenerate` 保留改文案或沿用,實作時以不重複為準),en/zh-TW 同步。
- logKey:`rfjs.ai.log.form-builder`。

## 4. Mockup(視覺定稿,實作須對齊)

`docs/superpowers/specs/2026-07-08-rfjs-ai-wave2-mockup.html`:dt 新版面(AI section + check 紀錄項)、fb 新版面(AI section 取代舊列)、filter 紀錄項的「重新套用」鈕。收合樣式與 Wave 1 的 section 規格一致。

## 5. 測試策略

- **AiPanel 單元**(mock `useAiAssist` + localStorage):動作按鈕 needsInput/primary/分隔線;Enter=第一個 primary(IME/Shift+Enter/loading 防護 — 自 Wave 1 遷移);run 回 entry → append+顯示;回 null → 不落地;錯誤慣例;收合偏好;清除;`onReapply` 有給且項有 `appliedJson` 才出現按鈕、點擊帶正確 entry。
- **filter block**:對外行為回歸(既有 spec 遷移)+ 重新套用呼叫 `onApply(appliedJson)`。
- **dt**:檢查動作 findings→文字項(含空 findings);提問/解釋 prompt 含 tableToJson;舊按鈕/面板移除(spec 斷言更新);幻覺 ruleId 過濾沿用既有 `ai-check.spec`。
- **fb**:產生走既有閘門(既有測試遷移);提問/解釋 context 含 FormConfig;重新套用經 `parseNlFormResponse`。
- **i18n**:`tools/index.spec.ts` 中央/fragment 不衝突照常;兩語系鍵集合一致。
- **e2e**:既有 `ai-settings.e2e.ts` 第二測試(dt AI Check disabled)選擇器隨新版面更新;新增 fb/dt panel 煙霧各一(未設定引導)。完整 gates:web vitest / check-types / lint、web + workbench build、production e2e、light/dark 截圖對 mockup。

## 6. 非目標

聊天面板/多輪/`stream()`(Wave 3)、`@rfjs/ai-assist` 抽離(Wave 3)、fb 產生的「接續組合」(filter 已有;fb 的合併語意較複雜,列 Wave 3 前候選)、flow-builder/bpmn 的 AI。

## 7. 慣例

spec/plan 繁中;commit/PR 英文 conventional(小寫開頭,trailer 前空行,`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`);worktree;**HOLD PR**;本案只動 `apps/web` → 不需 changeset(若動到 `packages/*` 一律補,private 也要)。
