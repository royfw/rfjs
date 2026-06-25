# Form Builder → shadcn Registry — 設計規格

**日期：** 2026-06-25
**狀態：** 草稿（待審查）
**分支：** `worktree-feat-form-builder`

## 1. 摘要

打造一套 **設定驅動的表單系統**，並以 **shadcn registry** 的形式散佈 —— 別的專案用
`npx shadcn add <url>` 把元件原始碼安裝進去、之後完全擁有它。

- **執行期渲染器** `<ConfigForm config={…} />`：把一份 JSON config，用 `@rfjs/web-ui` 既有的
  shadcn primitives 渲染成可用的表單。
- **視覺化 builder** `<ConfigFormBuilder />`：讓使用者用 UI 組出那份 JSON config，並即時預覽
  （預覽用的就是同一個渲染器，所以「編輯時」與「執行期」完全一致）。
- 兩者都透過 `apps/web` 提供的 shadcn registry 散佈。

模型採 **執行期 JSON config**（config 是資料：可儲存、可由後端下發、不改 code 就能改表單），
與 `filter-builder` 用執行期 tree 驅動篩選的做法一致。

## 2. 背景與動機

rfjs 已經有這件事需要的兩塊地基：

- **`@rfjs/web-ui`** —— 一套真正的 shadcn/Radix 設計系統（`radix-ui`、`class-variance-authority`、
  `tailwind-merge`、`cmdk`、`lucide-react`，附 `components.json`）。這就是 shadcn 地基。
- **`@rfjs/filter-builder` + `@rfjs/filter-builder-ui`** —— 正是我們要沿用的「framework-agnostic
  模型 → React 編輯器」前例。`filter-builder` 持有標準 tree、schema 推斷、引擎編譯；
  `filter-builder-ui` 是其上一層薄薄的樣式化編輯器。

缺口：rfjs 能「建立篩選」，但沒有「設定驅動的表單／表格渲染」。本規格補上表單這一半，並以其他專案
可採用的形式散佈（shadcn 的 copy-source 模型）。

此概念啟發自一套內部的設定驅動 UI 函式庫與其視覺化設定後台；本設計是把「**把表單宣告成資料、用 UI
編輯它**」這個**概念**，重新實作在 shadcn primitives 上，而非移植任何特定的程式碼。

## 3. 已定案的決策

以下在 brainstorming 階段已定，本文不再重議：

| 決策 | 選擇 |
| --- | --- |
| 散佈模型 | **shadcn registry**（`npx shadcn add`），而非 npm 元件函式庫 |
| 範圍 | **完整版**：渲染器 + 視覺化 builder + registry 基建 —— 分階段實作 |
| 輸出／執行模型 | **執行期 JSON config 引擎**（config 是資料；渲染器執行期讀取） |
| 套件切分 | `@rfjs/form-builder`（引擎）+ `@rfjs/form-builder-ui`（React）+ `apps/web` 提供 registry |
| schema 對齊 | `FieldSchema` 的資料型別詞彙對齊 `@rfjs/filter-builder` |
| 持久化 | config／data 分離、version 連結；元件 persistence-agnostic；`configToZod` 為橋 |

## 4. 架構

### 4.1 套件（沿用 filter-builder 那組的結構）

| 套件 | 角色 | 對應前例 | 發佈模型 |
| --- | --- | --- | --- |
| `@rfjs/form-builder` | framework-agnostic：config 型別、config zod schema、`configToZod`、互動規則引擎、tree-ops（增／刪／改欄位） | `filter-builder` | 會 build 到 `dist/` 供內部使用；是否**發到 npm** 屬開放決策 3 |
| `@rfjs/form-builder-ui` | React：`<ConfigForm>` 渲染器 + `<ConfigFormBuilder>` 編輯器，建在 `web-ui` primitives 上，labels-as-props | `filter-builder-ui` | **私有** —— 輸出 `src/`，經 `transpilePackages` 消費 |
| `apps/web` 的 `registry/` + `/r/*.json` | shadcn registry：把上述兩包當「可安裝、可擁有的原始碼」散佈 | *(新基建)* | Next.js 提供的靜態 JSON |

