# Metadata Builder 視覺輪(C 案 Studio)— 設計規格

日期:2026-07-11
分支:`feat-metadata-studio`(worktree,基於含 #242 的 main @ `2079348`)
狀態:方向已與使用者確認 —— 三方向 mockup(`docs/mockups/2026-07-11-metadata-builder-visual-directions.html`)選 **C · Studio 分割檢視**;RWD 與收合行為已議定(見 §3/§4)。**純視覺/互動改造,功能與資料模型零改變。**

## 目標

把 `/tools/metadata-builder` 從「裸 input 表格 + 兩塊 JSON 硬擠」改造成 **Studio 分割檢視**:

```
≥ lg                                        < lg
┌─────────────┬──────────────┐              ┌──────────────────────┐
│ 欄位清單     │ 程式碼面板    │              │ 欄位清單 + inspector  │
│ + inspector │ meta/schema/ │      →       ├──────────────────────┤
│             │ 試篩(永亮)  │              │ ▸ 產物面板(收合列)   │
└─────────────┴──────────────┘              └──────────────────────┘
```

- 左 = 欄位清單(緊湊列:key、型別、kind pill、旗標徽章)+ 點選展開的 **inspector**(單欄位編輯)
- 右 = **程式碼面板**(meta.json / schema / 試篩 三頁籤,永亮、可收合)
- 「編輯 ↔ 產物」因果可視:選中欄位時,meta.json 頁籤只顯示**該欄位的 JSON 片段**;未選取顯示整份

## 不變式(紅線)

- **資料模型與功能零改變**:`model.ts`(`metaToRows`/`rowsToMeta`/label 雙語/`DEFAULT_META`)、localStorage 行為、匯入/匯出、zod 閘、protocol/import 面板的功能語義全部不動
- meta.json 反推(匯入→重建編輯面)照舊 —— 視覺只是投影,架構保證
- 紅線目錄照舊:`src/tools/table-builder/**`、`app/api/**`(平行 session)、engine 套件、workbench、form-builder 系零改動
- i18n en/zh-TW parity;`@rfjs/web-core` 不動(registry 條目已存在);apps 不寫 changeset —— **本輪預期零 changeset**(只動 apps/web)

## 1. 版面結構(ui.tsx)

- 三個編輯頁籤(Fields / Protocol / Import)保留,但 **Fields 頁籤的內容變成分割檢視**;Protocol/Import 維持現有面板(全寬,程式碼面板照樣在右/在下)
- 分割:`lg:grid-cols-[minmax(320px,1fr)_minmax(380px,1fr)]`;`< lg` 直疊(編輯區在上、程式碼面板為收合區塊)
- 程式碼面板是**跨頁籤常駐**的(取代現在頁面底部的 derived-preview 區)

## 2. 欄位清單 + inspector(fields 區重構)

### 2.1 清單列(compact row)

每列:行號(mono 淡色)、`key`(mono 粗體;巢狀路徑加小字註記)、dataType(淡色 mono)、**kind pill**(column=青、jsonb=紫、未指定=虛線灰 pill「kind —」)、旗標徽章(sortable/filterable,金色小徽章,僅在 true 時顯示)、enum 欄加 `enum·N` 徽章。列尾刪除鈕(hover 顯示)。

- 點列 = 選中(`aria-selected`,金色底高亮);再點不取消(常駐選取,Esc 或點其他列切換)
- 「+ 欄位」在清單底部;新增後自動選中新列並聚焦 inspector 的 key 輸入
- key 重複/空白:列上紅點 + 清單下方彙總條(沿用現有驗證邏輯,只換呈現)

### 2.2 inspector(選中欄位的編輯器)

清單下方(同左欄內,`border-t` 分隔),eyebrow 顯示 `INSPECTOR · <key>`:

- label en / zh-TW 雙輸入(同現況)
- dataType / format / kind:**segmented 控制**(取代 select;format 選項依 dataType 過濾,不相容自動清除 —— 邏輯不變)
- sortable / filterable:checkbox(帶文字 label)
- enum options 子編輯器:在 inspector 內展開(value + label 雙語成對、增刪)—— 不再是表格列裡的浮動塊
- 無選取時顯示空狀態提示(「選擇或新增一個欄位」)
- segmented 控制 `flex-wrap`(窄幅防擠)

### 2.3 可及性契約(測試依賴)

- 清單列 `role="option"` 於 `role="listbox"` 容器(或 button+aria-selected —— 以實作簡潔為準,擇一並在 plan 固定)
- inspector 的每個輸入維持可被 `getByLabelText`/`getByDisplayValue` 找到;既有 fields-panel 測試改寫為「選中列 → inspector 編輯」流,**斷言強度不得降**(增刪改、format 清除、key 驗證、options 編輯全數保留)

## 3. 程式碼面板(derived-preview 重構)

- 三頁籤:**meta.json / schema / 試篩**(mono 小頁籤,active 金色底線)
- 標題列右側:Copy / 下載 / Reset(現有行為)+ **收合鈕**
- **選中欄位 ↔ 片段高亮**:meta.json 頁籤在有選中欄位時只渲染該欄位的 JSON 物件(頂部小字「顯示選中欄位;點空白處看整份」或提供「整份」切換);schema 頁籤同理(選中欄位若在 schema 中,高亮/僅顯示該項)。無選取=整份
- JSON 輕量著色:key 藍、字串值綠、標點淡(CSS class,非引入語法庫 —— 自寫簡單 tokenizer 或以 `JSON.stringify` 分段包 span;plan 定案作法)
- 試篩頁籤:現有 FilterTreeEditor + 空 schema 提示,原樣搬入
- `<pre>` 保留 `overflow-auto` + 最大高;等寬 11.5px

## 4. 收合與 RWD

- **≥ lg 收合**:收合鈕把右欄縮成窄直條(約 40px,僅展開鈕 + 直排「CODE」字樣),左欄吃滿;再點展開
- **< lg**:程式碼面板整塊移到編輯區下方,變成收合區塊(標題列含當前頁籤名),**預設收合**
- 收合狀態存 localStorage(key:`rfjs.metadata-builder.code-open`;比照 `AI_BLOCK_OPEN_KEY` 慣例,SSR 安全 —— 讀取放 effect)
- 斷點用 Tailwind `lg:`;segmented/徽章 `flex-wrap`;JSON `overflow-x-auto` 為最後防線

## 5. i18n

新增鍵(en/zh-TW 同步,`mb` 前綴):`mbInspectorTitle`、`mbInspectorEmpty`(「選擇或新增一個欄位」)、`mbCodeMeta`/`mbCodeSchema`/`mbCodeTry`(頁籤名)、`mbCodeCollapse`/`mbCodeExpand`、`mbShowAll`(「整份」切換)、`mbFieldCount`(彙總條;若含 {n} 佔位則用 `t()` 帶值,不可裸取)。既有鍵沿用;被版面淘汰的鍵(若有)一併移除(兩語系同步刪)。

## 6. 測試與驗證

| 層 | 內容 |
|---|---|
| fields 區 | 既有 5 條語義全數改寫保留(選中→inspector 流)+ 新增:選中高亮、無選取空狀態、新增自動選中 |
| 程式碼面板 | 頁籤切換;選中欄位→meta 片段模式/整份切換;收合→展開(含 localStorage 持久);Copy/下載/Reset 回歸 |
| ui | 頁籤(Fields/Protocol/Import)與程式碼面板常駐;既有 7 條 ui.spec 語義保留(斷言選擇器隨版面調整,不得刪弱);匯入後自動選取第一列(或維持無選取 —— plan 定案) |
| e2e | 既有 1 條保留(試篩投影 —— selector 隨新版面調);新增 1 條:選中欄位 → 程式碼面板顯示該欄位片段 |
| 真渲染 | light/dark 截圖:分割檢視(有選取)、收合態、**900px 窄幅直疊態** —— 對照 mockup C 段檢視 |

## 7. 明確不做

- Protocol/Import 面板的視覺重造(保持現況;只有容器版面隨分割調整)—— 它們不是這輪的痛點
- 拖曳調整分割比例、欄位拖曳排序、meta diff 視圖 —— future
- AI 區塊(另一輪)

## 8. 慣例

- 零 changeset(僅 apps/web);commit 英文 conventional + trailer;HOLD PR;e2e `E2E_PORT=3013`;與 #14 平行 session 檔案零交集照舊
