# AI Assist(edit-time AI 輔助層)設計

- 日期:2026-07-07
- 狀態:設計已核可,待寫實作計畫(writing-plans)
- 分支 / worktree:`feat-ai-assist`(`.claude/worktrees/feat-ai-assist`,由 `origin/main` fcfdc88 建立)
- 背景:memory `rfjs-ai-assist-direction` 的落地。**編輯時**的 AI 輔助(產生/檢查),與 flow 保留的 `ai.*` action kinds(**執行時**)是兩回事,本案不碰後者。

## 1. 目標

給 apps/web 的工具加上可配置的 AI 輔助:使用者自帶 API(**BYOK**:baseUrl / apiKey / model,OpenAI-compatible,litellm / Ollama / OpenAI 通吃),在三個工具上落地首發功能:

| # | 工具 | 功能 | 驗證閘門(既有 parser) |
| --- | --- | --- | --- |
| 1 | filter-builder 家族(5 個 builder 工具,經 `_filter-builder` scaffold) | **自然語言 → 條件樹** | `parseFilterGroup()` → `filterGroupToTree()` |
| 2 | decision-table | **表格檢查**(缺口/重疊/不可達列 + 白話總結) | findings zod schema |
| 3 | form-builder | **自然語言 → FormConfig** | `parseFormConfig()`(經既有 `jsonToCards` 路徑) |

### 已鎖定決策

| 決策 | 結論 |
| --- | --- |
| v1 範圍 | 上表 3 個 assist 一次做 |
| 設定 UX | **全站設定**:topbar ✨ 入口 → dialog,存 localStorage;未設定時工具內 AI 按鈕顯示引導 |
| seam 位置 | **app-local、套件形狀**(`apps/web/src/lib/ai/`);抽 `@rfjs/ai-assist` 的時機 = v1 上線 API 穩定後或 workbench 需要時(正式 follow-up,見 §8) |
| 回應模式 | **單發 JSON + AbortController 取消**;`AiClient` 介面預留 `stream()` 位置(不實作) |
| 鐵律 | **AI 輸出永不直接落地** —— 一律 AI 吐 JSON → 既有 parser/zod 驗證 → 通過才進畫面;失敗顯示錯誤(原始輸出可摺疊檢視)。`@rfjs/*` 引擎套件零改動、維持 AI-free |

## 2. 架構

```
apps/web/src/lib/ai/                    ← seam(未來抽 @rfjs/ai-assist 的部分)
  types.ts       AiSettings / AiClient / AiError(具名錯誤:config|http|timeout|abort|parse)
  settings.ts    localStorage 讀寫(key: rfjs.ai.settings)、isConfigured()
  client.ts      createAiClient(settings): AiClient
                   complete(req: { system: string; user: string; json?: boolean;
                                   signal?: AbortSignal; timeoutMs? }): Promise<string>
                   OpenAI-compatible POST {baseUrl}/chat/completions;json=true 時帶
                   response_format:{type:'json_object'} 並在 system 提示 JSON-only
  use-ai-assist.ts  hook:{ ready, loading, error, cancel, run<T>(req, parse:(raw)=>T) }
                   run = complete → parse(驗證閘門)→ 回 T;任何錯誤落 error 狀態

apps/web/src/components/shared/ai-settings-dialog.tsx
  topbar(app-header.tsx)✨ 按鈕 → dialog:baseUrl / apiKey / model + 「測試連線」
  (打一個最小 completion 驗證可用)

各工具的 prompt 組裝 + 驗證接線(永遠留在 app,不進未來套件):
  apps/web/src/tools/_filter-builder/ai-nl-filter.ts(+ scaffold UI 接入)
  apps/web/src/tools/decision-table/ai-check.ts(+ ui 接入)
  apps/web/src/tools/form-builder/ai-nl-form.ts(+ ui 接入)
```

抽套件邊界(已定):`types/settings/client`(+hook)→ 未來 `@rfjs/ai-assist`;prompt 組裝、驗證接線、設定 dialog UI → 永遠留 app。搬家 = scaffold + 搬檔 + 改 import,呼叫端 `complete()` 介面不變。

## 3. 三個 assist 的資料流

### 3.1 filter-builder NL→條件樹(接 `_filter-builder` scaffold → 5 工具全拿)
- 輸入:使用者自然語言 + 目前 `FieldSchema[]`(欄位名/型別給 prompt 當 context)。
- prompt:要求輸出 `FilterGroupLike` JSON(`{logic, filters:[{field,operator,value}|group]}`),附欄位清單與**該工具引擎的合法 operator 集**、2 個 few-shot 範例。
- 驗證:`parseFilterGroup(json, schema)` → 通過 → `filterGroupToTree()` + `mergeFieldsFromTree()` 更新 tree/schema(與既有 canonical-editor 匯入同路徑);失敗 → 顯示 ReverseError + 原始輸出摺疊。
- UI:scaffold 加一個 ✨ 輸入列(textarea + 執行/取消),置於 canonical editor 附近。

