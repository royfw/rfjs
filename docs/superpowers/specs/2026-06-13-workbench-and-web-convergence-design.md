# Workbench 設計與 apps/web 收斂 Spec

日期：2026-06-13（rev 2 — 審核後修訂：快速工具留 web、分組延後、新增部署章節）
狀態：待審核
前置文件：`2026-06-12-web-architecture-and-open-source-design.md`（已定案：workbench 進 monorepo、rfjs 轉公開、分層紅線）

## 1. Context

前置文件定了「做什麼、放哪裡」；本文件定「怎麼做」：`apps/workbench` 的完整設計，以及 `apps/web` 的收斂調整。

核心原則：**每個工具的實作只存在一份，按「形態」分家** — 單輸入單輸出的快速工具屬於 web，dataset 驅動的應用屬於 workbench。此區分與 registry 原始的 tools / playground 二分完全對應。

## 2. 雙站分工

| | apps/web | apps/workbench |
|---|---|---|
| 角色 | 內容站 + **快速工具**：套件介紹、安裝指南、code 範例、templates、貼上→結果→走人的工具 | **應用平台**：dashboard、dataset 工作台、跨套件組合、admin 區 |
| 工具形態 | 單輸入單輸出、無狀態、純 client 函式 | dataset 驅動、有狀態、跨工具串接 |
| 收什麼 | registry 原 6 個 tools（jwt-decoder、type-converter、object-flatten、data-filter-tester、mongo/jsonb query generator） | registry 原 2 個 playground（data-filter-builder、object-transformer）+ datasets + dashboard + admin |
| 典型動線 | 搜「jwt decoder」→ 落地 → 解碼 → 離開 | 匯入訂單資料 → 篩選 → 生成 mongo query → 轉換輸出 |
| SEO | 是（工具頁是搜尋入口） | 否 |

## 3. apps/web 收斂計畫（中間路線：被迫要動的才動，分組延後）

1. **Sidebar 重做**：改為兩個平鋪區段 —「Packages」（11 個套件連結）+「Tools」（6 個快速工具連結）。移除 `lib/nav.ts` 的 package→tools 結構與 `claimed` 去重 hack（工具不再掛在套件之下，多對多由工具卡片上的 package badge 呈現）。
2. **`/tools` index**：保持平鋪卡片（現規模不分組；registry 已有 `category` 欄位，未來工具變多時加分組是純呈現層改動）。卡片分兩種：web 快速工具 → 站內 `/tools/[slug]`；workbench 應用 → 跨站深連結（標注 badge 區分）。
3. **`/tools/[slug]` 保留並做成真的**：6 個快速工具的實作頁。共用輕量工具版型（輸入面板 / 輸出面板），基礎元件放 `@rfjs/web-ui` 與 workbench ToolShell 共享。
4. **`/playground` 全區 redirect** 到 `/tools`。
5. **`/packages/[slug]` 補實**：install 指令、最小 code 範例、相關工具卡片（站內或 workbench）。
6. **`/packages` index 不動**（平鋪；分組延後，同第 2 點理由）。

## 4. workbench 技術選型

| 層 | 選型 | 理由 |
|---|---|---|
| 框架 | Next 16 App Router（同 apps/web） | server 端需求（jwt sign、pg-toolkit）用 route handlers，免開 API app；i18n / 部署 / 心智模型複用 |
| UI 基底 | Tailwind v4 + `@rfjs/web-ui`（shadcn） | 既有 tokens，同站系視覺 |
| Admin shell | shadcn blocks / shadcn-admin 風格（MIT） | collapsible sidebar、topbar、⌘K、breadcrumb |
| 資料表格 | TanStack Table（shadcn data-table pattern） | dataset 預覽與 filter 結果的核心元件 |
| 編輯器 | CodeMirror 6 | JSON 輸入 + query 輸出高亮；比 Monaco 輕一個數量級 |
| 圖表 | recharts | shadcn charts 官方底層 |
| 表單 | react-hook-form + zod | zod schema 與 web-core 複用 |
| State | zustand 5 | 同 apps/web |
| i18n | next-intl（en + zh-TW） | 複用 apps/web pattern 與測試 |
| 本地持久化 | IndexedDB via Dexie | dataset 超過 localStorage 上限；結構化查詢 |