### 4.2 資料流

```
ConfigFormBuilder (編輯)  ──產出──▶  FormConfig (JSON)  ──餵入──▶  ConfigForm (渲染)
        │                                                            │
        └──────────────── 即時預覽（同一個執行期渲染器）──────────────┘
```

builder 與渲染器共用同一個渲染引擎，所以「編輯時的預覽」與「執行期產出」逐位元一致。

### 4.3 內部使用 vs 對外散佈

rfjs **自我 dogfood** 這組 workspace 套件（`workbench` 透過 `@rfjs/form-builder-ui` 渲染表單）。
對外消費者則透過 registry 拿到**同一份原始碼**。避免兩邊飄移是一個真實的設計課題 ——
見 §11（registry 散佈）與開放決策 3。

## 5. Config schema（JSON 的形狀）

引擎定義兩層型別，皆由 zod 驗證：

```ts
// 資料型別詞彙 —— 與 @rfjs/filter-builder 的 FieldType 對齊
type ScalarType = "string" | "numeric" | "date" | "boolean";
type FieldType  = ScalarType | "object" | "array";

// P1 元件集（可渲染的 widget）
type FieldComponent =
  | "Input" | "Textarea" | "Select" | "Checkbox" | "Switch" | "Date";

interface FieldConfig {
  key: string;            // 表單值的 key / 資料路徑
  label: string;          // 顯示標籤（可經 labels-as-props 覆寫做 i18n）
  component: FieldComponent;
  dataType: FieldType;    // 對齊詞彙 → 為未來 filter／form schema 共用鋪路
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: { label: string; value: string | number }[]; // Select／Checkbox-group
  rules?: InteractiveRule[]; // P2 —— 見 §7
}

interface FormConfig {
  version: number;         // config 形狀有破壞性變更時遞增
  fields: FieldConfig[];
  // layout?: … (延後到 P4)
}
```

兩個 zod schema：

1. **`FormConfigSchema`** —— 驗證 `FormConfig` 本身（builder 的產出／儲存的 config），在渲染前於邊界驗證。
2. **`configToZod(config): ZodType`** —— *衍生* 出一個 schema，用來驗證使用者依該 config **送出的資料**。
   這個單一函式同時餵給渲染器驗證、server 端驗證、以及未來的查詢使用。它是 config 與 data 之間的橋。

資料型別詞彙刻意與 `filter-builder` 的 `FieldType`
（`"string" | "numeric" | "date" | "boolean" | "object" | "array"`）完全一致，
讓同一份 dataset schema 未來能同時驅動 filter UI 與表單（見 §10，整合前瞻）。

## 6. 渲染器 —— `<ConfigForm>`

- **Props：** `config: FormConfig`、`defaultValues?`、`onSubmit(values)`、`onChange?`、
  `components?`（覆寫／擴充欄位元件 map）、標籤覆寫（labels-as-props，與 `filter-builder-ui` 同套 i18n 模式）。
- **欄位註冊表（field registry）：** 一張 `component` 名稱 → React 渲染器的 map，每個建在 `web-ui`
  primitive 上（`Input`、`Textarea`、`Select`、`Checkbox`、`Switch`，加一個日期控制項）。消費者可擴充
  這張 map 來註冊自訂欄位型別 —— 這正是「你擁有並可擴充原始碼」的特性。
- **驗證：** 用 `configToZod(config)` 驗證送出的資料。
  - **開放決策 1：** 表單 runtime stack —— `react-hook-form` + `@hookform/resolvers/zod`
    （shadcn 標準表單慣用法；推薦）vs 自寫極簡受控狀態引擎（依賴較少、較不慣用）。推薦
    react-hook-form + zod，因為 registry 消費者預期看到 shadcn Form 模式，且能與既有 `web-ui` 元件組合。

## 7. 互動規則引擎（P2）

