# `@rfjs/data-schema-ui` package 抽取 — 設計

- 日期:2026-07-12
- 狀態:設計待審
- 前置:#249(已 merge)—— 共用 `ProtocolPanel` 已落在 `apps/web/src/components/protocol-panel/`

## 一句話

把 app-level 的 `ProtocolPanel`(DataResourceMeta 的 request/response 協定編輯器)升成 package `@rfjs/data-schema-ui`,對齊 `@rfjs/filter-builder` ↔ `@rfjs/filter-builder-ui` 的「engine + UI 姊妹」形態;順手把純 fetch 的 `makeHttpFetcher` 從 `@rfjs/table-builder-ui` 下沉到 engine `@rfjs/data-schema`,修正分層。

## 動機

- `@rfjs/data-schema`(DataResourceMeta 引擎)是唯一沒有 UI 姊妹的核心引擎。filter-builder / table-builder 都有 `*-ui`。
- `ProtocolPanel` 目前是 app-level 共用元件(#249),已被 metadata-builder + table-builder 兩個工具消費 —— 這正是「該進 package」的訊號(跨工具共用、與 app 無關)。
- 這是先前討論的「data-flow 共用層」的**正確、right-sized 落點**:engine(data-schema,已有)+ 共用編輯器(data-schema-ui,本 spec)。不擴張成大一統框架(form-builder 的單值 fetch / flow-builder 無 fetch,刻意不併)。

## 現況(要搬的東西)

- `apps/web/src/components/protocol-panel/index.tsx` —— `ProtocolPanel` + `ProtocolPanelLabels`(~25 欄)+ `Seg`/`LabeledText` 子元件 + `DEFAULT_REQUEST`/`DEFAULT_RESPONSE`。
  - deps:`@rfjs/web-ui`(Switch)、`@rfjs/data-schema`(buildRequestParams/extractRows/型別)、`@rfjs/table-builder-ui`(makeHttpFetcher — 反向依賴,要拆掉)。
  - props:`showEnableToggle?: boolean`(#249)。
- `packages/table-builder-ui/src/http-fetcher.ts` —— `makeHttpFetcher(request: RequestMeta): (built: BuiltRequest) => Promise<unknown>`。只依賴 `@rfjs/data-schema` 型別,零 UI。由 table-builder-ui `index.ts` re-export;被 table-builder tool 與 protocol-panel 消費。

## 目標架構

```
@rfjs/data-schema (engine, 既有)
  + makeHttpFetcher   ← 從 table-builder-ui 下沉(純 fetch,屬引擎)
        ▲                         ▲
        │                         │
@rfjs/data-schema-ui (新, private) │
  ProtocolPanel + labels + defaults
        ▲                         │
        │ transpilePackages       │
   apps/web:                      │
     metadata-builder ── import ──┤
     table-builder ──── import ───┘ (fetcher 從 data-schema 或 table-builder-ui re-export 取)
```

- `@rfjs/data-schema-ui` deps = `@rfjs/data-schema` + `@rfjs/web-ui`(**對齊 filter-builder-ui** 的形態;不再依賴 table-builder-ui。ProtocolPanel 未用 lucide-react → 不加,YAGNI)。
- `private: true`(依賴 `@rfjs/web-ui` 私有設計系統,與 filter-builder-ui 同);依 changeset 政策 → version-only changeset。

## 變更清單

### 1. `makeHttpFetcher` 下沉到 `@rfjs/data-schema`
- 新增 `packages/data-schema/src/http-fetcher.ts`(內容同現況,import 型別改為相對/同 package)。
- `data-schema/src/index.ts` 加 `export * from './http-fetcher'`。
- `@rfjs/table-builder-ui` 改為 **re-export** 以維持既有 API:`export { makeHttpFetcher } from '@rfjs/data-schema'`(刪掉自身實作檔),避免破壞 table-builder tool 的 `import { ConfigTable, makeHttpFetcher } from '@rfjs/table-builder-ui'`。
- changeset:`@rfjs/data-schema` minor(新增 API)、`@rfjs/table-builder-ui` patch(內部改 re-export,對外 API 不變)。
- 測試:把既有 http-fetcher 的 spec 一併搬到 data-schema(GET querystring / POST body / filter param / 非 2xx throw)。

### 2. 建立 `packages/data-schema-ui`
- 鏡射 `packages/filter-builder-ui` 結構:`package.json`、`tsconfig.json`、`vitest.config.mts`、`README.md`/`README.zh-TW.md`、`src/index.ts`、`src/protocol-panel.tsx`、`src/types.ts`(labels 型別)。
- `package.json`:name `@rfjs/data-schema-ui`,`private: true`,`exports { ".": "./src/index.ts" }`,deps `@rfjs/data-schema` + `@rfjs/web-ui`,devDeps/peerDeps 比照 filter-builder-ui(React 19)。
- `src/protocol-panel.tsx`:從 `apps/web/src/components/protocol-panel/index.tsx` 原封搬入;唯一改動 = `makeHttpFetcher` 改從 `@rfjs/data-schema` import(不再從 table-builder-ui)。
- `src/index.ts`:`export { ProtocolPanel, DEFAULT_REQUEST, DEFAULT_RESPONSE } from './protocol-panel'; export type { ProtocolPanelLabels } from './types'`。
- 搬 protocol-panel 的既有 spec 進 package(改 render import 來源)。

### 3. apps/web 接線
- 刪 `apps/web/src/components/protocol-panel/`。
- metadata-builder + table-builder 的 `import ... from "@/components/protocol-panel"` → `from "@rfjs/data-schema-ui"`。
- `apps/web/next.config.js` `transpilePackages` += `"@rfjs/data-schema-ui"`。
- `apps/web/src/app/globals.css` 加 `@source "../../../../packages/data-schema-ui/src"`(Tailwind 掃描 package 內 class,同 filter-builder-ui/form-builder-ui 的既有陷阱註解)。
- 保持兩工具行為/外觀不變(由既有 spec 迴歸覆蓋)。

### 4. Changesets
- `@rfjs/data-schema` minor、`@rfjs/table-builder-ui` patch、`@rfjs/data-schema-ui` minor(新 package 首發;private → 版本紀錄用)、**`web` patch(apps 也要 changeset —— 2026-07-12 政策更新)**。

## 明確不做(YAGNI / 分層)
- 不把 form-builder 的 `DataSource`(單值/options fetch)併進 data-schema —— 形狀本質不同(無分頁/多方言/label-value),併 = 過度抽象。
- 不動 metadata-builder / table-builder 的功能與版面(純抽取;版面統一是另一輪 deferred)。
- `data-schema-ui` 不做成 publishable(依賴私有 web-ui,同 filter-builder-ui)。
- ProtocolPanel 內部不重構(labels-as-props / 子元件維持原樣)。

## 驗收
- `pnpm -F web check-types && pnpm -F web lint` 乾淨;metadata-builder / table-builder 既有測試全過。
- `@rfjs/data-schema` / `@rfjs/data-schema-ui` / `@rfjs/table-builder-ui` 各自 `check-types` + `test` 過。
- 截圖:metadata-builder 協定面板 + table-builder Remote 協定面板外觀與 #249 一致(抽取零回歸)。
- `grep` 確認 apps/web 無殘留 `@/components/protocol-panel`;table-builder-ui 對外仍匯出 `makeHttpFetcher`。

## 對 ② 的關係
② (table-builder 資源為中心 UX)會 **consume** 本 package 的 `ProtocolPanel`。① 先 merge,② 於更新後的 main 上開發。
