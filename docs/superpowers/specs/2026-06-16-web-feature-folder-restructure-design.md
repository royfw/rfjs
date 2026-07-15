# apps/web feature-folder 編排重組 — 設計

> 子專案 **A**(結構)。屬純行為保持(behavior-preserving)重構,不改任何 tool 的功能或畫面。
> 後續子專案:**B**(query-builder 反向讀取 + 三欄畫面,見 memory `query-builder-rework-b`)、**C**(抽 canonical 邏輯成 public lib)—— 皆與本案獨立,本案不觸碰。

## 背景與動機

`apps/web` 目前的 quick tools 按「技術層」分散在三處:

- `src/lib/tools/<tool>.ts` — 純邏輯(薄包一個 `@rfjs/*` 套件)
- `src/components/tools/<tool>.tsx` — React UI
- `src/components/tools/registry.tsx` — 手維護的 `id → Component` 對照表
- `src/messages/{en,zh-TW}.json` — 單檔 namespace,內含每個 tool 的 `Tools.<id>` 與 `ToolUI.*`

一個 tool 的程式被拆到三、四個地方,新增/刪除/理解一個 tool 都要跨檔跳。本案把編排改成「**按 feature 分**」:每個已實作 tool 一個自足資料夾,把該 tool 的 logic、UI、i18n 字串 co-locate,並讓 registry 自動組裝。

## 關鍵約束(設計邊界)

**catalog metadata 必須留在 `@rfjs/web-core`。** `toolRegistry`(`{id, category, surface, status, relatedPackages, tags}`)是跨 surface 的目錄,`apps/workbench` 也依賴它(`dashboard`、`apps/[slug]` 等頁面 import `@rfjs/web-core`)。packages 不能反向依賴 apps,因此 catalog 不能搬進 `apps/web` 的 feature 資料夾。

由此把 registry 的責任拆成兩層:

| 層 | 內容 | 位置 | 本案是否變動 |
|----|------|------|------|
| **catalog**(跨 surface) | tool 存在嗎 / 屬哪類 / 關聯哪套件 / 狀態 | `@rfjs/web-core`(`toolRegistry`) | **不動** |
| **implementation**(apps/web 本地) | logic、UI、component 註冊、i18n 字串 | `apps/web/src/tools/<id>/` | 本案建立 |

兩層以同一個 `id` 對齊。`apps/web` 只實作 catalog 的子集(有 `TOOL_COMPONENTS` 的那些);workbench/planned 條目沒有 feature 資料夾。

## 目標結構

```
apps/web/src/tools/
  _shared/
    tool-shell.tsx              # 跨 tool 共用 layout(由 components/tools/ 搬入)
  jwt-decoder/                  # 小 tool:扁平
    jwt-decoder.ts
    jwt-decoder.spec.ts
    ui.tsx
    messages.ts
    index.ts                    # export const tool = { id, Component, messages }
  query-builder/                # 大 tool:子資料夾(依 CLAUDE.md size-driven)
    logic/
      schema-infer.ts (+spec)  compile.ts (+spec)  value-coerce.ts (+spec)
      tree-ops.ts (+spec)  live-match.ts (+spec)  types.ts
      engines/  (types, arity, jsonb(+spec), data-filter(+spec), index(+spec))
      index.ts                  # logic barrel
    ui/
      builder-tree.tsx  schema-panel.tsx  preview-panel.tsx  value-editor.tsx
      index.tsx                 # QueryBuilder component
    messages.ts
    index.ts
  index.ts                      # 組裝 implementation registry(取代 components/tools/registry.tsx)
```

內部形狀 **size-driven, not uniform**(遵 CLAUDE.md):小 tool 扁平、大 tool 用 `logic/` + `ui/` 子資料夾。feature 資料夾的「邊界」一致,內部結構依大小。

`src/lib/` 的非 tool 檔(`nav.ts`、`tool-href.ts`、`i18n-content.ts` 及其 spec)**原地不動** —— 它們不是 tool 實作。

## Tool descriptor 與 implementation registry

每個 feature 資料夾的 `index.ts` 匯出一個 descriptor:

```ts
// src/tools/jwt-decoder/index.ts
import { JwtDecoder } from "./ui";
import { messages } from "./messages";
import type { ToolModule } from "@/tools/types";

export const tool: ToolModule = { id: "jwt-decoder", Component: JwtDecoder, messages };
```

descriptor 形狀只需 `{ id, Component, messages }`。`operation` 標籤(`ToolShell` 的 `operation` prop,如 `"decodeComplete()"`)是顯示字串、**留在 component 內**,不進 descriptor。

`src/tools/index.ts` 自動組裝,取代手維護的 `registry.tsx`:

```ts
export const toolModules: ToolModule[] = [typeConverter, objectFlatten, /* … */];
export const TOOL_COMPONENTS: Record<string, ComponentType> =
  Object.fromEntries(toolModules.map((t) => [t.id, t.Component]));
export const toolMessages = toolModules.map((t) => t.messages);
```

