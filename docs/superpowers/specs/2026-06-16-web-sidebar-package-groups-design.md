# apps/web 側欄依 @rfjs package 分組 — 設計文件

- 日期：2026-06-16
- 範圍：`apps/web` 左側導覽列
- 狀態：設計定案，待寫實作計畫

## 目標

把 `apps/web` 左側欄目前的「兩條平鋪清單（Packages + Tools）」改成**單一 package 樹**：以 `@rfjs/*` package 作為分類軸，每個 package 是一個群組標題，底下掛該 package 對應的 web 工具。

## 背景：目前狀態

側欄 `apps/web/src/components/layout/app-sidebar.tsx` 渲染兩個獨立區段：

- **Packages**：`sidebarPackages()` 回傳整個 `packageRegistry`，每個 package 連到 `/packages/:slug`。
- **Tools**：`sidebarTools()` 回傳 `toolRegistry` 中 `surface === 'web'` 的工具，平鋪、無分組。

資料來源在 `apps/web/src/lib/nav.ts`，型別與資料來自 `@rfjs/web-core` 的 `packageRegistry` / `toolRegistry`。

關鍵：分組所需資料**已存在**，不需改資料模型。

- 每個 `ToolDefinition` 已有 `relatedPackages: string[]`（例：`query-builder → ['@rfjs/jsonb-query', '@rfjs/data-filter']`）。
- 每個 `PackageDefinition` 已有 `href`、`status`。

因此這是**呈現層**的改動，不是資料模型改動。

## 已定案的設計決策

1. **側欄形狀**：融合成 package 樹。原本獨立的 Packages / Tools 兩區消失，合成一棵以 package 為鍵的樹。
2. **多 package 工具歸屬**：以 `relatedPackages[0]`（主 package）為準，工具只掛在主群組下，不重複出現。`query-builder` 歸在 `jsonb-query`。
3. **收合**：不做收合，全部展開（目前工具數量少，收合屬過度設計）。
4. **沒有 web 工具的 package**：不顯示在側欄（純 lib 的入口交給 `/packages` 頁）。
5. **範圍**：只動左側欄。home 頁、`/packages` 頁這次不動。
6. **分組邏輯位置**：放在 `lib/nav.ts`（既有的側欄資料來源），元件只負責渲染。

## 架構

### 1. 資料塑形 — `apps/web/src/lib/nav.ts`

新增純函式 `sidebarToolGroups()`：

```ts
export type SidebarToolGroup = {
  pkg: PackageDefinition;
  tools: ToolDefinition[];
};

export function sidebarToolGroups(): SidebarToolGroup[];
```

規則：

- 取 `toolRegistry` 過濾 `surface === 'web'`。
- 依每個工具的 `relatedPackages[0]`（主 package 名稱）分組。
- 群組順序沿用 `packageRegistry` 既有順序（人工策展過的順序），只輸出「至少有一個 web 工具」的 package。
- 群組內工具順序沿用 `toolRegistry` 順序。
- 每組用主 package 名稱從 `packageRegistry` 反查 `PackageDefinition`（取得 `href`、`status`）。

孤兒處理：每個 web 工具的主 package 都必須能在 `packageRegistry` 反查到。若反查不到，視為設定錯誤（由測試把關，見下），而非靜默丟棄該工具。

既有的 `sidebarPackages()` / `sidebarTools()`：若仍有其他消費者就保留；側欄改成只吃 `sidebarToolGroups()`。實作時確認是否還有別處引用，沒有引用的就一併移除。

#### 預期輸出（依目前 registry）

| 群組（package） | web 工具 |
| --- | --- |
| data-filter | data-filter-tester |
| data-transform | type-converter |
| jsonb-query | jsonb-query-generator, query-builder |
| jwt | jwt-decoder |
| mongo-query | mongo-query-generator |
| object-utils | object-flatten |

不出現：`data-label`、`pg-toolkit`、`retry`、`tpl-toolkit`（無 web 工具）。

### 2. 側欄渲染 — `apps/web/src/components/layout/app-sidebar.tsx`

從「Packages 區 + 平鋪 Tools 區」改為單一 package 樹：

- 頂部保留一個區段標題，沿用既有 i18n key `Pages.toolsTitle`。
- **群組標題** = package 名（去掉 `@rfjs/` 前綴），標題本身連到 `pkg.href`（`/packages/:slug`），與目前 package 連結呈現方式一致。
- **子項** = 該群組的工具，標題用既有 `t('Tools.${tool.id}.title')`，連到 `toolHref(tool)`。
- 全部展開，不收合。
- 保留現有的 active 高亮（`Seam`）機制；package 標題與工具子項都要能反映 `aria-current`。
- `nav` 的 `aria-label` 沿用合理的既有 key（例如 `Pages.toolsTitle`）。

### 3. i18n — `messages/{en,zh-TW}.json`

不需新增 key：

- 區段標題沿用 `Pages.toolsTitle`。
- 群組標題用 package 名稱（不翻譯，與現況相同）。
- 工具標題沿用既有 deep-merge 的 `Tools` namespace（各工具 feature folder 提供，不動）。
- 側欄不再使用 `Pages.packagesTitle` 當區段標題；該 key 仍被 `/packages` 頁等其他地方使用，故保留。

## 測試

針對 `sidebarToolGroups()` 寫單元測試（唯一具邏輯的部分）：

- 分組正確：每個 web 工具落在其 `relatedPackages[0]` 對應的群組。
- 群組順序＝`packageRegistry` 順序。
- 群組內工具順序＝`toolRegistry` 順序。
- 只輸出有 web 工具的 package（`data-label` / `pg-toolkit` / `retry` / `tpl-toolkit` 不出現）。
- 多 package 工具（`query-builder`）只出現在主 package（`jsonb-query`）下，不在 `data-filter` 重複。
- 無孤兒：每個 web 工具的主 package 都能在 `packageRegistry` 反查到（若有人新增工具忘了對應 package，此測試讓 CI 失敗，而非工具默默從側欄消失）。

元件本身靠 `typecheck` + `build` 把關。

## 資料夾架構

**不需要調整。** feature-folder 結構維持原樣。本次只動三個既有檔案：

- `apps/web/src/lib/nav.ts`
- `apps/web/src/components/layout/app-sidebar.tsx`
- （若需要）`apps/web/src/messages/{en,zh-TW}.json` — 預期不需改，因不新增 key

## 非目標（YAGNI）

- 群組收合/展開狀態。
- home 頁、`/packages` 頁的同步分組（可列為後續）。
- 工具在多個 package 群組下重複顯示。
- 任何資料模型 / registry schema 改動。

## Worktree 計畫

- 命令訊息與 PR 用英文；本設計文件用繁中。
- 清掉已合併的舊 worktree `feat+web-feature-folders`（branch 已隨 PR #169 進 main）。
- 開新 worktree：branch `feat/web-sidebar-package-groups`，路徑 `.claude/worktrees/feat+web-sidebar-package-groups`。