表單需要條件行為：依其他欄位值來 *show／hide／require／disable* 某欄位
（例如「只有當 `role == 'admin'` 才顯示 `manager`」）。

- **推薦（開放決策 2）：** **重用 `@rfjs/data-filter`**，而非自造規則迷你語言。一條規則的條件
  （「當 `role` 等於 `admin`」）正是對「目前表單值這個物件」做 predicate 評估 —— 而那就是 `data-filter`
  在做的事（對 JS 物件套 `and`/`or`/`not` tree）。因此 `@rfjs/form-builder` 會依賴 `@rfjs/data-filter`
  （workspace），就跟 `filter-builder` 現在的做法一樣；`InteractiveRule` 帶一個 `data-filter` 條件加上一個
  `effect: "show" | "hide" | "require" | "disable"`。
- 這讓引擎維持小巧、並重用一個有測試的套件。最終定奪延後到 P2 設計。

## 8. 視覺化 builder —— `<ConfigFormBuilder>`（P3）

- 一個建在 `web-ui` 上、覆於 `@rfjs/form-builder` tree-ops 之上的樣式化編輯器 —— 即 `filter-builder-ui`
  之於 `filter-builder` 的直接類比。
- 產出 `FormConfig` JSON；用同一個 `<ConfigForm>` 做 **即時預覽**。
- 只持有編輯狀態；所有 config 變更邏輯（增／刪／重排／改欄位、驗證）都在 `@rfjs/form-builder` 裡，
  所以不需 React 即可測試。

## 9. 持久化邊界與資料模型

散佈出去的元件是 **persistence-agnostic** 的 —— config 與 data *存哪* 是消費端 app 的責任。引擎只提供
型別與 `configToZod` 橋。推薦的模式（文件化並在 `workbench` 示範，不寫死進元件）：

- **config 與 data 分開存。** 生命週期與基數都不同（一份 config → 多筆紀錄）。
- **用 version 連結** 兩者，讓 config 的編輯不會默默弄壞既有紀錄。

```
form_configs      { id, version, config: JSON }                          // builder 產出；每版不可變
form_submissions  { id, configId, configVersion, data: JSONB, createdAt } // 延續 rfjs datasets 的 jsonb 慣例
```

- 這與 `@rfjs/db` / `@rfjs/core` 既有的 `datasets`（`jsonb data`）慣例一致。
- 把 `data` 維持為乾淨的 JSONB，也正是讓未來能用 `jsonb-query` / `data-filter` 查詢這些 submission 的前提（§10）。
- **混合** `{ config, data }` 只在當成 **匯出／傳輸封包** 時可接受，絕不作為真相來源（system of record）。

## 10. 整合前瞻（現在不在範圍內）

已預留設計、但明確延後：

1. **共用 `FieldSchema`** —— 一份 dataset schema 同時驅動篩選（`filter-builder`）與表單。對齊的資料型別
   詞彙（§5）就是現在順手保留的那道門；其餘尚未動工。
2. **規則用 `data-filter`** —— 已是推薦的 P2 做法（§7）。
3. **搜尋表單 → filter 收斂** —— 一個輸出為 `filter-builder` tree 的表單，交由 `jsonb-query` /
   `pg-filter` / `data-filter` 編譯；接回 workbench 的 dataset explorer。（P4+）
4. **選項來自 query 的 Select** —— 某個 Select 的選項來自 `pg-filter`/`jsonb-query` 查詢。屬 app 層整合。（P4+）

## 11. Registry 散佈

- **檔案配置：** `registry.json` 放 `apps/web` 根；item 原始碼放 `apps/web/registry/` 底下。
- **build：** `npx shadcn build` → 產出 `apps/web/public/r/<name>.json`。
- **消費：** `npx shadcn@latest add https://<web-host>/r/config-form.json`。
- **散佈什麼：**
  - 引擎（`FormConfig` 型別、`configToZod`、規則）作為 `registry:lib`，
  - 渲染器 + 欄位元件 + builder 作為 `registry:component` / `registry:block`，
  - `registryDependencies` → 用到的 `web-ui` shadcn primitives（`button`、`input`、`select`、
    `checkbox`、`switch`、`label`…），
  - npm `dependencies` → `zod`、`lucide-react`，以及（依開放決策 1）`react-hook-form` + `@hookform/resolvers`。
