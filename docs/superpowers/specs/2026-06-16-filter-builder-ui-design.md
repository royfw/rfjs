# 設計:抽出共用 filter 樹編輯器 UI(B4-ui)

日期:2026-06-16
狀態:設計中(待使用者 + 跨 session spec 互審)

## 背景與目標

query-builder 的邏輯已抽成 `@rfjs/filter-builder`(PR #175)。但**樹編輯器 React 元件仍只在 apps/web**(`apps/web/src/tools/query-builder/ui/`)。workbench 的 datasets explorer 要在 workbench 建同樣的巢狀過濾樹送 `POST /datasets/query`,**不能跨 app import** apps/web。

本案(子專案 **B4-ui**)把「**樹編輯器元件 + 樹狀態 headless hook + 上色**」抽成一個**共用、私有**套件,兩個 app 都能用;apps/web 改用它(**行為不變**)。這是 workbench explorer 的前置依賴。

> **這份 spec 是「提供者」**:它定義對外的元件/hook API;workbench explorer(消費者)的 spec 要對齊本案定義的介面。互審重點即「workbench 能否只靠這組 API 拼出它要的 explorer」。

對齊 [[rfjs-open-source-and-layering]](有樣式、吃 web-ui 的 UI → 私有留 repo;不 public)、[[query-builder-rework-b]](B4-ui)。

## 範圍

**抽出成共用套件的(workbench 真正會重用的最小集合)**:
- **樹編輯器**:`builder-tree.tsx`(`GroupNode` 遞迴 + `ConditionRow`)、`field-combobox.tsx`(`FieldCombobox`)、`value-editor.tsx`(`ValueEditor`)
- **上色**:`logic/colors.ts`(`logicColor`/`dataTypeColor`,Tailwind token;兩 app 共用同一套 web-ui 主題 → token 解析得到)
- **headless hook**:新 `useFilterTree`(封裝 tree 狀態 + tree-ops + onCreateField + schema),讓消費端薄包一層即可

**留在 apps/web(playground 專屬,不抽)**:
- `index.tsx`(三欄 root + 取樣資料 + 引擎切換)、`three-pane.tsx`、`schema-panel.tsx`(sample-JSON 推斷)、`preview-panel.tsx`/`LiveMatchView`、`canonical-editor.tsx`(reverse-read)
- 理由:workbench explorer 的外圍(真實 datasets、結果表格、分頁)與 playground 不同;**只有「樹編輯器 + 狀態」是真正共用**。apps/web 把這些 playground 面板與抽出的樹編輯器重新組裝(行為不變)。

**非目標**:不改任何行為;不抽 playground 外圍面板;不做 workbench explorer 本身(另一個 sub-project);不發 npm。

## 共用套件(命名待決:見 D1)

私有(`"private": true`,不 public —— 吃 `@rfjs/web-ui` + React)。deps:`@rfjs/filter-builder`(型別 + engines + tree-ops)、`@rfjs/web-ui`(Button 等)、`react`、`next-intl`?(見 i18n 決策 D3)、`lucide-react`。建置沿用 web-ui 那類「給 Next app 直接吃 src/TSX」的私有套件方式(非 tsdown dist;比照 `@rfjs/web-ui` / `@rfjs/web-core` 的私有套件慣例)。

## 對外 API(互審的核心 —— 這就是 workbench 要對齊的介面)

### 1. `<FilterTreeEditor>`(= 現 `GroupNode` 的對外包裝)
```ts
interface FilterTreeEditorProps {
  tree: BuilderGroup;                 // 來自 @rfjs/filter-builder
  schema: FieldSchema[];
  engineId: EngineId;                 // 決定運算子矩陣(workbench 傳 'pg-filter')
  onChange: (next: BuilderGroup) => void;
  onCreateField: (path: string) => void;
  labels: FilterTreeLabels;           // i18n 文字以 props 注入(見 D3)
}
```
- 內部仍用 `@rfjs/filter-builder` 的 `getEngine(engineId).operators(...)`、`tree-ops`、`colors`。
- `labels` 物件涵蓋目前 hardcode / `useTranslations("ToolUI")` 的字串:logic 標籤(and/or/nor/not)、`+ 條件`/`+ 群組`、`elemMatchPlaceholder`、移除鈕 aria 等。

### 2. `useFilterTree(init?)` headless hook
```ts
function useFilterTree(init?: { tree?: BuilderGroup; schema?: FieldSchema[] }): {
  tree: BuilderGroup;
  schema: FieldSchema[];
  setTree: (g: BuilderGroup) => void;
  setSchema: (s: FieldSchema[]) => void;
  createField: (path: string) => void;   // = setSchema(addInferredField(schema, path))
};
```
- 純狀態 + 既有 `@rfjs/filter-builder` 函式;**無樣式、無 web-ui 依賴** → 理論上可 public(見 D2)。
- `id` 用 `crypto.randomUUID()`(沿用現況;勿 module counter / 注意 useId hydration)。

### 3. `logicColor` / `dataTypeColor`
原樣移入(Tailwind token 字串)。

## apps/web 重構(行為不變)
- apps/web query-builder 改:`ui/index.tsx` 用 `useFilterTree` 管樹狀態、用 `<FilterTreeEditor>` 取代內嵌 `GroupNode`,並把 `useTranslations("ToolUI")` 取到的字串組成 `labels` 傳入。
- 刪 apps/web 內被抽走的 `builder-tree.tsx`/`field-combobox.tsx`/`value-editor.tsx`/`logic/colors.ts`;其餘 playground 面板留著。
- 驗證:apps/web query-builder 既有測試 + check-types + build/SSG 全綠 = 行為不變。

## 待決策(請使用者 + 互審定)

> **D1 — 套件名 / 位置**:建議新私有套件 **`@rfjs/filter-builder-ui`**(與 `@rfjs/filter-builder` 成對)。備選:`@rfjs/query-builder-ui`、或塞進 `@rfjs/web-ui`(不建議,web-ui 是通用原件、這是領域元件)。

> **D2 — headless hook 放哪**:建議 v1 **hook 與元件同放這個私有套件**(只兩個內部消費者,YAGNI);未來真要對外再把純 hook 提升到 public(memory 原意 hook→public)。備選:現在就拆「public 純 hook + private 元件」兩包。

> **D3 — i18n 策略(跨 app 關鍵)**:建議 **labels-as-props**(元件不碰 next-intl,所有字串由消費端翻譯後以 `labels` 注入;`CanonicalEditor` 已是這模式)。好處:元件與 next-intl/命名空間完全解耦,兩 app 各自翻譯、不必共用 `ToolUI` 命名空間。備選:元件內 `useTranslations("ToolUI")` + 套件附 messages fragment,兩 app 都 merge(較耦合)。

> **D4 — 共用範圍**:建議只抽「樹編輯器 + hook + colors」(如上)。SchemaPanel 不抽(apps/web 是 sample-JSON 推斷;workbench 是固定欄位,schema 來源不同)。若互審發現 workbench 也要某塊外圍面板,再加。

## 測試與驗證
- 抽出的元件:輕量 component test(沿用 `canonical-editor.spec.tsx` 風格;labels 走 props 免 i18n provider)放新套件。
- `useFilterTree`:純邏輯單元測試(tree-ops 串接、createField)。
- apps/web:query-builder 既有測試 + check-types + build/SSG 全綠(行為不變的證明)。
- 全域 `pnpm -w build` / `test`。

## 風險 / 注意
- **私有套件建置型態**:比照 `@rfjs/web-ui`(Next app 直接吃 TSX / transpilePackages),別誤用 tsdown dist 流程。先確認 web-ui 怎麼被 apps 吃,照抄。
- **i18n**:D3 若選 labels-as-props,labels 物件要涵蓋所有現用字串,漏字會是空白 UI —— 以「apps/web 行為不變」當守門。
- **engine 耦合**:`FilterTreeEditor` 經 `engineId` 用 `@rfjs/filter-builder` 的 `getEngine`;workbench 傳 `'pg-filter'` 取得欄位/jsonb 運算子矩陣。
- **useId/hydration**、reverse-read(B2)、pg-filter(B1)不回歸。

## 互審清單(給 workbench explorer 那份 spec 對照)
1. workbench 能否只用 `<FilterTreeEditor>` + `useFilterTree` 拼出它要的過濾區?還缺什麼 prop/元件?
2. labels 介面(D3)是否夠 workbench 用它自己的 i18n 命名空間填?
3. workbench 拿 `tree` → 怎麼產 `POST /datasets/query` 的 body?(用 `@rfjs/filter-builder` 的 `treeToFilterGroup` + pg-filter 引擎的 tree→PgFilterGroup;確認該映射對外可用,或需從 filter-builder 再 export)
4. 套件名(D1)、i18n 策略(D3)兩份 spec 必須一致。

## 相關 memory
[[query-builder-rework-b]](B4-ui)、[[rfjs-open-source-and-layering]]、[[spec-language-traditional-chinese]]、[[commits-and-pr-in-english]]、[[worktree-for-all-implementation]]。
