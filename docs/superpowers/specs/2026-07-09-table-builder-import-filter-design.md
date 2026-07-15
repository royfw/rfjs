# table-builder:靜態資料匯入 + 執行時記憶體篩選 — 設計規格

日期:2026-07-09
分支:`feat-table-import-filter`(獨立 worktree,基於含 #237 的 `origin/main`)
狀態:已與使用者逐段確認

## 目標

延續 #237(data-schema / table-builder / table-builder-ui + 工具),讓「表格」從罐頭 demo 變成能用的東西,補兩件事:

1. **A — 靜態資料匯入**:table-builder 工具的 Source 面板能貼上 / 上傳 **JSON 或 CSV**,自動推出欄位 → 配置 → 預覽。
2. **B/C — 執行時記憶體篩選**:篩選是**表格自帶的功能**(不是建構器的預覽旋鈕)—— 配置進 `TableConfig`、由 `<ConfigTable>` 渲染出一個收合式篩選器,**看表格的人**操作;靜態資料靠 `@rfjs/data-filter`(經 `runLiveMatch`)在記憶體過濾。表格嵌到哪(工具預覽、未來 result item `mode:'table'`、真 app),篩選能力就跟到哪。

## 非目標(明確不做,排下一輪)

- **api filter(遠端篩選)**:filter tree → API 請求參數的「搜尋編碼契約」是**下一輪**,而且要接**真的 workbench `/datasets/query` API**(它本來就吃 filter-builder 的 pg-filter tree)來定契約,不憑空造通用引擎。本輪遠端 source 的篩選器**停用**並標註。
- **篩選持久化**:v1 執行時的 filter tree 是「看的人當下建的」ephemeral session state,**不存進 `TableConfig`**(YAGNI;日後要「表格帶預設篩選」再加 `defaultFilter`)。
- **每欄快速篩選列**:v1 篩選 UI 用完整 tree 編輯器(複用 filter-builder-ui);輕量每欄列留待日後。
- 不碰 `packages/form-builder*/**`、`apps/web/src/tools/form-builder/**`。

## 架構 / 套件邊界

```
@rfjs/table-builder (engine, 可發布)
  · TableColumnConfig 加 filterable?: boolean(選填)
  · deriveTableConfig 把 DataFieldMeta.filterable 帶到 column(目前是丟掉的)
  · engine 不依賴 filter-builder,發布面保持乾淨;不在 config 存 filter tree

@rfjs/table-builder-ui (private, transpilePackages)
  · 新增 deps:@rfjs/filter-builder + @rfjs/filter-builder-ui
  · <ConfigTable> 上方多一個收合式「Filter」區 = FilterTreeEditor
  · useConfigTable 長出 filter tree state + 套用

apps/web table-builder 工具
  · Source 面板:貼上 textarea + 上傳 .json/.csv + JSON/CSV 切換
  · Columns 面板:每欄加「Filter」勾選(改 column.filterable)
  · 預覽區:就是上面那個帶 Filter 的 <ConfigTable>
```

**視覺基準**:`docs/mockups/2026-07-09-table-builder-import-filter.html`(注意:mockup 把 Filter 畫成獨立區塊示意;實作上它是 `<ConfigTable>` 內、表格上方的收合區,跟著表格走)。

## 1. Engine 變更(`@rfjs/table-builder`)

- `TableColumnConfig` 加 `filterable?: boolean`(選填;zod `z.boolean().optional()`)。**這是 additive** —— 凍結的 `TableConfig` 形狀不被破壞,result item 的 `table?: unknown` 透傳不受影響。
- `deriveTableConfig`:欄位映射時,若 `field.filterable !== undefined` 則帶到 column(比照現有 `sortable` 的條件展開)。
- changeset:`@rfjs/table-builder` **minor**。

## 2. Renderer 變更(`@rfjs/table-builder-ui`)

### 2.1 依賴 / 型別

- `package.json` deps 加 `@rfjs/filter-builder`(workspace:*)、`@rfjs/filter-builder-ui`(workspace:*)。
- column → filter schema 映射(新小函式,純):

```ts
// filterable columns → filter-builder FieldSchema[]
function columnsToFilterSchema(columns: TableColumnConfig[]): FieldSchema[] {
  return columns
    .filter((c) => c.filterable)
    .map((c) => ({ path: c.key, dataType: c.dataType, include: true, kind: "column" as const }));
}
```

（`ScalarType`(table-builder/data-schema)與 filter-builder `FieldType` 是同一套字彙,`dataType` 1:1 直接帶;scalar 欄無 `elementType`。）

### 2.2 `useConfigTable` 加篩選 state(靜態路徑)

- 用 filter-builder-ui 的 `useFilterTree({ schema })` 持有 `tree`/`setTree`(schema 由 `columnsToFilterSchema(config.columns)` 產生,columns 變更時 `setSchema` 同步)。
- 靜態 source 的 rows pipeline 變成:**先 `runLiveMatch(rows, tree)` 過濾 → 再走既有 sort + slice 分頁**。
  - `runLiveMatch` 回 `{ matched, count, uncoverable }`。過濾後的 `matched` 當作 sort/paginate 的輸入;`total = count`;`filter 變更 → 回第一頁`。
  - `uncoverable: true`(tree 用了 data-filter 不支援的運算子)→ 不當成「0 筆」,回傳一個 `filterUncoverable` 旗標讓 UI 顯示提示。
  - 空 tree(無條件)→ `runLiveMatch` 回全部 rows,等同不過濾。
- 遠端 source:**不套用篩選**(本輪 api filter 未做);hook 回一個 `filterEnabled: false`,`<ConfigTable>` 據此停用篩選器 UI 並標註。

### 2.3 `<ConfigTable>` 篩選器 UI

- 表格上方一個**收合式「Filter」區**(預設收合),展開後渲染 `<FilterTreeEditor group={tree} schema={schema} engineId="data-filter" onChange={setTree} onCreateField={…} labels={…} />`。
- 收合列顯示目前狀態:有條件時「Filter · N matched」;`uncoverable` 時紅字提示「此篩選含記憶體引擎不支援的條件」。
- 遠端 source:篩選器 UI 停用 + 標「api filter coming later」。
- labels:沿用 ConfigTable 既有的 `labels?: Partial<TableLabels>` 慣例,新增 filter 相關 key(有英文預設);FilterTreeEditor 的 `FilterTreeLabels` 也走同一組(可選、有預設)。
- changeset:`@rfjs/table-builder-ui` **minor**。

## 3. 工具變更(apps/web `table-builder`)

### 3.1 Source 面板 — 匯入

- 「Static data」模式下顯示:貼上 textarea + 「Upload .json/.csv」file input + JSON/CSV 格式切換 + 「Load」。
- Load:依格式解析 → rows。
  - **JSON**:`JSON.parse`,須為物件陣列(否則錯誤訊息)。
  - **CSV**:用 `papaparse`(apps/web dep;`header: true, dynamicTyping: true`)→ 物件陣列。
- 解析成功:`inferFieldsFromRows(rows)` → `deriveTableConfig(meta)` → 取代目前 config 與 rows;**清空 filter tree**(新 schema)。
- 解析失敗:顯示錯誤訊息,不改動現有資料 / config。
- 上傳走 `FileReader.readAsText` → 同一條解析路徑。

### 3.2 Columns 面板 — Filter 勾選

- 每欄一列加「Filter」checkbox(比照現有 Sort),改 `column.filterable`。
- 這一勾決定該欄是否進 `columnsToFilterSchema` → 是否出現在 `<ConfigTable>` 的篩選器可選欄位。

### 3.3 預覽

- 預覽區的 `<ConfigTable>` 就是帶 Filter 的版本;`source` 為 `rows` 時篩選可用,`fetcher` 時停用。

## 4. 錯誤處理 / 邊界

- 爛 JSON / 非陣列 / 爛 CSV → 錯誤訊息,保留上一份資料。
- re-import → 重新 infer/derive → **filter tree 清空**(避免引用舊 schema 的欄位)。
- 取消某欄 Filter 勾選但 tree 還留著它 → `runLiveMatch` 對不存在欄位安全略過(data-filter 既有行為),不炸。
- `uncoverable` 運算子 → 提示,不誤報 0 筆。
- 遠端 source → 篩選器停用 + 標註。

## 5. 測試

| 層 | 內容 |
|---|---|
| `@rfjs/table-builder` | `deriveTableConfig` 帶 `filterable`(選填,缺省不寫) |
| `@rfjs/table-builder-ui` | `columnsToFilterSchema`(**住這層**,因回傳 filter-builder 的 `FieldSchema`)只取 filterable 欄、`dataType` 1:1、`kind:'column'`;useConfigTable 靜態:建 tree → rows 變過濾後 + total 變 + 回第一頁;空 tree = 全部;uncoverable → 旗標;遠端 → filterEnabled false;ConfigTable:Filter 區渲染/收合、遠端停用、FilterTreeEditor 收到正確 schema(mock) |
| 工具 | Source:JSON 匯入成功 / 非陣列錯誤 / CSV 匯入(papaparse)/ 上傳 FileReader;re-import 清 tree;Columns Filter 勾選改 filterable;預覽整合 |
| e2e | 一條:進 table-builder → 匯入一份 JSON(或用範例)→ 展開 Filter → 加一條條件 → 表格列數變少 |
| 真渲染 | `next build` + start + 截圖 light/dark:匯入區、Columns Filter 勾選、展開的 Filter 區 + 過濾後表格 |

## 6. 慣例

- Changesets:`@rfjs/table-builder` minor + `@rfjs/table-builder-ui` minor(政策:改到的 package 都寫,含 private version-only);apps 不寫。
- Commit/PR 英文 conventional(subject 全小寫),`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;spec/plan 繁中;HOLD PR。
- 匯入(A)與篩選(B/C)在 plan 裡切成可獨立的任務組,但同一個 spec/PR。