web 快速工具不需要以上重型件：純 client component + 共用輸入/輸出版型即可。

## 5. workbench 路由與資訊架構

```
apps/workbench/
  app/[locale]/
    (shell)/                # admin layout：sidebar + topbar + ⌘K
      dashboard/            # 開放：dataset 總覽 + 應用捷徑
      datasets/             # 開放：內建範例 + 匯入 JSON/CSV + 管理
      apps/[slug]/          # 開放：應用頁（data-filter-builder、object-transformer…）
      admin/                # 🔒 預留管理區（v1 不出現在 sidebar 或顯示 disabled + 🔒）
  lib/
    datasets/               # Dexie 持久層 + 內建 sample datasets
    app-shell/              # 應用共用版型：dataset 選擇器 | 操作面板 | 輸出面板
    auth/                   # session 介面（v1 僅介面，無接線）
```

- 應用是站的主體，零登入門檻。
- v1 topbar 右上：主題 / 語言 / GitHub 連結；v2 起換使用者選單。

## 6. 核心架構：Dataset 一等公民

- Dataset 跨應用共享：同一份資料在 filter-builder 篩選 → 切到 query 生成 → 轉換輸出，「資料跟著人走」。
- 內建 3–4 組範例 dataset（orders、users、products），零成本開玩；支援匯入 JSON / CSV。
- 持久化：IndexedDB（Dexie），含 dataset metadata（名稱、來源、筆數、建立時間）。
- 應用版型統一：dataset 選擇器 → 操作面板 → 輸出面板，各應用只實作中間核心。

## 7. Auth：介面先行，三階段

**Session 介面（v1 定案，shape 模仿 OIDC claims）：**

```ts
interface Session {
  user: { id: string; name: string; email: string; image?: string };
  roles: Role[];          // RoleGuard 只看這裡
  provider: 'demo' | 'google' | 'microsoft' | 'email';
}
```

- **v1（本 spec 範圍）**：不做登入。僅建立 `SessionProvider` / `useSession()` / `<RoleGuard>` 介面與 `/admin` 保留區，無元件接線。
- **v2**：demo 級 — 登入頁選角色（admin / editor / viewer），session 以 **`@rfjs/jwt`** 簽發（route handler 簽、middleware 驗），matcher 僅掛 `/admin/:path*`；RoleGuard 裁剪 sidebar 與操作。dogfood 自家套件。
- **v3**：better-auth 多 provider（email、Google、Microsoft Entra ID）。session shape 不變、元件零改動。Auth0 與直連 provider 二選一（聚合器），不混用。
- **授權歸屬**：角色永遠存自己的層（v2 = JWT claim，v3 = 自有 DB），IdP 只管身份；帳號歸戶錨點 email。

## 8. PWA（雙站）

- 工具：`@serwist/next` + Next 內建 `app/manifest.ts`。dev mode 停用 SW。
- **apps/web**：static assets precache + 造訪頁 runtime cache；快速工具為純 client 函式 → **離線直接可用**。
- **apps/workbench**：離線優先 — app shell 全 precache；應用純函式 + dataset 在 IndexedDB + 公開區不經 auth middleware → 斷網全功能。
- 注意：兩個 locale 的 shell 都要 precache；`/admin`（v2 起）離線以 client-side RoleGuard fallback。
- PWA 設定模式兩站共用，可抽 factory。

## 9. Registry 擴充（@rfjs/web-core）

