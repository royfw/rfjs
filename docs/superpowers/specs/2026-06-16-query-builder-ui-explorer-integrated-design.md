# query-builder 共用 UI + workbench explorer — 整合設計(取代兩份草稿)

日期:2026-06-16
狀態:**整合版**,合併兩個 session 的草稿
(`2026-06-16-filter-builder-ui-design.md` 與 `2026-06-16-query-builder-ui-and-explorer-design.md`)
+ 互審結論。待**兩個 session + 使用者**確認後實作。

## 終局

讓 **apps/workbench 對真實 dataset 視覺化建構巢狀過濾並執行**(`POST /datasets/query`)。為了不重寫整個樹 UI,把 apps/web query-builder 的樹編輯器抽成**共用私有套件**;並讓 `@rfjs/filter-builder` 對外吐「結構化」filter(非只 SQL 字串)。

## 三塊分解(各自可獨立 plan/PR)

- **Part A — `@rfjs/filter-builder` 結構化 export**(logic 套件,小):對外提供 tree+schema → `PgFilterGroup` 的 target-tagging 映射。explorer 的前置。
- **Part B — `@rfjs/filter-builder-ui`**(新私有套件):共用樹編輯器 + 精簡 hook + colors;apps/web 改薄消費(行為不變)。
- **Part C — workbench datasets explorer**:用 B+A 對選定 dataset 建查詢 → 執行 → 顯示結果。

相依:**C 依賴 A + B**;B 與 A 可並行。

## 已鎖定的共同決策(兩份草稿一致)

- **D1 套件名**:`@rfjs/filter-builder-ui`(**私有**,`"private": true`)。依賴 `@rfjs/web-ui` 故不可 public。
- **D3 i18n**:**labels-as-props** —— 共用元件**不依賴 next-intl**;所有顯示字串由消費端翻好,以 typed `labels` 物件注入(沿用現有 `canonical-editor`/`value-editor` 的 props 模式)。
- **colors**:`apps/web/.../query-builder/logic/colors.ts` 搬進 `@rfjs/filter-builder-ui`(兩 app 共用同一套 web-ui Tailwind 主題,token 解析得到)。
- **apps/web**:改成**薄消費者**,外觀/行為/reverse-read(B2)/三欄(B3)全不變,既有測試續綠。
- **私有套件建置型態**:比照 `@rfjs/web-ui`(Next app 直接吃 TSX / transpilePackages),**非** tsdown dist 流程。實作前先確認 web-ui 怎麼被 apps 吃,照抄。

## 解決的分歧(互審結論)

### 1. 共用範圍 → **分層(只抽真正共用的核心)**
- **核心(放套件,workbench 真的會用)**:
  - `FilterTreeEditor`(= 現 `GroupNode`/`ConditionRow` 的對外包裝)+ 其內用的 `FieldCombobox`、`ValueEditor`
  - `colors`
  - **精簡 hook `useFilterTree`**(只管 tree + schema + tree-ops + createField)
- **playground 專屬(留 apps/web,**不**進共用套件)**:`SchemaPanel`(sample-JSON 推斷)、`PreviewPanel`/`LiveMatchView`、`CanonicalEditor`(reverse-read)、`ThreePane`、引擎切換器、以及把它們組起來的 root。
- **理由**:workbench 用 dataset 欄位當 schema、執行真查詢、不要 SQL 預覽/live-match/sample-JSON。把這些 playground UI 塞進「共用」套件 = 過度抽取、workbench 不會用。共用套件定位是「**樹編輯器**」,不是「query-builder playground」。

### 2. hook 形狀 → **拆兩層**
- `useFilterTree`(**套件,共用**):`{ tree, schema, setTree, setSchema, createField }`。純狀態 + `@rfjs/filter-builder` 函式;無樣式/web-ui/i18n。
- `useQueryBuilder`(**留 apps/web**):包 `useFilterTree` 再加 playground 狀態(`sampleText/engineId/output/live/reverseError` + derived)。workbench 不需要,故不進套件。

### 3. 歸屬 / `toPgGroup` export
- `toPgGroup` 屬 `@rfjs/filter-builder`(logic 套件)領域 → 由 **logic 套件 owner** 加(Part A)。
- B4-ui 抽取要動 apps/web query-builder ui 那批檔 → **單一 owner**,避免雙方同時動 `ui/*.tsx`。

---

## Part A — `@rfjs/filter-builder` 結構化 export

現況:`Engine.compile` 只回 `EngineOutput = { primary: string }`(SQL 字串);target-tagging 的 `toPgGroup`/`toPgLeaf` 藏在 `engines/pg-filter.ts` 內部、未對外。explorer 需要結構化 `PgFilterGroup` 當 API body。

**新增對外**(名稱二選一,建議 `buildPgFilterInput`):
```ts
// 由 canonical 樹 + 欄位種類 → 後端可收的結構化 filter
export function treeToPgFilterGroup(
  group: FilterGroupLike,
  fields: CompileField[],   // path/kind/dataType/elementType(已是 CompileContext 的形狀)
): PgFilterGroup;
```
- 內部即現有 `toPgGroup(group, byPath)`,只是改成公開、吃 `fields`(或 `CompileContext`)。
- workbench:`treeToFilterGroup(tree)` → `treeToPgFilterGroup(group, fields)` → 放進 `PgFilterInput.filter`,自己補 `sort/page/pageSize`,送 `POST /datasets/query`。
- 純函式、行為不變(只是把內部映射對外);加單元測試(純 column / 純 jsonb / 混合 → 正確 target/巢狀)。

## Part B — `@rfjs/filter-builder-ui`(私有套件)

deps:`@rfjs/filter-builder`、`@rfjs/web-ui`、`react`、`lucide-react`(**不**依賴 next-intl)。

