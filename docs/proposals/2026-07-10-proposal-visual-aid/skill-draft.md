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
- `.who w-here/w-peer/w-bg/w-wait`:分派/歸屬徽章(誰做、等待中)

## 何時附 wireframe

只有在「畫面佈局本身是討論對象」時才畫 wireframe(佈局選項、新面板位置、前後對比);純概念取捨用 card + flow 就夠。不要為畫而畫。

## 專案特例

若專案有自己的設計系統(例:rfjs 的 `@rfjs/web-ui` tokens),且產出物是「將實作的 UI mockup」(之後要截圖比對),改用該專案 tokens 取代 house style —— house style 只服務「討論用示意」。