- **單一來源策略（開放決策 3）：** 引擎邏輯應只活在**一處**（`@rfjs/form-builder`）。對 registry 而言，
  二擇一：(a) 在 build 前置步驟中，從 `@rfjs/form-builder` 原始碼**產生** `registry:lib` 檔案，並改寫 import
  路徑（`@rfjs/web-ui/...` → `@/components/ui/...`）（推薦 —— 單一來源、消費者完全擁有、無 `@rfjs/*` runtime
  依賴）；或 (b) 把 `@rfjs/form-builder` **發到 npm**，讓 registry 元件依賴它（較簡單，但多一個 runtime npm
  依賴、較不「全擁有」）。在 P1 做一個小 spike 後定奪。
- **注意事項：** `registry.json` 確切的欄位名與 `registry:*` 型別值，須在 P1 對照當前 shadcn 官方文件驗證
  （格式有演進過）。

## 12. 分階段

- **P1 —— 垂直切片（先把 registry 管線去風險）：**
  - `@rfjs/form-builder`：`FormConfig` 型別、`FormConfigSchema`、`configToZod`。
  - `@rfjs/form-builder-ui`：`<ConfigForm>`，含 P1 欄位集（Input、Textarea、Select、Checkbox、Switch、Date）
    + zod 驗證的送出。
  - registry 基建：`registry.json`、`shadcn build`、提供 `/r/*.json`、**一個可安裝的 item**。
  - **驗收：** `npx shadcn add <url>` 到一個臨時專案能解析並渲染出表單；一份靜態 config 能在 `workbench`
    裡渲染，作為內部 dogfood。
- **P2 —— 互動規則引擎**（重用 `data-filter`）：show / hide / require / disable。
- **P3 —— `<ConfigFormBuilder>`** 視覺化編輯器 + 即時預覽；產出 JSON。
- **P4（之後）** —— 更多欄位型別、`<ConfigTable>`、搜尋表單 → filter 收斂。

## 13. 測試

- **引擎（`@rfjs/form-builder`）：** vitest 單元測試，`*.spec.ts` 與原始碼同置 —— `FormConfigSchema`
  接受／拒絕案例、`configToZod` 各資料型別的正確性、規則評估（P2）。
- **UI（`@rfjs/form-builder-ui`）：** `@testing-library/react` —— 每種欄位型別能渲染、驗證會觸發、
  `onSubmit` payload 形狀；builder 的增／刪／重排互動（P3）。
- **Registry：** 一個 build 煙霧測試（registry.json 可驗證；build 產出預期的 `/r/*.json`）；P1 至少做一次手動
  `shadcn add` 整合檢查，可行的話自動化成 temp-dir 測試。

## 14. 開放決策（於審查／P1 定奪）

1. **表單 runtime stack** —— react-hook-form + zod（推薦）vs 自寫極簡受控引擎。
2. **規則引擎** —— 重用 `@rfjs/data-filter`（推薦）vs 自造。
3. **registry 單一來源** —— 從 `@rfjs/form-builder` 產生 `registry:lib`（推薦）vs 把引擎發到 npm 讓 registry 依賴它。
4. **P1 欄位集** —— 確認 Input / Textarea / Select / Checkbox / Switch / Date。
5. **命名** —— 確認 `@rfjs/form-builder` / `@rfjs/form-builder-ui`（vs `config-form*`）。

## 15. 非目標（YAGNI）

- 圖表、檔案上傳、GraphQL 驅動的 select、TreeSelect —— 不在範圍。
- 本文不定義 API endpoint；持久化是消費端的責任，`workbench` 僅作為示範性的 dogfood。
- P4 之前不做 `<ConfigTable>`。
