# Workbench 設計與 apps/web 收斂 Spec

日期：2026-06-13
狀態：待審核
前置文件：`2026-06-12-web-architecture-and-open-source-design.md`（已定案的方向：workbench 進 monorepo、rfjs 轉公開、分層紅線）

## 1. Context

前置文件定了「做什麼、放哪裡」；本文件定「怎麼做」：`apps/workbench` 的完整設計，以及 `apps/web` 因 workbench 出現而需要的收斂調整。

核心原則：**互動工具的實作只存在一份（workbench），web 是內容與導流。**

## 2. 雙站分工

| | apps/web | apps/workbench |
|---|---|---|
| 角色 | 內容站：套件介紹、安裝指南、code 範例、templates gallery、SEO 入口 | 應用站：所有互動工具、dataset 工作台、admin 區 |
| 互動程度 | 輕（後期可嵌迷你 demo） | 重（完整工具頁、IndexedDB、PWA 離線） |
| `/tools` | 索引頁：工具卡片 + 深連結到 workbench | 工具唯一實作地 `tools/[category]/[tool]` |
| `/playground` | 取消（redirect 到 web `/tools` 索引） | 概念由 dataset 工作台取代 |
| 受眾任務 | 「這套件是什麼？怎麼用？」 | 「我要用這工具做事」 |

## 3. apps/web 收斂計畫

1. **導覽改功能分類**：sidebar 與 `/tools` 索引改以 tool `category`（transform / filter / query / inspect）分組；package 降為 badge + 篩選。移除 `lib/nav.ts` 的 `claimed` 單一歸屬去重邏輯（多對多由 badge 呈現，不再強制塞進單一 package 群組）。
2. **`/tools` 索引化**：卡片列出全部工具（名稱、描述、category、related packages、status），點擊連到 workbench 對應工具頁。`/tools/[slug]` 詳細頁路由移除。
3. **`/playground` 全區 redirect** 到 `/tools`。
4. **`/packages/[slug]` 補實**：install 指令、最小 code 範例、相關工具卡片（連 workbench）。嵌入式迷你 demo 為後期可選項，不在本輪。
5. registry 變更見 §9。

## 4. workbench 技術選型

| 層 | 選型 | 理由 |
|---|---|---|
| 框架 | Next 16 App Router（同 apps/web） | pg-toolkit / jwt sign 等遲早需要 server 端，route handlers 免開 API app；i18n / 部署 / 心智模型全複用 |
| UI 基底 | Tailwind v4 + `@rfjs/web-ui`（shadcn） | 既有 tokens 與元件，同站系視覺 |
| Admin shell | shadcn blocks / shadcn-admin 風格（MIT，可移植元件） | collapsible sidebar、topbar、⌘K command palette、breadcrumb |
| 資料表格 | TanStack Table（shadcn data-table pattern） | dataset 預覽與 filter 結果的核心元件 |
| 編輯器 | CodeMirror 6 | JSON 輸入 + SQL/query 輸出高亮；比 Monaco 輕一個數量級、行動裝置可用 |
| 圖表 | recharts | shadcn charts 官方底層 |
| 表單 | react-hook-form + zod | zod schema 與 web-core 複用 |
| State | zustand 5 | 同 apps/web；per-tool vanilla store |
| i18n | next-intl（en + zh-TW） | 複用 apps/web pattern 與 i18n 完整性測試 |
| 主題 | next-themes | 同 apps/web |
| 本地持久化 | IndexedDB via Dexie | dataset 會超過 localStorage 5MB 上限；結構化查詢 |

## 5. 路由與資訊架構

```
apps/workbench/
  app/[locale]/
    (shell)/                    # admin layout：sidebar + topbar + ⌘K
      dashboard/                # 開放：dataset 總覽 + 工具捷徑（+ 未來依角色變化）
      datasets/                 # 開放：內建範例 + 匯入 JSON/CSV + 管理
      tools/[category]/[tool]/  # 開放：工具頁，共用 ToolShell 版型
      admin/                    # 🔒 預留管理區（v1 不出現在 sidebar 或顯示 disabled）
  lib/
    datasets/                   # Dexie 持久層 + 內建 sample datasets
    tool-shell/                 # 共用版型：dataset 選擇器 | 輸入面板 | 輸出面板
    auth/                       # session 介面（v1 僅介面，無實作接線）
```

- 工具是站的主體，**零登入門檻**。
- v1 topbar 右上角放主題切換 / 語言切換 / GitHub 連結；v2 起換成使用者選單。

## 6. 核心架構：Dataset 一等公民

- **Dataset 跨工具共享**：同一份資料在 data-filter 工具篩選、切到 mongo-query 工具生成查詢、再到 transform 工具轉換 — 「資料跟著人走」，展示套件組合價值。
- 內建 3–4 組範例 dataset（如 orders、users、products），訪客零成本開玩；支援匯入 JSON / CSV。
- 持久化：IndexedDB（Dexie），含 dataset metadata（名稱、來源、筆數、建立時間）。
- ToolShell 版型統一：左側（或上方）dataset 選擇器 → 中間工具操作面板 → 輸出面板（結果表格 / 生成的 query / 轉換結果），各工具只實作中間的核心邏輯。