- tool schema 新增 `surface: 'web' | 'workbench'`：`web` = 快速工具（6 個）、`workbench` = 應用（2 個）。原 tools/playground 的 href 路徑二分由 surface 取代。
- href 推導：web 工具 → `/tools/[slug]`；workbench 應用 → `${NEXT_PUBLIC_WORKBENCH_URL}/apps/[slug]`（完整 URL 部署時組，registry 只存 slug）。
- i18n 完整性測試延伸覆蓋全部條目。

## 10. MVP 批次（建議值 — implementation plan 時可調）

**web 快速工具（第一批 3 個，驗證版型）：**

| 工具 | 套件 | 備註 |
|---|---|---|
| type-converter | data-transform | 純函式，最快打樣 |
| object-flatten | object-utils | 與上者共享版型驗證 |
| jwt-decoder | jwt | **decode-only**（純 base64 解析，client 可跑）；sign/verify 留待 v2 route handler |

第二批：data-filter-tester、mongo-query-generator、jsonb-query-generator（皆純函式輸出字串，client 可跑）。

**workbench MVP：**shell + datasets + **data-filter-builder**（招牌：表格 + filter → 即時結果）→ 串接 query 生成輸出。object-transformer 次批。

## 11. 測試策略

- 單元：vitest + @testing-library/react（同 apps/web 既有），工具/應用核心邏輯必測。
- registry：cross-reference 與 i18n 完整性測試延伸至新欄位與全部條目。
- E2E 不在 v1（純 client 邏輯由單元覆蓋；server 端工具出現後再評估 Playwright）。

## 12. 部署

- 兩個 app 走既有 GitLab deploy 管線（`deploy/dev` → k8s，同 `rfjs-dev` namespace 模式），各自一個容器 + Ingress host。
- **Subdomain 策略**（不用 path-based）：web 在主 domain、workbench 在子 domain（如 `workbench.*`）。理由：兩個獨立 PWA 各需乾淨的 service worker scope；path-based 要疊 `basePath` + serwist + next-intl 三層設定。
- web 以 `NEXT_PUBLIC_WORKBENCH_URL` 組跨站深連結。
- 自有 k8s + DB 資源使未來 server 端工具（jwt sign/verify、pg-toolkit 沙箱 demo）可低成本落地 — 見 §15。

## 13. 階段路線圖

1. **Phase 1 — web 收斂**：§3 的 1/2/4/5/6（sidebar、index 連結、redirect、套件頁補實）。公開後門面先完整。
2. **Phase 2 — web 快速工具**：工具版型（@rfjs/web-ui 共用基礎）+ 第一批 3 工具；第二批接續。
3. **Phase 3 — workbench MVP**：shell + datasets + data-filter-builder + registry `surface` 擴充。
4. **Phase 4 — PWA**：兩站接 Serwist。
5. **Phase 5 — demo auth（v2）**：登入頁 + @rfjs/jwt session + `/admin` 區 + jwt sign/verify 升級。
6. **Phase 6+（不排程）**：better-auth 多 provider、pg-toolkit 沙箱 demo、web index 分組。

每個 Phase 各出一份 implementation plan，獨立可交付。

## 14. Out of scope（YAGNI）

- 真實帳號 / 雲端同步（IndexedDB 即可）
- dataset 分享連結（未來可用 URL 編碼）
- pg-toolkit 真 DB demo（需沙箱隔離設計，見 §15）
- packages / tools index 的分組呈現（規模到了再做，registry 資料已備）
- E2E 測試基礎設施

## 15. Future triggers

- workbench 應用長出領域邏輯 → 畢業到 private 產品 repo（前置文件紅線）。
- 出現使用者雲端資料需求 → auth v3（better-auth 多 provider）。
- server 端工具需求成熟 → 在自有 k8s 開沙箱 Postgres（獨立 namespace、定時重置），pg-toolkit demo 落地；route handlers 起點已預留。
- 工具 / 套件數量成長到平鋪掃讀失效（約 15+/20+）→ 啟用 category / 套件分組呈現。
