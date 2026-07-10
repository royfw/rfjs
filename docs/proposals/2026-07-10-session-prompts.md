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

### #7 proposal-visual-aid skill 落地(詳細版,全內嵌無外部依賴)
**開在**:hq · **啟動條件**:無

````
在 hq 建立一個跨專案 skill:proposal-visual-aid(提案視覺輔助)。

## 目的
讓任何專案的 session 在「提出方案、比較選項、報告路線圖、描述 UI/流程構想」時,
除了 markdown 回覆外,同步產出一份樣式統一、可離線開啟的本地 HTML 視覺輔助。

## 要做的事
1. 照 hq 管理 skill 的慣例建立 skill(名稱 proposal-visual-aid),SKILL.md 規則
   內容照下方全文(frontmatter 可依 hq 慣例調整,規則不可刪減)
2. 基底範本存為 skill 附件 assets/proposal-visual-base.html(內容在最下方),
   SKILL.md 以相對路徑引用
3. 驗證:以範本渲染一個小示例,headless chromium 截圖確認暗色預設、☀/☾ 切換、
   卡片/流程/wireframe 組件正常
4. 完成後回報 skill 最終位置與觸發方式

## SKILL.md 規則全文

---
name: proposal-visual-aid
description: 在向使用者提出方案、比較選項、報告路線圖或描述 UI/流程時,除了 markdown 回覆外,同步產出一份本地自包含 HTML 視覺輔助(house style 統一)。觸發詞:提案、方案比較、路線圖、架構圖、wireframe、mockup、示意。不適用:純程式問答、單一事實查詢、正式產品 UI 實作(那要用專案自己的設計系統)。
---

# 提案視覺輔助(本地 HTML)

向使用者提出「方案 / 比較 / 路線圖 / 流程 / UI 構想」時,若內容含結構性資訊(多選項取捨、分層架構、畫面佈局、流程步驟),在 markdown 回覆之外**同步產出一份本地 HTML 視覺輔助**。

## 硬性規則

1. **自包含**:單一 HTML 檔,行內 CSS,零外部依賴(無 CDN、無字型下載、無 JS 框架)——離線可開。
2. **本地交付 + 收集空間**:若專案 repo 有 `docs/proposals/`(討論用示意的收集處,檔名 `YYYY-MM-DD-<topic>.html`),寫那裡並提交進版;沒有的話寫 session scratchpad。回覆中**主動給絕對路徑**。永不使用線上 Artifacts。(注意和 `docs/mockups/` 的分工:mockups 放「配合 spec、之後要截圖比對」的功能 mockup;proposals 放「討論/路線圖/方案比較」。)
3. **House style 固定**:一律從本 skill 附帶的 `proposal-visual-base.html` 範本起手 —— 只改內容,不改 tokens。跨專案、跨 session 視覺一致。
4. **暗色為預設**(`<html class="dark">`),右上角保留 ☀/☾ 手動切換。
5. **語言跟隨對話**(使用者慣用 zh-TW 就用 zh-TW)。
6. md 回覆仍是主體(結論、建議、待決點);HTML 是輔助,不取代文字說明。

## 範本組件字彙(base 檔內都有現成 class)

- `.section` + `.num`:編號大節(一個方案/方向一節)
- `.card` / `.card.pick`:選項卡;`.pick` 標推薦項(金色描邊)
- `.badge b-s/b-m/b-l`:規模徽章(S/M/L)
- `.flow` + `.node`/`.node.hot`/`.arr`:流程鏈(hot = 本次改動的關鍵節點)
- `.wire` 套件(`.panel`/`.row`/`.tag`/`.btn`/`table`):wireframe 畫面示意
- `.map .m`:總覽卡列;`.note`:金底提示塊;`.grid g2/g3`:欄位排版

## 何時附 wireframe

只有在「畫面佈局本身是討論對象」時才畫 wireframe(佈局選項、新面板位置、前後對比);純概念取捨用 card + flow 就夠。不要為畫而畫。

## 專案特例

若專案有自己的設計系統(例:rfjs 的 `@rfjs/web-ui` tokens),且產出物是「將實作的 UI mockup」(之後要截圖比對),改用該專案 tokens 取代 house style —— house style 只服務「討論用示意」。


## 附件:assets/proposal-visual-base.html(原樣存檔,{{...}} 是內容佔位)

