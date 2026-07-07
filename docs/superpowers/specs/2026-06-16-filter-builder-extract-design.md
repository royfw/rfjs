# 設計：抽出 `@rfjs/filter-builder`(query-builder 邏輯共用化)

日期:2026-06-16
狀態:設計中(待 review)

## 背景與目標

apps/web 的 query-builder 工具(PR #165 → #172 pg-filter → #174 reverse-read)其 `logic/` 已是**內聚、框架無關的純 TS**(唯一例外 `colors.ts` 吐 Tailwind class)。接下來 workbench 要做「真實 datasets 的巢狀過濾 UI」(送 `POST /datasets/query`),需要重用同一套樹建構邏輯;但 workbench 是另一個 app,**不能跨 app import** `apps/web/...`。

本案(子專案 **B4** 的 logic 部分)把 query-builder 的框架無關邏輯抽成新 **public 套件 `@rfjs/filter-builder`**,apps/web 改用它,**行為完全不變**。這解鎖後續的「共用樹 UI(B4-ui)」與「workbench datasets explorer」。

對齊 [[rfjs-open-source-and-layering]](通用邏輯 → public @rfjs/*)、[[query-builder-rework-b]](B4)。

## 範圍

**抽出(整個 `apps/web/src/tools/query-builder/logic/` 除了 `colors.ts`)**,連同各自的 `*.spec.ts`:
- `types.ts`、`tree-ops.ts`、`compile.ts`、`reverse.ts`、`field-create.ts`、`schema-infer.ts`、`value-coerce.ts`、`field-kind.ts`、`live-match.ts`
- `engines/`:`types.ts`、`arity.ts`、`data-filter.ts`、`jsonb.ts`、`pg-filter.ts`(**含 `toPgGroup`/`toPgLeaf` 的 tree→PgFilterGroup target-tagging**)、`index.ts`

**留在 apps/web**:
- `logic/colors.ts`(+ `colors.spec.ts`)——Tailwind token,框架相關。改成從 `@rfjs/filter-builder` import 它需要的型別(`LogicOp`/`FieldType`)。
- 全部 `ui/*.tsx`(React 元件)——只把 `@/tools/query-builder/logic/*` 的 import 改指向 `@rfjs/filter-builder`。
- `index.ts`(工具註冊)、`messages.ts`(i18n)。

**非目標**:不抽 UI 元件(那是 B4-ui);不抽 `colors`;不改任何行為/邏輯;不動 workbench(下一個 sub-project);不發 npm(version 留 `0.0.0`)。

## 新套件 `@rfjs/filter-builder`

- public、ISC、`0.0.0`、純函式、ESM+CJS+dts(tsdown)、co-located `*.spec.ts`(vitest)。**鏡像 `packages/pg-filter` 的套件結構**(package.json / tsconfig / tsconfig.build / tsdown.config / vitest.config)。
- **相依**(都是現成 public @rfjs):
  - `@rfjs/pg-filter`(`field-kind` 取 `PgFilterConfig` 型別;`engines/pg-filter` 用 `buildPgFilter` + `PgLeaf`/`PgFilterGroup`/`PgFilterConfig`)
  - `@rfjs/jsonb-query`(`engines/jsonb` 用 `buildJsonbQuery`)
  - `@rfjs/data-filter`(`live-match` 用 `matchQuery`)
  - 依賴 DAG 乾淨無循環(這三者不反向依賴)。
- **src 佈局**(沿用現有結構,size-driven):頂層 `src/*.ts` + `src/engines/*.ts` + 單一 `src/index.ts` barrel。
- **barrel(`src/index.ts`)** 匯出 apps/web 目前用到的完整公開面:
  - 型別:`BuilderGroup`/`BuilderCondition`/`BuilderItem`/`LogicOp`/`FieldKind`/`FieldType`/`ElementType`/`ScalarType`/`FieldSchema`
  - `tree-ops`:`emptyGroup`/`addCondition`/`addGroup`/`setLogic`/`updateNode`/`removeNode`
  - `compile`:`treeToFilterGroup`、`FilterGroupLike`、`FilterConditionLike`
  - `reverse`:`filterGroupToTree`/`parseFilterGroup`/`mergeFieldsFromTree`、`ReverseError`
  - `field-kind`:`canBeColumn`/`mapColumnType`、`SqlColumnType`
  - `field-create`:`addInferredField`;`schema-infer`:`inferSchema`;`value-coerce`:`coerceInput`
  - `live-match`:`runLiveMatch`、`LiveMatchResult`
  - engines:`ENGINE_IDS`/`getEngine`、`Engine`/`EngineId`/`EngineOutput`/`OperatorArity`/`OperatorSpec`/`CompileContext`/`CompileField`、`DATA_FILTER_OPS`
  - (內部交叉 import 如 `engines/pg-filter` → `../field-kind`、`value-coerce` → `engines/types`、`live-match` → `engines/data-filter` 都變成套件內相對 import,跟著一起搬,無變化。)

> 註:依 repo 慣例「package root `src/index.ts` 是 `exports` 的唯一入口、無 deep subpath」。apps/web 目前對 `logic/engines`、`logic/engines/types` 等的 deep import,改為從 `@rfjs/filter-builder` 單一 barrel 取。

## apps/web 重構(行為不變)

1. `apps/web/package.json` 加 `"@rfjs/filter-builder": "workspace:*"`。
2. 刪除 `apps/web/src/tools/query-builder/logic/`(除 `colors.ts` + `colors.spec.ts`),內容移到新套件。
3. 重指 import:所有 `@/tools/query-builder/logic/<x>`(以及 `logic/engines`、`logic/engines/types`)→ `@rfjs/filter-builder`。受影響檔:
   - `ui/index.tsx`、`ui/builder-tree.tsx`、`ui/value-editor.tsx`、`ui/schema-panel.tsx`、`ui/preview-panel.tsx`
   - `logic/colors.ts`(改從 `@rfjs/filter-builder` import `LogicOp`/`FieldType`)
4. `colors.ts` 維持原處與行為(只換型別 import 來源)。
5. `ui/canonical-editor.spec.tsx`(component test)留在 web。

## 測試與驗證(行為不變的證明)

- 搬移過去的所有 `logic/**/*.spec.ts` 在**新套件**內跑:`pnpm -F @rfjs/filter-builder vitest:run`(應與搬移前同樣全綠)。
- apps/web 端:`pnpm -F web vitest:run`(剩下的 `colors.spec.ts` + `ui/canonical-editor.spec.tsx` + registry/i18n/nav 等)、`pnpm -F web check-types`、`pnpm -F web build`(SSG)全綠 = query-builder 行為未變。
- 全域:`pnpm -w build`(新套件納入,21+1 packages)、`pnpm -w typecheck`。
- 因為是「搬檔 + 重指 import」零邏輯改動,綠燈即代表等價。

## 風險 / 注意

- **import 重指面**:~5 個 ui 檔 + colors.ts。機械式但要逐一改、勿漏(deep import `logic/engines/types` 也要收斂到 barrel)。
- **建置順序**:新套件要先 build 出 dist,apps/web 的 vitest/tsc/build 才解析得到(沿用 `pnpm build:packages`;CI 依相依序建)。
- **`@/` alias vs 套件**:web 內 `@/` 指 `apps/web/src`;改成 `@rfjs/filter-builder` 後不再走 alias。確認 tsconfig/vitest alias 不攔截 `@rfjs/*`(現有其他 @rfjs import 已證可行)。
- **公開面完整性**:barrel 必須涵蓋 apps/web 用到的每個符號,否則 web 編不過——以「web 全綠」當守門。
- **不變式**:`reverse` 的 round-trip、engines 的 schema-authoritative compile(B1)、useId(B3)等既有約束都隨檔搬移,行為不變。

## 後續(不在本案)
- **B4-ui**:抽共用的樹編輯器 React 元件(+ headless hook),兩 app 共享。
- **workbench datasets explorer**:用 `@rfjs/filter-builder` 接 `POST /datasets/query`。
- 可選:把 `@rfjs/filter-builder` 註冊進 web 套件型錄(packageRegistry + i18n,如同 sql-filter/pg-filter 那次 PR #173)。
- 可選:npm 發布。

## 相關 memory
[[query-builder-rework-b]](本案 = B4 的 logic 部分)、[[sql-filter-and-datasets-query]]、[[rfjs-open-source-and-layering]]、[[spec-language-traditional-chinese]]、[[commits-and-pr-in-english]]、[[worktree-for-all-implementation]]。
