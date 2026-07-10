# Session 交辦 prompt 集(2026-07-10)

> 對應 `2026-07-10-topic-dispatch.html` 的主題編號。每則 prompt 自足(指向 memory/檔案,不依賴原對話)。
> 使用方式:確認「啟動條件」已達成 → 在指定位置開 session → 整段貼上。

---

## 立即可用

### #3 BPM 第一個簽核場景 brainstorm
**開在**:rfjs 根目錄(建議貼給既有的 AI/策略線 session)· **啟動條件**:無

```
接手 BPM 第一個簽核場景的 brainstorm(你之前自己提議的那個)。目標:定義出第一個
具體簽核/workflow 場景(角色、表單、流程節點、資料來源),作為未來 BPM 新 repo 與
flow Phase 2 runtime 的輸入。純討論+spec,不碰 rfjs 程式碼(另一條線正在
feat-api-filter 動 data-schema/table-builder-ui,避開)。背景看 memory:
rfjs-flow-canvas-direction、rfjs-table-builder-line。產出:zh-TW 場景 spec 到
docs/superpowers/specs/,走 brainstorming skill,寫完給我 review。
```

### #5 form result `mode:'table'` 接線
**開在**:rfjs 根目錄(新 session)· **啟動條件**:無

```
接手 form result mode:'table' 接線。背景看 memory:rfjs-form-tool-consolidation
(#235 的 result item 已留 { mode:'table', table: TableConfig } 縫,TableConfig
名字當時為此凍結)與 rfjs-table-builder-line(ConfigTable 已成熟)。目標:form-builder
工具的 result 渲染分支支援 mode:'table' → 內嵌 <ConfigTable>(rows 來源;TableConfig
可由回應 rows infer→derive 或 config 手帶)。走既定流程:brainstorm(小)→ spec →
plan → SDD → 截圖 → HOLD PR。開獨立 worktree(.claude/worktrees/feat-form-result-table),
紅線:不碰 packages/table-builder*(feat-api-filter 線在動它的鄰居 table-builder-ui,
你只消費不修改)。commits 英文 conventional + Co-Authored-By trailer;spec/plan 繁中。
```

### #6 雜項清理(repo 衛生)
**開在**:rfjs 根目錄(新 session;或由 api filter 線的 session 派背景 agent)· **啟動條件**:無

```
修三個既有 repo 衛生問題(main 上就壞,與任何功能線無關):
1. @rfjs/db lint 壞:libs/db devDeps 缺 eslint(對照其他 libs/packages 的 lint 設置補齊)
2. @rfjs/form-builder typecheck 在 fresh install 紅:src/types.ts 用到 File/AbortSignal
   但 tsconfig lib 缺 DOM 型別 + config-schema.ts 有 zod ZodType 型別不匹配 —— 修到
   pnpm -F @rfjs/form-builder typecheck 綠(不得改行為,只修型別/設定)
3. .superpowers/sdd/task-3-report.md 誤入版控:git rm --cached + .gitignore 補 .superpowers/
開獨立 worktree(.claude/worktrees/fix-repo-hygiene),完成後全量 pnpm lint && pnpm
typecheck 應全綠。HOLD PR。改到 packages/form-builder 記得補 changeset(patch);
libs/db 是私有 lib 也補(版本紀錄用,見 memory rfjs-changeset-policy)。
```

### #7 proposal-visual-aid skill 落地
**開在**:hq · **啟動條件**:無(交接檔已進版控,長存)

```
在 hq 建立一個跨專案 skill:proposal-visual-aid(提案視覺輔助)—— 讓任何專案的
session 在「提出方案、比較選項、報告路線圖、描述 UI/流程構想」時,除了 markdown
回覆外,同步產出一份樣式統一、可離線開啟的本地 HTML 視覺輔助。

交接檔兩份(先讀,規則不可刪減):
/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-api-filter/docs/proposals/2026-07-10-proposal-visual-aid/skill-draft.md
/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-api-filter/docs/proposals/2026-07-10-proposal-visual-aid/proposal-visual-base.html
(該分支 merge 後也在 rfjs main 的 docs/proposals/2026-07-10-proposal-visual-aid/ 下)

要做的事:
1. 照 hq 的 skill 慣例建立 skill,SKILL.md 規則照 skill-draft.md 全文(frontmatter
   可依 hq 格式調整)
2. 範本存為 skill 附件 assets/proposal-visual-base.html,SKILL.md 以相對路徑引用
3. 驗證:以範本渲染一個小示例,headless chromium 截圖確認暗色預設、☀/☾ 切換、
   卡片/流程/wireframe 組件正常
4. 完成後回報 skill 最終位置與觸發方式
```

---

## 等前置條件

### #4 metadata 宣告面板(僅 A′ 切法)
**開在**:rfjs 根目錄 · **啟動條件**:api filter 的「契約 PR」(data-schema 擴充)已 merge

