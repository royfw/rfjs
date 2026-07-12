# table-builder「資源為中心(Z)」遠端資料來源 UX — 設計

- 日期:2026-07-12
- 狀態:設計待審
- 前置:① `@rfjs/data-schema-ui`(同日 spec)先 merge —— 本輪消費它的 `ProtocolPanel`
- Mockup:`scratchpad/2026-07-12-table-builder-resource-centric-Z.html`(z-01.png)

## 一句話

把 table-builder 的資料來源從兩層混淆的心智模型(「靜態 vs 遠端」×「記憶體 vs HTTP」)收成單一心智模型:**一份資源(DataResourceMeta,± 協定)+ 怎麼預覽(離線範本 / live 呼叫)**;並補上「Import meta.json」把 metadata-builder 產出的資源接進來。

## 問題(現況)

`apps/web/src/tools/table-builder/`(#249 後):
- `SourceMode = "rows" | "remote"`;remote 時另有 `transport: 'memory' | 'http'` 一排。使用者要同時懂「rows/remote」與「memory/http」兩層,語意重疊(remote+memory 到底是什麼?)。
- 命名不誠實:曾經「假 fetcher」;現在 memory 分支其實是「對範本 rows 在記憶體模擬協定」,http 是「真打 endpoint」——但 UI 用 memory/HTTP 這種 transport 術語表達,讀者無法一眼理解。
- 無「Import meta.json」:metadata-builder 產出的 `DataResourceMeta` 無法直接餵進 table-builder(只能貼 rows / 或用寫死的 `SAMPLE_META`)——往返橋缺一半。

## 目標模型(Z)

頂層概念改為「**資源**」——一份 `DataResourceMeta`(`fields` + 選配 `request`/`response`):

| 現況 | Z |
|---|---|
| `SourceMode = "rows"` | **無協定的資源**(只有 rows,純靜態) |
| `remote` + `memory` | **有協定的資源** + 預覽「**範本資料(離線)**」 |
| `remote` + `http` | **有協定的資源** + 預覽「**呼叫端點(live)**」 |
| (新) | **Import meta.json** seed 一份 DataResourceMeta(fields + 協定) |

規則:
- **有協定**(request/response 存在)= 可查詢資源 → 預覽可選「離線(對範本 rows 模擬此協定)」或「live(真打 endpoint)」。
- **無協定** = 純靜態資源 → 只能離線預覽貼入的 rows(無 live 選項,因為沒有 endpoint)。協定區顯示「+ 加上協定」把它升級成可查詢資源。

## UI 形狀(Resource 分頁)

Resource 分頁(取代現在的 source 面板)由上而下:
1. **Seed —— 這份資源從哪來**:三選一 chip
   - `⤓ Import meta.json`:貼/上傳一份 `DataResourceMeta`(zod gate = `parseDataResourceMeta`)→ 帶入 fields + request + response。**這就是 metadata-builder → table-builder 的橋。**
   - `貼 rows(JSON/CSV)`:沿用現有 import panel(papaparse + `inferFieldsFromRows`)→ 無協定資源。
   - `從零 author`:空白資源(現有 SAMPLE 起手)。
2. **Protocol**:有協定時嵌 `<ProtocolPanel showEnableToggle={false}>`(來自 ①);無協定時顯示「+ 加上協定」。
3. **Fields**:摘要(N 欄),詳編仍在 Columns 分頁。
4. **Preview 取數方式**:單一 segmented —— `範本資料(離線)` / `呼叫端點(live)`(= 舊 transport memory/http 的誠實改名)。無協定時鎖在離線、隱藏 live。

其餘分頁(Columns / Pagination / Metadata)與 always-on preview 表格不變。Metadata 分頁仍顯示/匯出這份(可能已編輯的)資源 meta.json。

## 變更清單(apps/web only)

- **model / state**:移除 `transport: 'memory'|'http'` 獨立旗標,改 `preview: 'offline' | 'live'`(僅有協定時可切 live)。`SourceMode` 概念收成「資源有無協定」——以 `request`/`response` 是否存在表達(可能保留一個內部 boolean,實作細節)。
- **source memo**:`preview==='live' ? makeHttpFetcher(request) : makeFakeFetcher(rows, columns, fields)`(沿用現有兩個 fetcher;只是入口改名/收斂)。無協定資源 → `TableSource {kind:'rows', rows}`。
- **Import meta.json**:新增 seed 分支,`parseDataResourceMeta` 驗證 → set fields/request/response;沿用 metadata-builder `import-panel` 的 meta 模式邏輯(可抽共用或複製精簡)。
- **i18n**:Seed 三選一、Preview「範本資料(離線)/呼叫端點(live)」、「+ 加上協定」等文案(en + zh-TW);沿用共享 `ToolUI` namespace,`{count}` 類用 `t.raw`。
- **概念層說明**:資源/協定/離線-live 的整體解釋走 `<ToolIntro>`(見 spec ③,同 apps/web PR),本輪只保留欄位/面板級微提示;不重複解釋。
- **ProtocolPanel** 來源改 `@rfjs/data-schema-ui`(① 落地後)。
- 無 packages 變更 → 無 changeset。

## 明確不做
- 不動執行引擎 / fetcher 實作(`makeHttpFetcher` / `makeFakeFetcher` 行為不變,只是入口語意收斂)。
- 不做「table-builder 匯出 meta.json 讓 metadata-builder 反向 import」以外的往返(Metadata 分頁的匯出已存在)。
- 不做整頁視覺向 metadata-studio 靠攏(另一輪 deferred)。
- 不碰 metadata-builder(它仍是 fields-first 從零 author 的權威;table-builder 偏 import/消費 + 微調)。

## 驗收
- Resource 分頁三種 seed 皆可用;import meta.json 帶入 fields+協定並正確預覽。
- 有協定資源可切離線/live;live 真打 `/api/query/sample` → ConfigTable 渲染;離線對範本 rows 模擬。
- 無協定資源只顯示離線、無 live、有「+ 加上協定」。
- `pnpm -F web check-types && lint && test` 全過;既有 table-builder 測試更新後全綠。
- 截圖:三 seed、有/無協定兩態、離線/live 切換。

## 分工提醒
metadata-builder = 從零 author(fields-first、匯出 meta.json);table-builder = import/消費為主 + 可微調協定 + 建表格 config + 預覽。兩者共用 `@rfjs/data-schema-ui` 的 `ProtocolPanel`。
