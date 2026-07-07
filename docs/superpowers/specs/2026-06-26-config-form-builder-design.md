# ConfigFormBuilder（視覺化表單建構器）— 設計規格

**日期：** 2026-06-26
**狀態：** 草稿（待審查）
**分支：** `worktree-feat-config-form-builder`

## 1. 摘要

把視覺化表單建構器提前（原 roadmap 的 P3）：一個 **query-builder 式**的 `<ConfigFormBuilder>` —— 用 UI 挑欄位型別、排序、逐欄收合編輯，設定 **grid 版面**，即時預覽且與 Config(JSON) **雙向**，並支援**多語**。最後以 `form-builder` 這個 tool 出現在 `apps/web`。全部建在 P1 已合併的 `@rfjs/form-builder`（引擎）+ `@rfjs/form-builder-ui`（`<ConfigForm>`）之上。

## 2. 背景

- P1（PR #191，已併入 main）交付了 `@rfjs/form-builder`（`FormConfig`/`FieldConfig` 型別、`FormConfigSchema`、`configToZod`）與 `@rfjs/form-builder-ui`（`<ConfigForm>`、`FieldControl`）+ workbench 靜態 dogfood。
- 本子專案 = **視覺編輯器 + grid 版面 + apps/web tool**，是 `filter-builder-ui` 的 `FilterTreeEditor` 在 form 領域的對應物。
- shadcn **registry 散佈（A）** 仍是另一個獨立後續計畫，不在本規格。

## 3. 已定案設計（來自 mockup 反覆驗證）

- **排版**：query-builder 式 —— 欄位編輯區**全寬垂直**、預覽/JSON **堆疊在下方**（不用三欄擠壓）。
- **兩層收合**：**大收合**（整個 Fields 區段一鍵收 + Collapse all）+ **小收合**（每張欄位卡各自展開/收合，收合時只顯示摘要：名稱 · 型別 · 寬度 · required）。
- **grid 版面**：表單層 `columns` + 每欄 `width`（Full/Half），預覽渲染為**自適應網格**（Full 跨整列）。
- **RWD**：窄螢幕自動收側欄、屬性網格轉單欄、預覽網格轉單欄。
- **重排**：欄位以**拖曳排序**（`@dnd-kit`）—— 本專案即導入。
- **多語 label**：`FieldConfig.label` 可為單字串或 per-locale；**builder 內可逐語言編輯 label**，預覽與表單依語言切換（本子專案一併處理，不延後）。
- **JSON 雙向**：Config(JSON) 分頁可編輯，解析回視覺模型（`parseFormConfig` 驗證）。

## 4. 架構與套件

### `@rfjs/form-builder`（引擎，擴充）
- `FieldConfig` 新增 `width?: 'full' | 'half'`（預設 `'full'`）。
- `FormConfig` 新增 `columns?: 1 | 2 | 3 | 4`（預設 `1`）。
- `label` 型別擴充為 `LocalizedLabel = string | Record<string, string>`；新增 `resolveLabel(label, locale, fallbackLocale?): string`。
- **list-ops**（tree-ops 的對應）—— 純函式，回傳新的 `FormConfig`：`addField`、`removeField`、`updateField`、`moveField`（重排）。
- `FormConfigSchema` 更新以驗證 `width`/`columns`/`LocalizedLabel`。
- `configToZod` **不變**（width/columns/label 屬版面與顯示，不影響 data 驗證）。

### `@rfjs/form-builder-ui`（擴充）
- `<ConfigForm>`：新增 **grid 渲染**（`columns` + 每欄 `width` → CSS grid）與 `locale` prop（透過 `resolveLabel` 顯示 label）。
- 新增 deps：`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`（拖曳排序）。
- 新增 `<ConfigFormBuilder>`：視覺編輯器 —— 型別調色盤、**@dnd-kit 拖曳可重排**欄位清單、可收合欄位卡（型別/key/label/width/required 屬性編輯 + Select options 編輯）、columns 控制、**大收合**、即時預覽分頁 + JSON 分頁。接受 `locales: string[]` prop：>1 種語言時 label 編輯顯示**逐語言輸入**、`config.label` 存為 `Record<locale,string>`。builder 介面採 labels-as-props i18n（同 `filter-builder-ui`）。

### `apps/web`
- 新 tool `src/tools/form-builder/{index.ts, ui.tsx, messages.ts}`，包 `<ConfigFormBuilder>`；在 `@rfjs/web-core` 的 `toolRegistry` 註冊（id `form-builder`、category `generator`、surface `web`、status `preview`、relatedPackages `['@rfjs/form-builder','@rfjs/form-builder-ui']`）；加 `TOOL_COMPONENTS` 映射、`transpilePackages`、deps。i18n en/zh-TW。

## 5. 分階段（各自一份 plan，依序實作）

- **Phase 1 — grid 基礎**：引擎加 `width`/`columns` + schema 驗證；`<ConfigForm>` 改用 CSS grid 渲染（含 RWD 單欄）。小而穩，先打底。
- **Phase 2 — 引擎 list-ops + 多語**：`addField`/`removeField`/`updateField`/`moveField` + `resolveLabel` + `LocalizedLabel` schema。純引擎、好測。
- **Phase 3 — `<ConfigFormBuilder>` 視覺編輯器**：調色盤、**@dnd-kit 拖曳重排**欄位清單、兩層收合、屬性/options 編輯、**逐語言 label 編輯**、columns 控制、即時預覽 + JSON 雙向。最大塊。
- **Phase 4 — apps/web tool**：包成 `form-builder` 工具 + i18n + 註冊。

## 6. 開放決策（審查/各 phase 起點定奪）

1. **重排 UX → 定案：拖曳（`@dnd-kit`）**。本專案即導入並使用（後續 filter/排序場景也會用到，先熟悉）。
2. **多語 label 編輯 → 定案：本專案一併處理**。引擎 `LocalizedLabel` + `resolveLabel`；builder 逐語言編輯、表單依 `locale` 渲染。
3. `columns` 上限定 **4**。
4. tool 落點：先 `apps/web`（showcase）；workbench 之後可再掛。

## 7. 測試

- **引擎**：list-ops（add/remove/update/move 的純函式行為）、`resolveLabel`、schema（width/columns/LocalizedLabel 接受與拒絕）、確認 `configToZod` 不受影響。
- **UI**：`<ConfigForm>` grid 渲染（columns/width/Full 跨欄、RWD 單欄）；`<ConfigFormBuilder>` 互動（新增/刪除/重排/編輯、兩層收合、columns、JSON 雙向回填）。
- **web tool**：typecheck + 渲染煙霧測試。

## 8. 非目標（YAGNI）

- 巢狀「分組 / section / 多步驟」—— 之後再說（表單先扁平）。
- registry 散佈（A）—— 獨立計畫。
- `configToZod` 行為變更 —— 不動（版面/顯示不影響 data 驗證）。