## 7. Auth：介面先行，三階段

**Session 介面（v1 就定案，shape 模仿 OIDC claims）：**

```ts
interface Session {
  user: { id: string; name: string; email: string; image?: string };
  roles: Role[];          // RoleGuard 只看這裡
  provider: 'demo' | 'google' | 'microsoft' | 'email';
}
```

- **v1（本 spec 範圍）**：不做登入。僅建立 `SessionProvider` / `useSession()` / `<RoleGuard>` 介面與 `/admin` 路由保留區，無任何元件實際接線。
- **v2**：demo 級認證 — 登入頁選角色（admin / editor / viewer）進場，session 以 **`@rfjs/jwt`** 簽發（route handler 簽、middleware 驗），middleware matcher 僅掛 `/admin/:path*`；RoleGuard 裁剪 sidebar 與操作。dogfood 自家套件。
- **v3**：better-auth 多 provider（email、Google、Microsoft Entra ID）。session shape 不變，元件零改動。注意：Auth0 與直連 provider 二選一（Auth0 是聚合器），不混用。
- **授權歸屬**：「誰是什麼角色」永遠存在自己的層（v2 = JWT claim，v3 = 自有 DB），IdP 只負責身份，不負責權限。帳號歸戶錨點為 email。

## 8. PWA（雙站）

- 工具：`@serwist/next`（next-pwa 後繼，App Router 支援完整）+ Next 內建 `app/manifest.ts`。dev mode 停用 SW。
- **apps/web**：保守策略 — static assets precache + 造訪過頁面 runtime cache。
- **apps/workbench**：離線優先 — app shell 全 precache。工具為純函式、dataset 在 IndexedDB、公開區不經 auth middleware，斷網全功能是架構自然結果。
- 注意：i18n 兩個 locale 的 shell 都要進 precache 清單；`/admin`（v2 起）離線時以 client-side RoleGuard fallback。
- PWA 設定模式兩站共用，可抽共用 factory。

## 9. Registry 擴充（@rfjs/web-core）

- tool schema 新增 `surface: 'web' | 'workbench'` 欄位（v1 工具全部為 `workbench`）。
- `href` 改為由 surface + slug 推導（workbench 工具的連結在 web 端自動生成深連結），移除手寫 `/tools/...` vs `/playground/...` 的路徑判斷。
- i18n 完整性測試延伸覆蓋 workbench 條目。

## 10. 第一批工具（MVP，建議值 — implementation plan 時可調）

| 工具 | category | 套件 | 選入理由 |
|---|---|---|---|
| type-converter | transform | data-transform | 純函式、輸入輸出直觀，最快打樣 ToolShell |
| object-flatten | transform | object-utils | 同上，與 type-converter 共享版型驗證 |
| data-filter-builder | filter | data-filter | dataset 一等公民的招牌展示：表格 + filter → 即時結果 |
| mongo-query-generator | query | mongo-query | 承接 filter builder 的 filter 條件，展示跨工具組合 |

jwt-decoder 延後：decode 可在瀏覽器跑，但 sign/verify 依賴 Node crypto，需 route handler — 留到 v2（與 demo auth 同期，基礎設施剛好就位）。

## 11. 測試策略

- 單元：vitest + @testing-library/react（同 apps/web 既有設定），工具核心邏輯（純函式包裝層）必測。
- registry：cross-reference 與 i18n 完整性測試延伸至 workbench 條目（既有測試模式）。
- E2E 不在 v1 範圍（工具為純 client 邏輯，單元測試覆蓋核心；之後有 server 端工具再評估 Playwright）。

## 12. 階段路線圖

1. **Phase 1 — apps/web 收斂**（小）：§3 全部。公開後門面先完整。
2. **Phase 2 — workbench MVP**：shell + datasets + §10 四個工具 + registry 擴充。
3. **Phase 3 — PWA**：兩站接 Serwist。
4. **Phase 4 — demo auth（v2）**：登入頁 + @rfjs/jwt session + /admin 區 + jwt-decoder 工具。
5. **Phase 5+（不排程）**：better-auth 多 provider、web 套件頁迷你 demo、pg-toolkit server 端工具。

每個 Phase 各出一份 implementation plan，獨立可交付。

## 13. Out of scope（YAGNI）

- 真實帳號 / 雲端同步（IndexedDB 即可）
- dataset 分享連結（未來可用 URL 編碼加）
- pg-toolkit 真 DB demo（需 server + 沙箱隔離，獨立一輪設計）
- web 套件頁嵌入式迷你 demo（後手可選）
- E2E 測試基礎設施

## 14. Future triggers

- workbench 工具長出領域邏輯 → 畢業到 private 產品 repo（前置文件紅線）。
- 出現「使用者雲端資料」需求 → 啟動 auth v3（better-auth 多 provider）。
- 出現 server 端工具需求（pg-toolkit、jwt sign）→ route handlers 起點已在框架選型中預留。
