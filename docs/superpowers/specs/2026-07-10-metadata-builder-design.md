# Metadata Builder 工具 — 設計規格

日期:2026-07-10
分支:`feat-metadata-panel`(worktree,基於含 #240 的 main @ `a9af611`)
狀態:設計已與使用者確認(掛載改為 apps/web 新工具 —— workbench 無場景,等 #13;label 採 en/zh-TW 雙欄編輯)

## 目標

給 `@rfjs/data-schema` 一個自己的 showcase 工具:**`/tools/metadata-builder`(資源綱要設計器)** —— authoring 一份 `DataResourceMeta`(欄位的 kind/dataType/filterable/format/enum 值域 + request/response 協定),匯入/匯出 meta.json(與 #239 匯出格式互通),並即時預覽衍生產物(`FieldSchema[]` + 可試篩的 FilterTreeEditor)。

定位:metadata 的**authoring 面**。infer 推不出的三樣(`kind`、完整 enum 值域、治理決策如 filterable)在這裡人工宣告;「infer 起手、author 補完」是核心故事。

## 非目標(明確不做)

- **AI 區塊** —— 下一輪照 filter/form/table 的既有模式補(NL→meta + `parseDataResourceMeta` 驗證閘)
- **後端儲存** —— localStorage 即可;DB 化的治理層留給未來 BPM/資料治理 repo
- **共用代碼表/字典(`optionsRef`)** —— 等第二個共用消費者
- **任意語系的 label map 編輯器** —— v1 只給 en/zh-TW 雙欄(見 §3.2),其他語系鍵匯入時原樣保留
- **workbench 掛載** —— 探索頁無場景(#13 未定);面板組件形狀保持可日後升格複用
- **「試打 endpoint」鈕** —— 等 #14(HTTP fetcher)合流後的便宜增量
- 紅線:**不碰 `apps/web/src/tools/table-builder/**`(平行 #14 session 所有)**、`apps/workbench/**`、所有引擎套件(`data-schema`/`filter-builder`/`table-builder*` 純消費零改動)、form-builder 系

## 1. 工具骨架與註冊

- 新目錄 `apps/web/src/tools/metadata-builder/`:`index.ts`(ToolModule 描述)、`ui.tsx`(`"use client"`)、純邏輯模組、`messages.ts`(en/zh-TW)、co-located specs —— 照既有工具慣例
- `@rfjs/web-core` `toolRegistry` 加一筆:`id: 'metadata-builder'`、category `data-schema`(若 category 需新增就一併加)、`surface: 'web'`、`relatedPackages: ['@rfjs/data-schema']`;nav 由 registry 自動衍生
- web-core 是 package → 照政策補 changeset(私有,version-only,patch)

## 2. 版面(沿用 #239 B-layout 慣例)

mockup:`docs/mockups/2026-07-10-metadata-builder.html`(已使用者確認)

- eyebrow → 編輯頁籤列(segmented,同 form/table-builder 視覺):**欄位 Fields / 協定 Protocol / 匯入 Import**,預設 Fields
- 頁籤下方 = 當前面板全寬
- **恆在下方:衍生產物預覽**(不進頁籤):左 = 完整 `DataResourceMeta` pretty JSON + Copy + 下載 `meta.json` + Reset 預設樣本;右 = `fieldsToFilterSchema(meta.fields)` 的 `FieldSchema[]` JSON(該函式 import 自 `@rfjs/table-builder-ui` —— #240 已有,web 已在 transpilePackages)+ 一個吃該 schema 的即時 `FilterTreeEditor`(`engineId="pg-filter"`,編輯示範用、不執行查詢)

## 3. 欄位編輯器(Fields 頁籤)

### 3.1 欄位列

每列對應一個 `DataFieldMeta`:`key`(text,唯一)、`label`(見 §3.2)、`dataType`(select:string/numeric/date/boolean)、`format`(select,依 dataType 過濾:numeric→integer/decimal/percent/currency;date→date/datetime/time;其他→無)、`sortable`/`filterable`(checkbox)、`kind`(select:—/column/jsonb)、options 開合鈕(見 §3.3)、刪除鈕;底部「+ 欄位」。

列有穩定的 UI id(`crypto.randomUUID()`,不進 meta)—— 編輯模型是 `FieldRow = { id } & DataFieldMeta 的可編輯投影`,純邏輯模組提供 `metaToRows` / `rowsToMeta` 雙向轉換(單一真相是 meta,rows 是編輯投影)。

### 3.2 label 雙語規則(en / zh-TW 雙欄)

- label 給兩個輸入框(en、zh-TW,與 app 語系集合一致)
- **存回規則**:兩欄都有值且不同 → `{ en, 'zh-TW' }` map;只有一欄有值 → 純字串;兩欄同值 → 純字串
- **保留規則**:匯入的 label 若是 map 且含其他語系鍵(如 `ja`),編輯只覆寫 `en`/`zh-TW` 兩鍵,**其他鍵原樣保留**;原值是純字串時顯示在 en 欄
- enum options 的 label 同規則

### 3.3 enum options 子編輯器

- 每列可展開 options 區(value + label(雙語同 §3.2)成對,增刪)
- options 為空陣列時存回 meta 省略該鍵(不寫 `options: []`)

### 3.4 欄位級驗證(即時)

- key 重複 → 該列標紅 + 錯誤條(不阻擋編輯,但阻擋匯出/複製?**不阻擋** —— 匯出前跑 `parseDataResourceMeta`,它不驗 key 唯一性;key 重複只是 UI 警告)
- format 與 dataType 不相容 → dataType 變更時自動清掉不相容 format(select 本來就只列相容項,此規則處理「dataType 事後改」)
- key 空白 → 該列標紅,且 `rowsToMeta` 略過空 key 列(半成品列不進 meta)

## 4. 協定編輯器(Protocol 頁籤)

- 「啟用 request/response」總開關(純靜態資源可以只有 fields —— 契約裡 request/response 是 optional);關閉時 meta 不含這兩鍵
- request:`endpoint`(text)、`method`(GET/POST segmented)、`pagination`(offset/page/cursor 三型 segmented,各自的參數名輸入;page 型含 `firstPage` 0/1)、`sort`(無/single/split;single 含 encoding colon/signed)、`filter`(無/pg;pg 含 param)
- response:`rowsPath`、`totalPath`、`cursorPath`(均 text,後兩者選填)
- 全部即時寫回 meta;顯示層驗證交給 §6 的 zod 閘

## 5. 匯入(Import 頁籤)

- 模式 segmented:**meta.json** / **樣本 rows(infer 起手)**
- meta.json:貼上(textarea)或上傳 `.json` → `parseDataResourceMeta` 驗證 → 成功整份取代目前 meta(含 request/response);失敗顯示 zod 錯誤訊息、state 不動
- 樣本 rows:貼上 JSON array-of-objects → `inferFieldsFromRows` 產 fields(**只取代 fields,保留現有 request/response**);之後回 Fields 頁籤補 kind/options
- 兩種匯入成功後都自動切到 Fields 頁籤(讓使用者看到結果)

## 6. 資料流與持久化

```
meta(單一真相,useState)
  ├─ metaToRows → Fields 編輯 → rowsToMeta ─┐
  ├─ Protocol 編輯(直接寫 request/response)├→ setMeta → 即時反映到預覽
  ├─ Import(取代整份或 fields)────────────┘
  ├─ useEffect → localStorage 寫入(key: 'rfjs.metadata-builder.meta')
  └─ 初始:掛載後從 localStorage 讀(SSR 安全:讀取放 effect,首繪用預設樣本);Reset 鈕清 localStorage 回預設
```

- 預設樣本:一份與 table-builder 工具 `SAMPLE_META` **同形但獨立定義**的 meta(含 kind/filterable/enum,示範完整能力;不 import 該工具的檔案 —— 紅線)
- 匯出:Copy(clipboard,try/catch)+ 下載 `meta.json`(Blob,比照 #239);匯出內容 = `parseDataResourceMeta(meta)` 正規化後的 JSON(zod 是唯一真相閘)
- localStorage 讀出的內容也過 `parseDataResourceMeta`,壞資料靜默丟棄回預設(防手改)

## 7. 錯誤處理

- 匯入壞 JSON / 壞 schema → 錯誤條顯示訊息,state 不動
- localStorage 損毀 → 靜默回預設
- 匯出時 meta 過不了 zod(理論上不會 —— 編輯器只產合法形):錯誤條 + 不下載
- FilterTreeEditor 對空 schema(沒有任何 filterable+kind 欄位)→ 顯示提示「宣告 filterable 且指定 kind 的欄位後可在此試篩」

## 8. 測試

| 層 | 內容 |
|---|---|
| 純邏輯 | `metaToRows`/`rowsToMeta` 雙向(含空 key 略過、options 空省略);label 雙語規則(map↔雙欄、其他語系鍵保留、同值收斂為字串);format×dataType 自動清理 |
| ui.spec | 頁籤切換 + 預覽恆在;欄位增刪改 → 預覽 JSON 反映;kind 勾選 → FieldSchema 預覽出現該欄;匯入合法 meta 取代、非法顯錯不動;infer 起手只換 fields;localStorage 往返(mock);Copy/下載(mock,比照 #239 metadata-panel 測試) |
| e2e | 一條:宣告一個 filterable+kind 欄位 → 下方 FilterTreeEditor 的欄位下拉出現它 |
| 真渲染 | `next build` + start + light/dark 截圖:三頁籤各一張 + 預覽區(對照 mockup 檢視) |

## 9. 慣例

- Changesets:`@rfjs/web-core` patch(registry 一筆);引擎零改動無 changeset;apps 不寫
- i18n en/zh-TW 同步增鍵(`mb*` 前綴);含佔位的訊息注意 t.raw 陷阱(本工具預期無模板訊息)
- Commit/PR 英文 conventional + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;HOLD PR;e2e `E2E_PORT=3013`
- 與 #14 session 的邊界:本輪絕不觸碰 `apps/web/src/tools/table-builder/**` 與 `apps/web/src/app/api/**`;共用檔(`@/i18n/messages` 聚合、web-core registry)只做加法

## 10. Future(僅記錄)

- AI 區塊(NL→meta);「試打 endpoint」鈕(#14 合流後);面板組件升格至 workbench/BPM repo(#13/場景定案後);共用代碼表;label 任意語系編輯
