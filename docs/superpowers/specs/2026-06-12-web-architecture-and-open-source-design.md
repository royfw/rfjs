# Web 架構與開源策略決策

日期：2026-06-12
狀態：已定案（執行中）

## Context

rfjs 有三個對外管道：start-ts-by CLI（從本 repo 抓 templates）、`@rfjs/*` npm 套件（11 個已發佈）、apps/web 展示站。repo 原為 private，與這三個管道的目的存在結構性矛盾：

- `templates/registry.json` 的 `"repo": "royfw/rfjs"` 指向本 repo —— repo private 時，公開發佈的 start-ts-by CLI 實際上只有作者本人能用。
- npm 套件頁沒有 repository 連結、沒有 issue tracker，原始碼不可見，是採用信任的硬性天花板。
- apps/web 投資雙語展示與 playground 以推動採用，但訪客無法從網站走到原始碼。

同時出現的新構想：admin/dashboard 形態的工具平台（workbench），可匯入測試資料集、組合套件功能，未來可能朝產品（如 BPM 工具）發展 —— 引發「公開後是否失去獨特性」的疑慮。

## Decisions

1. **apps/web 資訊架構**：tools/playground 改以功能分類（transform / filter / query / inspect）為主導覽，package 降為 badge + 篩選；`/packages/[slug]` 詳細頁保留套件視角入口。
2. **工具平台**：在本 monorepo 新增 app（暫名 `apps/workbench`），admin/dashboard layout，workspace 依賴 `@rfjs/web-ui`、`@rfjs/web-core` 與全部套件。不替換 apps/web、不另開專案。
3. **rfjs 轉公開**：repo 從 private 改為 public（前置 checklist 見下）。
4. **templates 留在 rfjs**：既然公開，無需抽出獨立的 start-ts-templates repo。
5. **未來產品（BPM 等）**：啟動時直接另開 private repo，從 npm 消費 `@rfjs/*`，不在 rfjs 內孵化。

## 分層紅線（程式碼放哪邊的判準）

- **通用能力**（任何系統都用得上：filter、expression、query 生成、retry、transform）→ `@rfjs/*` 公開套件。其價值在被使用，保密只有壞處。
- **領域理解**（BPM 流程模型、工作流編排邏輯、特定領域 UX 決策）→ private 產品 repo。這才是獨特性的實際形體。
- workbench 只收 demo 與通用工具；某工具長出領域邏輯時「畢業」到產品 repo，不在 rfjs 內繼續長。

## Rationale

- **功能分類優先**：訪客的任務模型是「我要 decode JWT」而非「我要看 @rfjs/jwt」；且 tool 對 package 是多對多（`object-transformer` 已屬兩個套件），`lib/nav.ts` 的 `claimed` 去重邏輯即是 package-primary 處理不了多對多的訊號。主分類對齊使用者任務，package 維度用 badge/filter 保留。
- **workbench 進 monorepo**：共用 TS 邏輯的既定流動模式是「工具 → 抽成 `@rfjs/*` 套件 → 工具吃回套件」。獨立 repo 會在這條最熱路徑上加 npm publish round-trip 稅；workspace 內抽取與消費是同一個 commit 的事。套件「workspace 孵化、成熟發佈」也是本 repo 既有模式（web-core、web-ui）。
- **公開**：529 commits 全歷史掃密乾淨（token pattern、歷史 .npmrc、連線字串、硬編碼密碼、JWT fixture 逐項檢查）；套件內容本來就已在 npm 上公開；雙語 README + 測試齊全，整備度足夠。private 真正保護的只剩應用層，而應用層現階段的任務是展示。
- **獨特性**：構思（admin/data-tools 網站）非稀缺品，保密不構成護城河；真正的護城河是生態整合（公開才會長大）、個人信譽（公開才看得見）、與未來產品層（屆時用 private repo 保護）。Open-core 標準解法：commodity 層開放、差異化層保留。
- **產品期的迭代稅可接受**：到產品啟動時，套件層已被作品集階段磨成熟，產品對套件的改動頻率自然下降，cross-repo 成本屆時遠低於現在。

## Pre-public checklist

- [x] 手動全歷史掃密（token / .npmrc / 連線字串 / password / JWT / Bearer / URL）
- [ ] gitleaks 正式終掃（手動掃描的 belt-and-suspenders）
- [x] 根目錄 LICENSE（ISC）
- [x] 11 個套件補 `repository` / `bugs` / `homepage` / `keywords`（隨下次 release 反映到 npm）
- [x] pg-toolkit README 標題修正（`@packages/` → `@rfjs/`）
- [ ] 按下 public
- [ ] 公開後驗證：release workflow 對 `royfw/rf-devops`（private）reusable workflow 的呼叫仍可解析（本就計畫遷移至 github-toolkit，可一併處理）

## Future triggers

- workbench 內某工具開始編碼領域邏輯 → 抽出至 private 產品 repo。
- `royfw/rf-devops` 遷移 `github-toolkit` 時 → 重新指向 caller workflows 並確認公開 repo 的存取設定。
