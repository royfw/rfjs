# Metadata Builder AI 助理區塊 — 設計規格

日期:2026-07-11
分支:`feat-metadata-ai`(worktree,基於含 #245 的 main @ `d776c79`)
狀態:範圍已與使用者確認 —— NL→meta generate + ask,照 builder 家族既有模式;同時是 #244 抽出的 `@rfjs/ai-assist(-ui)` 的**第一個新消費者**。

## 目標

`/tools/metadata-builder` 補上 AI 助理區塊(家族最後一個缺席者):

- **generate**(NL→`DataResourceMeta`):「幫我宣告一個訂單資源:單號、金額、狀態(草稿/已出貨/取消)、客戶名稱放 jsonb」→ 整份 meta(欄位 + kind + enum options + 協定骨架)→ `parseDataResourceMeta` 驗證閘 → 整份取代(同 import 語義)
- **ask**:詢問目前宣告(串流,家族 ask 模式)

這是第三種起手方式:手動宣告 / 樣本 rows infer / **NL 生成**,互補成完整的 authoring 故事。

## 非目標

- NL→單欄位 patch、自動補 kind 建議、check/explain 動作 —— 等用法穩定
- AI 進 `@rfjs/*` 引擎套件(`data-schema` 保持 AI-free;AI 只在工具層,消費 `@rfjs/ai-assist-ui`)
- 紅線:引擎套件、`ai-assist(-ui)` 套件、其他工具目錄零改動

## 1. 佈線(照 #244 之後的家族現行模式,以 form-builder 為準)

- import:`AiPanel, useAiAssist` from `@rfjs/ai-assist-ui`;`useAiPanelLabels` from `@/components/shared/ai-panel-labels`
- 位置:eyebrow 之下、Editor 區塊卡之上(比照 form/table-builder 把 AiPanel 放頁面頂部)
- `logKey="rfjs.ai.log.metadata-builder"`;`labels={useAiPanelLabels()}`;`title={t("aiBlockTitle")}`(共用鍵)
- actions:
  - **generate**(needsInput、primary):`ai.run({ ...buildNlMetaPrompt(input, meta), json: true }, parseNlMetaResponse)` → 成功走**與 import 完全相同的套用路徑**(`handleImportMeta` 語義:整份取代 + 重建 rows + 清選取 + 跳 Fields 頁籤);回傳 `{ kind: 'generate', prompt, appliedJson }`(reapply 由 AiPanel 內建,套用經同一驗證閘)
  - **ask**(needsInput):`ai.runStream(buildMetaAskPrompt({ metaJson, locale }, input), raw => raw.trim())`,label 用共用 `aiAsk` 鍵
- `appliedSummary`:`t("mbAiApplied", { count })`(fields 數;`t()` 帶值,老規矩)

## 2. `ai-nl-meta.ts`(比照 ai-nl-form/ai-nl-table 形狀)

- `buildNlMetaPrompt(nl: string, meta: DataResourceMeta): { system, user }`:
  - system 說明 `DataResourceMeta` 形狀:fields(key/label 可 `{en,'zh-TW'}` 雙語/dataType 四型/format×dataType 相容規則/options {value,label}/sortable/filterable/**kind: column|jsonb 的語義**(平面欄傾向 column、巢狀路徑傾向 jsonb,但由使用者描述決定))+ request(endpoint/method/pagination 三策略/sort/filter `{style:'pg',param}`)+ response(rowsPath/totalPath/cursorPath)
  - **附上目前 meta JSON** 作為上下文(「調整」型請求可基於現況;「新資源」型請求可整份重來 —— 由 NL 語義決定,prompt 註明兩者皆可)
  - 要求:回傳**完整 `DataResourceMeta` JSON**(不是 patch);沒把握的協定欄位可省略(request/response 是 optional);label 願意的話給雙語
- `buildMetaAskPrompt(ctx: { metaJson: string; locale: string }, question): { system, user }`(比照 ai-explain-form)
- `parseNlMetaResponse(raw: string): string`:strip code fence → `JSON.parse` → `parseDataResourceMeta`(zod 閘,throw 即 AiPanel 顯錯、state 不動)→ 回傳正規化 JSON 字串

## 3. i18n

新鍵(en/zh-TW 同步):`mbAiPlaceholder`("Describe a resource or ask a question…" / "描述資源或提出問題…")、`mbAiGenerate`("Generate meta" / "產生宣告")、`mbAiApplied`("Applied ({count} fields)" / "已套用({count} 個欄位)")。共用鍵(`aiBlockTitle`/`aiAsk` + `useAiPanelLabels` 的整組)沿用不動。

## 4. 錯誤/邊界

- AI 回爛 JSON / 壞 schema → 驗證閘 throw → AiPanel 顯錯,meta 不動
- reapply 舊紀錄:同 generate 套用路徑(再過一次 zod,壞紀錄靜默略過 —— 比照 table-builder 的 `applyGeneratedConfig` 模式)
- 套用會蓋掉當前編輯(同 import)—— 可接受,localStorage 有前一版?(沒有 undo;與 import 一致,不另做)

## 5. 測試

| 層 | 內容 |
|---|---|
| `ai-nl-meta` | prompt 含當前 meta 與 kind 語義說明、user=原句;ask prompt 含 metaJson+locale;驗證閘:合法過(正規化)、fence strip、爛 JSON throw、壞 schema throw(format×dataType 不相容) |
| ui.spec | mock `@rfjs/ai-assist-ui` 的 `useAiAssist`(比照 form-builder ui.spec 的 mock 模式,AiPanel 真渲染);generate 套用 → 欄位清單/預覽 JSON 反映新 meta + 跳 Fields 頁籤;ask 紀錄 answer;messages parity(既有測試自動涵蓋新鍵) |
| e2e | 不加(AI 需 BYOK 連線,e2e 無法真跑;AiPanel 的降級提示已有家族覆蓋) |
| 真渲染 | light/dark 截圖:AI 區塊(未設連線的降級態)+ 整頁 |

## 6. 慣例

- 零 changeset(僅動 apps/web;`ai-assist(-ui)` 純消費)
- Commit/PR 英文 conventional + trailer;HOLD PR;紅線與平行 session(#14 若開跑會動 table-builder 工具/app/api)零交集