`ToolModule` 型別與 `assembleMessages` 放 `src/tools/types.ts` / `src/tools/messages.ts`(或 `i18n/`,見下)。

## i18n co-locate 與合併

next-intl 是「每 locale 載入單一 merged 物件」。本案把每個 tool 的 i18n 片段 co-locate,於載入時 deep-merge。

**每個 `messages.ts` 貢獻自己 tool 的 key,掛在原 namespace 下:**

```ts
// src/tools/query-builder/messages.ts
export const messages = {
  en: {
    Tools: { "query-builder": { title: "…", description: "…" } },
    ToolUI: { builder: "…", elemMatchPlaceholder: "…", notPreviewable: "…" },
  },
  "zh-TW": { Tools: { "query-builder": { /* … */ } }, ToolUI: { /* … */ } },
};
```

保留 `Tools` / `ToolUI` namespace,所以所有 `useTranslations("Tools")` / `useTranslations("ToolUI")` 呼叫**完全不用改**。

**中央 `src/messages/{en,zh-TW}.json` 保留**:
- 全域 namespace:`Common / Home / Features / Pages / LocaleSwitcher / Status / Detail / Packages`
- **共用** `ToolUI` key:`input / output / inputValue / targetType / jsonInput / copy / error`(跨多 tool)
- **未實作 tool** 的 `Tools.<id>`(workbench/planned,如 `data-filter-builder`、`object-transformer` —— 它們沒有 feature 資料夾)

**合併函式**(單一真相,request 與測試共用):

```ts
// assembleMessages(locale) = deepMerge(globalJson[locale], ...toolMessages.map((m) => m[locale]))
```

`src/i18n/request.ts` 改用 `assembleMessages(locale)` 取代直接 `import(.../${locale}.json)`。

**每個 tool 專屬的 `ToolUI` key** 從中央 json 搬進該 tool 的片段(分類示例):
- jwt-decoder:`token / payload / signature / expiresIn / expired / noExpiry`
- query-builder:`builder / elemMatchPlaceholder / notPreviewable`
- query 類(data/filter/column/dialect):依實際使用歸給對應 tool;若真的跨多 tool 共用則留中央。

歸類以「實際只有該 tool 用到」為準;有疑慮就留中央(較安全)。

## 遷移範圍

遷移 7 個已實作 tool:`type-converter`、`object-flatten`、`data-filter-tester`、`mongo-query-generator`、`jsonb-query-generator`、`jwt-decoder`、`query-builder`。

每個 tool:搬 logic(含 `*.spec.ts`)→ 搬 UI → 抽 i18n 片段 → 建 descriptor `index.ts` → 更新 import 路徑(`@/` alias)→ 刪舊 `lib/tools/<tool>` 與 `components/tools/<tool>`。

`components/tools/tool-shell.tsx` 搬到 `src/tools/_shared/tool-shell.tsx`;`components/tools/registry.tsx` 由 `src/tools/index.ts` 取代後刪除。

## 需更新的既有測試

- `src/lib/i18n-content.spec.ts`:現在直接 `import en from "../messages/en.json"`,搬走的 `Tools.<id>` 會找不到。改成對 **`assembleMessages(locale)`** 斷言(這其實是更貼近 runtime 的測試)。
- 新增守門測試:
  - `assembleMessages` 後,每個 `toolRegistry` id 在兩 locale 都有 `title` + `description`。
  - 各 tool 片段的 `ToolUI` key 無重複碰撞(deep-merge last-wins,避免互蓋)。
  - `TOOL_COMPONENTS` 的 id 集合 ⊆ catalog id,且每個 `surface:'web'` 且非 `planned` 的 catalog id 都有對應 module(實作/目錄一致性)。

## 風險

- **import 路徑**:大量檔案移位,`@/tools/...` alias 與相對 import 要逐一更新。
- **`tools/[slug]` 頁面**:改 import 新 barrel 的 `TOOL_COMPONENTS`。
- **vitest glob**:`src/**/*.spec.ts` 不受資料夾位置影響,**免改設定**。
- **build(SSG)**:`tools/[slug]` 須仍能 prerender(51 靜態頁)。
- **tool-shell 搬家**:所有 import 它的 component 要更新路徑。

## 測試策略

行為保持重構。原則:`*.spec.ts` 跟著搬、持續綠燈。

逐 tool 搬移,每搬一個跑一次 `pnpm -F web exec vitest run`;i18n 合併與 registry 組裝完成後加上述守門測試。最後完整驗證:`pnpm -F web exec vitest run`(全綠)、`pnpm -F web check-types`、`pnpm -F web lint`、`pnpm -F web build`、頁面 HTTP 200。

baseline(本案起點):web 89 測試全綠。

## 不做(YAGNI / 邊界外)

- 不抽任何東西到 `packages/`(那是子專案 C)。
- 不改 query-builder 的功能或畫面(那是子專案 B)。
- 不動 `@rfjs/web-core` 的 catalog 結構。
- 不改 `apps/workbench`。
- 不重排 `src/lib/` 的非 tool 檔。