<!DOCTYPE html>
<html lang="zh-Hant" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{標題}} — {{日期}}</title>
<style>
  /* ===== house tokens — 不要改這一段,只改內容 ===== */
  :root {
    --bg: #f7f7f5; --card: #ffffff; --border: #e4e4e0; --text: #1a1a18; --muted: #6b6b66;
    --accent: #b8860b; --accent-soft: #f5ead1; --ok: #15803d; --ok-soft: #dcfce7;
    --warn: #b45309; --warn-soft: #fef3c7; --info: #1d4ed8; --info-soft: #dbeafe;
    --wire-bg: #fafaf8; --wire-border: #d4d4d0; --code-bg: #f4f4f2;
  }
  .dark {
    --bg: #111113; --card: #1a1a1e; --border: #2e2e33; --text: #e8e8e4; --muted: #9a9a94;
    --accent: #d4a017; --accent-soft: #3a2f14; --ok: #4ade80; --ok-soft: #14361f;
    --warn: #fbbf24; --warn-soft: #3a2e10; --info: #60a5fa; --info-soft: #172a4a;
    --wire-bg: #202024; --wire-border: #3a3a40; --code-bg: #232327;
  }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--bg); color: var(--text); font-family: "Noto Sans TC", system-ui, sans-serif; line-height: 1.65; padding: 40px 20px 80px; }
  .wrap { max-width: 1080px; margin: 0 auto; }
  h1 { font-size: 26px; letter-spacing: .02em; }
  h2 { font-size: 19px; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
  h3 { font-size: 14px; margin: 18px 0 8px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
  .sub { color: var(--muted); font-size: 14px; margin-top: 4px; }
  .toggle { position: fixed; top: 18px; right: 18px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 6px 14px; cursor: pointer; color: var(--text); font-size: 13px; }
  .section { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 26px 28px; margin-top: 26px; }
  .num { display: inline-flex; width: 28px; height: 28px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); align-items: center; justify-content: center; font-size: 15px; font-weight: 700; }
  .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 1px 9px; border-radius: 99px; vertical-align: 2px; }
  .b-s { background: var(--ok-soft); color: var(--ok); } .b-m { background: var(--warn-soft); color: var(--warn); } .b-l { background: var(--info-soft); color: var(--info); }
  .grid { display: grid; gap: 14px; } .g2 { grid-template-columns: 1fr 1fr; } .g3 { grid-template-columns: 1fr 1fr 1fr; }
  @media (max-width: 760px) { .g2, .g3 { grid-template-columns: 1fr; } }
  .card { border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; font-size: 13.5px; }
  .card b { display: block; margin-bottom: 4px; font-size: 14px; }
  .card.pick { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  ul { padding-left: 20px; font-size: 14px; } li { margin: 5px 0; }
  code { background: var(--code-bg); border-radius: 4px; padding: 1px 6px; font-family: ui-monospace, monospace; font-size: 12.5px; }
  .flow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0; font-size: 13px; }
  .flow .node { background: var(--wire-bg); border: 1px solid var(--wire-border); border-radius: 8px; padding: 7px 13px; font-family: ui-monospace, monospace; font-size: 12px; }
  .flow .node.hot { border-color: var(--accent); color: var(--accent); font-weight: 600; }
  .flow .arr { color: var(--muted); }
  /* wireframe kit */
  .wire { background: var(--wire-bg); border: 1px dashed var(--wire-border); border-radius: 10px; padding: 16px; margin-top: 10px; font-size: 12px; }
  .wire .bar { display: flex; gap: 6px; margin-bottom: 10px; }
  .wire .chip { border: 1px solid var(--wire-border); background: var(--card); border-radius: 6px; padding: 3px 10px; }
  .wire .chip.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); font-weight: 600; }
  .wire .panel { border: 1px solid var(--wire-border); background: var(--card); border-radius: 8px; padding: 10px 12px; margin-top: 8px; }
  .wire .row { display: flex; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px dotted var(--wire-border); }
  .wire .row:last-child { border-bottom: none; }
  .wire .cell { flex: 1; } .wire .tag { border: 1px solid var(--wire-border); border-radius: 4px; padding: 0 6px; font-size: 10.5px; color: var(--muted); }
  .wire .tag.k { color: var(--info); border-color: var(--info); }
  .wire table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .wire th, .wire td { border-bottom: 1px solid var(--wire-border); padding: 4px 8px; text-align: left; font-weight: normal; }
  .wire th { color: var(--muted); font-size: 11px; }
  .wire .btn { display: inline-block; border: 1px solid var(--wire-border); background: var(--card); border-radius: 6px; padding: 3px 12px; }
  .wire .btn.p { background: var(--accent); color: #fff; border-color: var(--accent); }
  .cols { display: grid; grid-template-columns: 300px 1fr; gap: 14px; } @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
  .dep { font-size: 12.5px; color: var(--muted); margin-top: 8px; }
  .map { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
  .map .m { flex: 1 1 180px; border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; font-size: 13px; }
  .map .m b { display: block; font-size: 14px; }
  .map .m span { color: var(--muted); font-size: 12px; }
  .hr { border: none; border-top: 1px solid var(--border); margin: 18px 0; }
  .note { background: var(--accent-soft); border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-top: 12px; }
</style>
</head>
<body>
<button class="toggle" onclick="document.documentElement.classList.toggle('dark')">☀ / ☾</button>
<div class="wrap">
  <h1>{{標題}}</h1>
  <p class="sub">{{日期}} · {{一句話說明這份示意在回答什麼}}</p>

  <!-- 總覽卡列(可選) -->
  <div class="map">
    <div class="m"><b>{{項目}}</b><span>{{狀態/一句話}}</span></div>
  </div>

  <!-- 每個方案/方向一個 section -->
  <div class="section">
    <h2><span class="num">①</span> {{方案名}} <span class="badge b-m">M</span></h2>
    <p class="sub">{{目標一句話}}</p>

    <div class="flow">
      <span class="node">{{輸入}}</span><span class="arr">→</span>
      <span class="node hot">{{本次改動的關鍵}}</span><span class="arr">→</span>
      <span class="node">{{輸出}}</span>
    </div>

    <h3>選項比較</h3>
    <div class="grid g3">
      <div class="card pick"><b>A. {{推薦項}}(推薦)</b>{{理由}}</div>
      <div class="card"><b>B. {{替代}}</b>{{取捨}}</div>
    </div>

    <!-- 佈局是討論對象時才用 wireframe -->
    <div class="wire">
      <div class="panel"><b>{{面板名}}</b>
        <div class="row"><span class="cell">{{內容}}</span><span class="tag k">{{標記}}</span></div>
        <div style="margin-top:8px"><span class="btn p">{{主按鈕}}</span> <span class="btn">{{次按鈕}}</span></div>
      </div>
    </div>
  </div>

  <p class="sub" style="margin-top:26px">{{建議順序 / 待決點}}</p>
</div>
</body>
</html>

````

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