```
接手 workbench 的資源 metadata 宣告面板。前情:@rfjs/data-schema 剛擴充了
DataFieldMeta(kind: 'column'|'jsonb'、operators)與 RequestMeta 的 filter 編碼
(看該 PR 與 memory rfjs-table-builder-line)。目標:workbench datasets 頁的宣告
面板 —— 編輯 DataResourceMeta 欄位清單(key/label/dataType/kind/operators/enum
options)、匯入 meta.json(table-builder #239 的匯出格式)、匯出;最終要取代手寫的
apps/workbench/src/lib/dataset-schema.ts 的 DATASET_FIELD_SCHEMA。只做面板組件+
其測試,不接 ConfigTable(會合輪由 api filter 線做)。紅線:不碰 packages/
data-schema、packages/table-builder*(契約已凍結,只消費)。開獨立 worktree
(.claude/worktrees/feat-metadata-panel),走 brainstorm→spec→plan→SDD→截圖→HOLD PR。
```

### #8 npm 發佈一波
**開在**:rfjs 根目錄 · **啟動條件**:#1/#5/#6 已 merge;你已拍板「UI 套件發不發」

```
執行 @rfjs/* 新引擎的 npm 首發輪。用 changeset-release skill。範圍:盤點 .changeset/
積壓(data-schema、table-builder、form-builder、decision-table、flow 系列、
filter-builder 等首發 + 既有套件 bump)。發佈前檢查:各套件 README(雙語慣例)、
package.json private 標記(UI 套件 *-ui 本輪【發/不發 —— 依我的決定填入】,不發就確認
private: true)、peerDependencies、exports/dist 完整。流程照 CLAUDE.md:PR main →
release/stable → GH Actions 版號+回 main PR → merge 到 publish/npmjs → 提醒我手動跑
cd-publish-npmjs.yml。過程中任何要不可逆動作(push release 分支、publish)前先跟我確認。
```

### #9 抽出 @rfjs/ai-assist(AI Wave 3 前半)
**開在**:rfjs 根目錄 · **啟動條件**:建議排在 #8 npm 輪前後(可與其同輪討論)

```
把 apps/web/src/lib/ai 抽成 @rfjs/ai-assist 套件。背景看 memory:
rfjs-ai-assist-direction(Wave 1-2.5 已 shipped;AuthStrategy/OAuth 介面已有註記)。
已定案的設計決策:AI 感知 retry(哪種錯該重試/self-repair)是 ai-assist 的 client
韌性策略,與 timeout/stream/AuthStrategy 同層;底層機械退避可重用 @rfjs/retry,但要
先把 @rfjs/retry 修成 isomorphic(去 Node 依賴)。範圍:套件抽出(BYOK client、
useAiAssist、log;AiPanel 是否隨遷或留 app 層要先 brainstorm)+ retry/AuthStrategy
介面設計;chat dock 不在本輪。走 brainstorm→spec→plan→SDD→HOLD PR;新套件 changeset
minor,@rfjs/retry 改動也要 changeset。
```

### #10 BPM 新 repo 開工
**開在**:新 repo(先在 hq 或空目錄起)· **啟動條件**:#3 場景 spec 定案 + #8 npm 發佈完成

```
依已定案的簽核場景 spec(rfjs docs/superpowers/specs/ 內,BPM 場景那份)開 BPM 產品
新 repo。原則:組裝 npm 上的 @rfjs/* 積木(form-builder/flow/decision-table/
filter-builder/table-builder/data-schema/ai-assist),不用 workspace 連結、不複製
rfjs 原始碼;rfjs 維持引擎+showcase 定位。第一步:用 start-ts-by 選 monorepo 或
app 模板起骨架(rfjs-templates skill 可幫選),再照場景 spec 切第一個垂直切片
(一個簽核流程從表單到審核完成)。架構決策(cockpit model 等)看 rfjs memory 與
場景 spec。
```

### #11 flow Phase 2 導航 runtime
**開在**:rfjs 根目錄 · **啟動條件**:#3 場景 spec 定案(它決定 runtime 要支援什麼)

```
啟動 flow-builder Phase 2:導航 runtime。輸入:BPM 簽核場景 spec(docs/superpowers/
specs/ 內)。背景 memory:rfjs-flow-canvas-direction(Phase 1 #226 + BPMN #228 已
shipped;Phase 2 明確等場景,現在場景有了)。範圍以場景需求為準(節點=頁面/表單、
邊=轉移條件吃 filter tree、執行游標),不做場景用不到的通用機制。走 brainstorm→
spec→plan→SDD→HOLD PR。
```

### #12 form Group 3(後備)
**開在**:rfjs 根目錄 · **啟動條件**:無硬前置,排隊項

```
接手 form-builder Group 3 殘項。背景 memory:rfjs-form-builder-remaining-work
(v2 G1-2 + polish #200-203 已 shipped)。範圍:更多欄位型別 + DatePicker +
dataSource 深化;視覺/UX 大改是另一輪不要混進來。開獨立 worktree,走既定流程,
HOLD PR。與 form result mode:'table' 線(若在跑)協調檔案範圍。
```