### 對外 API(這就是 explorer 要對齊的邊界)

**`<FilterTreeEditor>`**
```ts
interface FilterTreeEditorProps {
  tree: BuilderGroup;
  schema: FieldSchema[];
  engineId: EngineId;            // 決定運算子矩陣;workbench 傳 'pg-filter'
  onChange: (next: BuilderGroup) => void;
  onCreateField: (path: string) => void;
  labels: FilterTreeLabels;      // 見下
}
interface FilterTreeLabels {     // 涵蓋現有 hardcode/useTranslations 的字串
  logic: Record<LogicOp, string>;   // and/or/nor/not 顯示名
  addCondition: string;
  addGroup: string;
  removeCondition: string;          // aria
  removeGroup: string;              // aria
  elemMatch: string;                // elemMatchPlaceholder
  fieldPlaceholder?: string;
}
```
- 內部仍用 `@rfjs/filter-builder` 的 `getEngine(engineId).operators(...)`、`tree-ops`、`colors`;`id` 用 `crypto.randomUUID()`(注意 useId/hydration,勿 module counter)。

**`useFilterTree`**
```ts
function useFilterTree(init?: { tree?: BuilderGroup; schema?: FieldSchema[] }): {
  tree: BuilderGroup; schema: FieldSchema[];
  setTree: (g: BuilderGroup) => void;
  setSchema: (s: FieldSchema[]) => void;
  createField: (path: string) => void;     // setSchema(addInferredField(schema, path))
};
```

**`logicColor` / `dataTypeColor`** — 原樣移入。

### apps/web 重構(行為不變)
- `ui/index.tsx`:用 `useTranslations("ToolUI")` 組 `labels` 傳給 `<FilterTreeEditor>`;樹狀態用 `useFilterTree`(或保留現有 inline,擇一)。playground 面板(SchemaPanel/Preview/Canonical/ThreePane/引擎切換)留在 apps/web。
- 刪 apps/web 內被抽走的 `builder-tree.tsx`/`field-combobox.tsx`/`value-editor.tsx`/`logic/colors.ts`。
- 既有 query-builder 測試 + check-types + build/SSG 全綠 = 行為不變守門。

## Part C — workbench datasets explorer

- **路由**:`apps/workbench/src/app/[locale]/(shell)/datasets/[id]/explore`(或 datasets 頁內的 explorer 區塊)。client component。
- **schema 來源**:**固定欄位**(id/name/description/createdAt/updatedAt,column-kind,型別已知)+ jsonb 欄位以 **creatable combobox** 新增(可選:抓該 dataset 一筆 `data` sample 用 `inferSchema` 預填 jsonb keys)。**不**用 apps/web 那種貼 sample-JSON 的 SchemaPanel。
- **流程**:選 dataset → 用 `<FilterTreeEditor engineId="pg-filter" labels={workbenchLabels}>` 建樹 → 「執行」→ `treeToFilterGroup(tree)` → `treeToPgFilterGroup(group, fields)`(Part A)→ 組 `PgFilterInput`(+sort/page/pageSize)→ `queryDataset(id, input)` → 顯示結果表 + total + 分頁。
- **`lib/datasets.ts`** 擴充:`queryDataset(id, input): Promise<{ok:true; result:{items,total,page,pageSize}} | {ok:false}>`(POST /datasets/query;沿用既有 discriminated `{ok}` 模式 + API-down vs 空結果區分)。
- **i18n**:workbench 用自己的命名空間翻 labels(D3),不共用 apps/web 的 `ToolUI`。

## 建議分工(由使用者拍板)

消除所有重疊的乾淨切法:
- **Session 甲(filter-builder owner)**:Part A(`treeToPgFilterGroup` export)。小、解鎖 C。
- **Session 乙**:Part B(B4-ui 抽套件 + apps/web 薄消費)→ 再 Part C(workbench explorer)。B4-ui 單一 owner,避免雙方同動 `ui/*.tsx`。
- 兩份草稿作廢,以本整合版為準。

(替代切法:乙做 B、甲做 A+C —— 但 C 依賴 B 的元件 API,讓做 B 的人接著做 C 較連貫。)

## 測試策略
- **Part A**:`treeToPgFilterGroup` 單元(純 column/jsonb/混合;target 正確;巢狀)。
- **Part B**:`useFilterTree` 用 `renderHook` 測;`FilterTreeEditor` 以 props(含 labels)測關鍵互動(免 i18n provider)。apps/web 既有測試 + 「messages→labels 無漏 key」守門 + check-types/build/SSG。
- **Part C**:`queryDataset` client(成功/錯誤/空);頁面層(選 dataset→建樹→執行→渲染);API-down vs 空。

## YAGNI / 非目標
- 不改 `@rfjs/filter-builder` logic 行為(Part A 只**新增** export)。
- 不把 UI 套件 public;不抽 playground 專屬面板進共用套件。
- 不做 mongo、不反解 jsonb SQL;不動 `/datasets/query` 後端契約。
- headless hook 暫不獨立成 public(YAGNI;未來再說)。

## 風險
- 私有套件建置型態(照抄 web-ui 的 transpile 慣例,別用 tsdown dist)。
- labels 漏 key → 空白 UI;以 apps/web 行為不變 + 漏 key 守門測試擋。
- useId/hydration、reverse-read(B2)、pg-filter(B1)、A 的 ToolUI 碰撞守門 + catalog 一致性不回歸。

## 相關 memory
[[query-builder-rework-b]]、[[sql-filter-and-datasets-query]]、[[workbench-backend-foundation]]、[[rfjs-open-source-and-layering]]、[[spec-language-traditional-chinese]]、[[commits-and-pr-in-english]]、[[worktree-for-all-implementation]]。