### 3.2 decision-table 表格檢查
- 輸入:`tableToJson(table)` 全文。
- prompt:要求輸出 findings JSON:`{ findings: [{ kind: 'gap'|'overlap'|'unreachable'|'note', ruleIds: string[], message: string }] }`,並要求 message 用使用者語言(把目前 locale 傳入 prompt)。
- 驗證:findings zod schema(app 內定義);ruleIds 過濾掉不存在的 id(防幻覺)。
- UI:規則表工具列加「AI 檢查」鈕 → 結果面板列 findings(標註「AI 建議,非引擎判定」),各 finding 顯示對應規則編號。

### 3.3 form-builder NL→FormConfig
- 輸入:自然語言(欲建立的表單描述)。
- prompt:要求輸出 FormConfig JSON(給 v1 `fields[]` 簡化形狀 + 支援的 component/dataType 清單、1 個 few-shot)。
- 驗證:走既有 `jsonToCards(text)`(內含 `parseFormConfig`)→ 成功即以現行「JSON 匯入」同路徑進 canvas;失敗顯示 parse 錯誤。
- UI:form-builder 工具列 ✨ 輸入列(同 3.1 形式)。

## 4. 錯誤處理(具名、可見)

- `AiError` kinds:`config`(未設定/缺欄)、`http`(狀態碼+訊息)、`timeout`(預設 60s)、`abort`(使用者取消,不顯示為錯誤)、`parse`(回應非 JSON / 驗證閘門失敗,附原始輸出)。
- 所有錯誤 `role="alert"` 呈現;`parse` 類附「檢視原始輸出」摺疊區(debug 用)。
- 未設定時:AI 按鈕可見但點擊顯示「先設定 AI 連線」+ 直接開設定 dialog 的捷徑(功能可發現性)。

## 5. 安全 / 隱私

- apiKey 僅存 localStorage、僅由瀏覽器直接對使用者自己的端點發請求;repo/伺服器零密鑰。
- 設定 dialog 明示:「你的資料(欄位定義/表格內容/描述)會送到你設定的 AI 端點」。
- 不記錄任何 prompt/回應到後端(沒有後端)。CSP 若有限制 connect-src 需放行使用者端點 —— 實作時檢查 next 設定(目前 apps/web 未設 CSP,確認即可)。

## 6. i18n

- 設定 dialog + 各工具 AI UI 全部 en/zh-TW。dialog 是共用元件(非 tool),文案入**中央** `apps/web/src/messages/{en,zh-TW}.json` 的新 `AiSettings` 命名空間;工具內按鈕/提示走各工具 `ToolUI`(沿用該工具既有前綴:filter 家族 scaffold 共用鍵可入中央 `ToolUI` 以避免五份重複 —— 中央 ToolUI 與 fragment 的鍵不得衝突,`index.spec` 有檢查;decision-table 用 `dt*`;form-builder 用其既有前綴)。
- AI 產出的 message(表格檢查)由 prompt 指示使用當前 locale。

## 7. 測試策略

- **lib/ai 單元**:settings 讀寫/isConfigured;client mock fetch —— 成功、HTTP 4xx/5xx、逾時、abort、非 JSON 回應 → 各對應 AiError kind;`json:true` 請求體含 response_format。
- **hook 單元**:run 成功流(complete→parse→T)、parse 拒絕 → error、cancel → abort 不落 error。
- **各 assist 單元**(mock client 回固定字串):合法 JSON → 進編輯器(斷言 tree/cards/findings 實際更新);非法 JSON / 驗證失敗 → 錯誤呈現且狀態不變;decision-table findings 過濾幻覺 ruleIds。
- **設定 dialog 單元**:開關、儲存到 localStorage、未設定引導。
- **e2e**(不打真 AI):topbar 入口開 dialog、未設定時工具按鈕顯示引導 —— 煙霧級即可。

## 8. 非目標與 follow-ups

**非目標(v1)**:streaming(介面預留)、server proxy(seam 不變可後加)、flow `ai.*` action kinds、對話式多輪、AI 輸出直接落地(永遠經驗證)、`@rfjs/*` 引擎套件任何改動。

**Follow-ups(記錄,不實作)**:
- 抽 `@rfjs/ai-assist` 套件:v1 上線 API 穩定後、或 workbench 需要時(先到先觸發)。
- 更多 assist:flow-builder NL→flow 草稿、bpmn 圖解說、decision-table NL→規則列。
- streaming(`stream()`)給未來長文場景。

## 9. 慣例

spec/plan 繁中;commit/PR 英文 conventional(subject 全小寫開頭,結尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`,trailer 前空行);worktree 內開發;**HOLD PR**;純 app-local 變更**無 changeset**。
