# form result `mode:'table'` 接線 — 設計 spec

- 日期:2026-07-10
- 分支 / worktree:`feat-form-result-table` @ `.claude/worktrees/feat-form-result-table`
- 背景 memory:`rfjs-form-tool-consolidation`(#235 留下 `{ mode:'table', table: TableConfig }` 縫)、`rfjs-table-builder-line`(`ConfigTable` 已成熟)
- 範圍決策:**A(render)+ B(snapshot,optional 便利);C(視覺化欄位編輯器)本輪不做**
- 狀態:設計已與使用者確認,待 spec review → plan

---

## 1. 背景與目標

`form-builder` 工具的 result item 在 #235 已凍結一道縫:`ResultItem` 有 `mode: 'card' | 'json' | 'table'` 與 `table?: unknown`(engine `packages/form-builder/src/types.ts:132,139`),`TableConfig` 之名亦為此凍結。目前 `table` 分支在 renderer(`packages/form-builder-ui/src/result-view.tsx:68-75`)只是一個「pending @rfjs/table-builder」佔位。

**目標**:把 result 的 `mode:'table'` 真正接上,內嵌成熟的 `<ConfigTable>`(`@rfjs/table-builder-ui`)渲染回應資料。

- **A(render)**:切到 `mode:'table'`、有 rows 時,零配置即渲染出可排序/篩選/分頁的表格(欄位自回應 derive)。這是這條線的核心價值——讓 form engine「能」渲染表格結果、順帶 dogfood `@rfjs/table-builder`。
- **B(snapshot,optional)**:inspector 提供把欄位擷取進 `item.table` 的動作,讓欄位集**穩定**且**可於 JSON tab 手改**。

**這條線的定位**:table 結果的真實用途是「搜尋/查詢表單」這類組裝場景,A 是讓 form + table 兩個 engine 組起來的膠水。作者端的重度客製非本輪目標。

**成功判準**:
- 切到 `mode:'table'` 且回應為物件陣列時,result 區塊渲染出 `<ConfigTable>`(排序/篩選/分頁可用)。
- 沒有手帶 `table` 時,零配置也能從回應 rows 自動 derive 出表。
- 有 `table`(手帶或 snapshot)時,依該 config 渲染。
- inspector 提供 snapshot 擷取欄位進 `item.table`,之後可經 JSON tab 手改。
- 全程只**消費** `@rfjs/table-builder*`,不修改。

---

## 2. 非目標(out of scope)

- **C — 視覺化欄位編輯器**(inspector 內拖曳/pin/隱藏/改 label/align/format 的逐欄 UI)。理由:authoring 的正確歸屬是 table-builder-ui(feat-api-filter 正在該處建 metadata-authoring 面板),不應在 form 工具內自刻第二份;且屬 STOP-adding-builders 的範圍。等一個「非工程使用者要在表單內排版欄位」的真實場景再議。
- **不改** `packages/table-builder`、`packages/table-builder-ui`(紅線)。
- 欄位 `options`(值→標籤 enum 映射)。
- 遠端資料源表格(`TableSource.kind:'remote'`)——result item 資料是 in-memory 回應,一律 `kind:'rows'`。
- 視覺/UX 大改。
- Group 3 欄位型別 / DatePicker / dataSource(姊妹線 A,獨立 worktree)。

---

## 3. 架構分層(A ⊂ B)

1. **A — Render 基線(零配置)**:`mode:'table'` + 有 rows → 立即出表。`config = item.table ?? deriveTableConfig({ fields: inferFieldsFromRows(rows) })`。這是「沒手帶 config 也能用」的保底。
2. **B — Snapshot(擷取欄位)**:inspector 一顆動作把 derive 結果凍進 `item.table`,之後欄位集穩定且可 JSON 手改。

執行時 A 與 B 渲染出的表格相同;B 只改變作者端(欄位穩定性 + JSON 可編輯把手)。

---

## 4. 資料流與型別

### 4.1 Render 資料流(在 `form-builder-ui`)

```
result item 的回應 value
  └─(dataPath 取子節點,沿用既有邏輯)
      └─ rows: 需為 Record<string,unknown>[]
           ├─ 是陣列物件 → config = item.table ?? deriveTableConfig({ fields: inferFieldsFromRows(rows) })
           │                 source = { kind:'rows', rows }(memoize,referential stable)
           │                 <ConfigTable config source locale />
           └─ 非陣列 / 空 → 優雅 fallback(空狀態文案,沿用 emptyText)
```

- `inferFieldsFromRows`(`@rfjs/data-schema`)、`deriveTableConfig`(`@rfjs/table-builder`)、`ConfigTable`(`@rfjs/table-builder-ui`)全是消費。
- `source` 必須 referential stable(`ConfigTableProps.source` 註明:remote fetch effect 依賴其 identity)——用 `React.useMemo` 綁 rows。

### 4.2 型別(engine `@rfjs/form-builder`)

- `ResultItem.table?: unknown` → `table?: TableConfig`(type-only import from `@rfjs/table-builder`)。
- `config-schema.ts`:`table` 欄位改用 `@rfjs/table-builder` 的 `tableConfigSchema`(現成 zod,`packages/table-builder/src/schema.ts:43`)驗證,不自行重寫。
- 決策:engine typed(而非留 `unknown` 只在 UI cast),因為 B 的 snapshot 會寫入真正的 TableConfig、JSON tab 也會編輯它,型別安全與 config 驗證都需要。

---

## 5. 檔案範圍與改動

| 層 | 檔案 | 改動 |
|---|---|---|
| Engine `@rfjs/form-builder` | `src/types.ts` | `ResultItem.table` 由 `unknown` → `TableConfig`(type-only dep) |
| | `src/config-schema.ts` | 以 `tableConfigSchema` 驗證 `table` |
| | `package.json` | + `@rfjs/table-builder`(workspace,型別/schema) |
| Renderer `@rfjs/form-builder-ui` | `src/result-view.tsx` | 換掉 pending 佔位分支 → `<ConfigTable>` + derive fallback + 非陣列 fallback;新增 `table` prop |
| | `src/config-form.tsx` | `:492` 把 `item.table` thread 進 `<ResultView>` |
| | `package.json` | + `@rfjs/table-builder`、`@rfjs/table-builder-ui`、`@rfjs/data-schema`(workspace) |
| Form 工具 `apps/web/src/tools/form-builder` | `model.ts` | `Card.resultTable?: unknown` → `TableConfig`;`cardsToFormConfig`/`formConfigToCards` 帶上 `table`↔`resultTable` |
| | `inspector/result.tsx` | mode=table 時顯示 snapshot 區(見 §6);mode option 拿掉 "coming soon" |
| | `messages.ts` | 新字串(snapshot / clear / 說明) |
| | `sample.ts` | 加一個 `mode:'table'` 的 result 範例卡 |

> 註:apps/web 已依賴 `@rfjs/table-builder`、`@rfjs/table-builder-ui`、`@rfjs/data-schema`、`@rfjs/form-builder(-ui)`。**本輪不加 `@dnd-kit`(無視覺化 reorder)。**

---

## 6. Inspector · Snapshot 區(B)

`mode:'table'` 時,`ResultSection` 於既有欄位下方加一小區:

- **Snapshot columns from a sample**:一個 textarea 貼入一段 sample 回應(陣列或單物件)→ `inferFieldsFromRows` → `deriveTableConfig` → 寫入 `resultTable`(`onChange({ resultTable })`)。採 paste-sample 而非讀 preview 執行結果:保持 inspector 自包含、可單元測試。
- **狀態列**:已擷取 N 欄的提示 + 一行「要客製欄位請到 JSON 分頁」。
- **Clear**:清掉 `resultTable`(回到 A 的自動 derive)。

寫入前以 `tableConfigSchema` 保證結構有效;貼入非法 JSON → 顯示錯誤,不寫入。

> C 的逐欄視覺編輯不在本輪;客製一律走 JSON tab(config 已是型別化的可編輯資料)。

---

## 7. 紅線與相依

- **紅線**:不修改 `packages/table-builder`、`packages/table-builder-ui`。只 import 型別、`deriveTableConfig`、`inferFieldsFromRows`、`ConfigTable`。
- **新相依**:
  - `@rfjs/form-builder` → `@rfjs/table-builder`(type + zod)。
  - `@rfjs/form-builder-ui` → `@rfjs/table-builder`、`@rfjs/table-builder-ui`、`@rfjs/data-schema`。
- form-builder-ui 為 `private`、走 transpilePackages,無 build/publish 負擔;`ConfigTable` 會連帶把 `filter-builder-ui` 拉進 renderer,但只在 table 模式渲染時掛載。

---

## 8. 測試策略(vitest + @testing-library)

- **Render(`result-view.spec.tsx`)**:
  - config-carried:給 `table` → 依該 config 渲染欄位/順序。
  - derive fallback:無 `table` + 陣列 rows → 自動生欄位。
  - 非陣列 / 空 rows → fallback 空狀態,不丟例外。
- **Snapshot(`result.spec.tsx` 或就近)**:
  - 貼合法 sample → 寫入正確的 `resultTable`(欄位數/型別)。
  - 貼非法 JSON → 不寫入、顯示錯誤。
  - Clear → `resultTable` 清空。
- **model round-trip(`model.spec.ts`)**:`mode:'table'` + `resultTable` 的 card ↔ FormConfig 雙向不失真。
- **config-schema(`config-schema.spec.ts`)**:合法 / 非法 `table` 的驗證。

---

## 9. Changeset

依 changeset policy(packages/* 一律給 changeset):
- `@rfjs/form-builder`:minor(型別 + schema:`table` 由 unknown → TableConfig)。
- `@rfjs/form-builder-ui`:minor(table 模式真正渲染;private 但仍記版本)。
- apps 不給 changeset。

commits:英文 conventional + `Co-Authored-By` trailer;spec/plan 繁中。

---

## 10. 風險與待決

1. **Seed 來源**:採 paste-sample(§6)。若日後偏好讀 preview 執行結果,需額外 plumbing(非本輪)。
2. **LocalizedLabel**:snapshot/JSON 編輯以當前 locale 字串處理;多語 label 留日後。
3. **B 的實用性**:B 是 optional 作者便利;若實測顯示很少人 snapshot,可再收成純 A。render(A)是不動搖的核心。
4. **filter-builder-ui 重量**:`ConfigTable` 帶入 FilterTreeEditor,僅 table 模式掛載,可接受。
5. **C 的未來歸屬**:若真需視覺化欄位編輯,做進 table-builder-ui 讓 form 消費,不在 form 內自刻。
