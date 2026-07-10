# @rfjs/ai-assist 抽離設計（extraction + auth/storage/proxy 能力）

- 日期：2026-07-10
- 分支基準：`origin/main` @ `ae7e413`
- 前置：v1 `#233` + Wave1 `#234` + Wave2/2.5 `#236` 均已 merge、行為穩定
- 相關：`docs/superpowers/specs/2026-07-07-rfjs-ai-assist-design.md`（v1 已宣告本抽離為 follow-up、且「server proxy：seam 不變可後加」）

---

## 1. 背景與目標

AI-assist 是 apps/web 的 **BYOK edit-time AI 層**（baseUrl / apiKey / model，OpenAI-compatible，litellm / Ollama 通吃）。v1 起就以「app-local、套件形狀」暫住 `apps/web/src/lib/ai/`，規劃抽成可發布的 `@rfjs/ai-assist`。本案執行這次抽離，並**順勢補齊**讓它名副其實為「可發布、可重用能力層」所需的三個縫線 + 一個 opt-in 能力。

**本案性質**：refactor-extraction **＋** 三個淨新增能力（auth 抽象 / storage 抽象 / server proxy）＋ opt-in retry。既有 BYOK 行為**逐位元不變**（安全網＝既有測試）；淨新增功能**自帶 TDD**，不靠「行為不變」網。

**鐵律（不變）**：AI 輸出永不直接落地——一律 AI 吐 JSON → 既有 parser/zod 閘門 → 通過才進畫面；`@rfjs/*` 引擎套件維持 AI-free、零改動。

---

## 2. 抽離邊界

### 移進套件（純能力層）
`types` / `settings` / `client` / `use-ai-assist` hook / `log` / `AiPanel`（＋本案新增的 `auth` / `storage` / `proxy`）。

### 永遠留在 app（不進套件）
- 各工具的 prompt 組裝：`tools/_filter-builder/ai-nl-filter.ts`、`ai-explain.ts`；`decision-table/ai-check.ts`、`ai-explain-table.ts`；`form-builder/ai-nl-form.ts`、`ai-explain-form.ts`；`table-builder` 的 NL→TableConfig prompt。
- 驗證閘門接線、各工具 wiring。
- 設定 dialog UI：`components/shared/ai-settings-dialog.tsx`。

app 端把 `@/lib/ai/*` 的 import 全數改為 `@rfjs/ai-assist` / `@rfjs/ai-assist-ui`。

---

## 3. Q1 — 套件切分：核心 + `-ui`

比照既有成功範式 `filter-builder`（pure、發布）vs `filter-builder-ui`（react、private、transpilePackages）。

| 套件 | 內容 | 型態 |
|------|------|------|
| **`@rfjs/ai-assist`** | types / auth / storage / settings / client / proxy / log | **publishable**、isomorphic、tsdown build → `dist/`、`publishConfig.access: public` |
| **`@rfjs/ai-assist-ui`** | `use-ai-assist` hook + `AiPanel` | **`private: true`**、`transpilePackages` 吃 `src/index.ts`、無 build step |

理由：發布側＝框架邊界（npm 上的東西框架中立、要真 build）；私有側可綁 React 且 ship 原始碼（不與 app 的 React 19 / next-intl 版本打架、dev loop 免 build）。命名沿用 `-ui` 後綴（對齊 `web-ui`、`filter-builder-ui`）。

---

## 4. Q2 — 儲存抽象（adapter + browser 預設）

`settings` / `log` 目前寫死 `window.localStorage` + `window` 事件（瀏覽器限定），與「isomorphic 核心」衝突。抽成可注入 adapter，核心自帶 browser 實作為**預設參數**，呼叫端零改動。

```ts
export interface AiStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** settings 響應式訂閱用；回傳取消訂閱。log 不需要。 */
  subscribe?(callback: () => void): () => void;
}

/** 把今天的 localStorage + `rfjs:ai-settings` 自訂事件 + 跨分頁 storage 事件原封包成一個 adapter。 */
export function createBrowserStorage(): AiStorage;
```

- `createAiLog(key, storage: AiStorage = createBrowserStorage())` — 呼叫端 `createAiLog(logKey)` 不變。
- settings 的 load/save/clear/subscribe 同樣改吃 storage，`createBrowserStorage()` 為預設。
- SSR 安全：browser adapter 各方法保留 `typeof window === 'undefined'` 守衛（等同今天行為）。
- 收益：核心誠實 isomorphic（Node/SSR/其他前端可注入 memory/fs adapter）、測試可注入 fake `Map`（免 jsdom localStorage）、app 執行期行為逐位元不變（底層仍是同一套 localStorage + 事件）。

---

## 5. Q3 — 認證 + transport 統一模型

現況 client 寫死「`baseUrl` + `apiKey` → 永遠送 `Authorization: Bearer <apiKey>`」。一般化為 **`baseUrl` + `AuthStrategy`**，一個抽象同時涵蓋 BYOK / Ollama 無 key / proxy 兩端 / 未來 OAuth。

```ts
export interface AuthStrategy {
  readonly kind: 'apiKey' | 'oauth' | 'none';
  /** 貢獻要附加的 header（如 Authorization）。 */
  authHeaders(): Promise<Record<string, string>>;
}

export function apiKeyAuth(apiKey: string): AuthStrategy;   // ✅ 實作：Bearer <key>
export function noAuth(): AuthStrategy;                     // ✅ 實作：不附憑證
export interface OAuthStrategyConfig { /* 未來 "Sign in with Claude/ChatGPT" 形狀 */ }
// oauthAuth：🔒 本案僅定義型別/介面，不實作
```

**transport 不是新概念——它＝「不同 baseUrl + 不同 auth」的組合：**

| 情境 | baseUrl | AuthStrategy | 狀態 |
|------|---------|--------------|------|
| BYOK 直連（今天） | gateway | `apiKeyAuth(key)` | ✅ 逐位元不變 |
| Ollama 無 key | gateway | `noAuth()` | ✅ 收斂既有條件式 |
| Proxy 瀏覽器端 | `/api/ai`（同源） | `noAuth()`（靠同源 cookie） | ✅ 本案實作 |
| Proxy 伺服器端 | gateway | `apiKeyAuth(env.KEY)` | ✅ 本案實作（`createAiProxyHandler`） |
| 未來 OAuth | gateway | `oauthAuth(...)` | 🔒 僅介面 |

**行為保持**：
- `createAiClient(settings: AiSettings)` 對外簽名維持；內部把 `settings` 映射為 `apiKeyAuth(settings.apiKey)`。**空 key 時仍送 `Bearer `（不動它）**，以免「行為改變」——既有 `complete`/`stream` 一律送 Bearer 的行為原樣保留；`listAiModels` 既有「空 key 就省略 Bearer」的條件式維持。（`AuthStrategy` 讓未來要統一時有乾淨落點，但本案不改這個既有差異。）
- 新增 overload：`createAiClient({ baseUrl, model, auth, retry? })` 供 proxy / 未來場景使用。

### server proxy

```ts
export interface AiProxyOptions {
  /** 由呼叫端提供 server 端連線設定（baseUrl / model / apiKey）——通常讀 env / secret。 */
  getServerSettings: (req: Request) => Promise<AiSettings | null> | AiSettings | null;
}

/** framework-agnostic：吃標準 Request，回標準 Response（含 SSE 串流透傳）。
 *  掛進 Next route handler / Fastify / 任何 fetch-style 後端即成 proxy。 */
export function createAiProxyHandler(opts: AiProxyOptions): (req: Request) => Promise<Response>;
```

- 前端 client 走 `proxy` 時，body 帶 `system`/`user`/`json`/`stream`，**不帶任何憑證**；handler 用 server 端 settings 呼叫 gateway、把結果（含逐 chunk SSE）原樣吐回。
- `getServerSettings` 回 `null` → handler 回 `501`/disabled（未配置 server key 時的安全預設）。

---

## 6. Q4 — 韌性策略（opt-in retry）

```ts
export interface RetryPolicy {
  /** 預設 0 → 完全等於今天的行為（既有測試即回歸網）。 */
  maxRetries: number;
  /** 指數退避基準；預設如 500ms。 */
  baseDelayMs?: number;
  /** 是否尊重 429/503 的 Retry-After header；預設 true。 */
  respectRetryAfter?: boolean;
}
```

- **可重試分類**（`AiErrorKind` 的自然延伸）：`http`（429 / 5xx）與 `timeout` **可重試**；`abort` / `config` / 4xx（429 除外）/ `parse` **絕不**重試。
- 指數退避 + jitter；尊重 `Retry-After`。**退避機制內建於 client（~15 行、零依賴）**，不重用 `@rfjs/retry`：HTTP retry 需 status + `Retry-After` 感知，`@rfjs/retry` 只做通用 async 重跑，涵蓋不到分類；且它現 `import 'util/types'`（Node-only），為省數行去改另一發布套件會擴大 blast radius。
- **預設 `maxRetries: 0`**：既有 BYOK 路徑逐位元不變；`maxRetries > 0` 路徑自帶 TDD。
- **parse self-repair**：本案**只設計不實作**。未來擴充掛在同一 policy 面（`onParseError` / repair 次數 hook 的形狀寫入本節），這次**不加任何 dead API**（空 option 屬技術債）。

> 附註（非本案）：`@rfjs/retry` 修成 isomorphic 是獨立的好題目，另開 PR。

---

## 7. Q5 — AiPanel 移進 `-ui` + labels-as-props

`AiPanel` 現況已幾近 generic，唯一 app 耦合為 `useTranslations("ToolUI")`。移進 `@rfjs/ai-assist-ui`，改用 labels-as-props（比照 `filter-builder-ui`）。

- 依賴：`@rfjs/web-ui`（Button/Textarea）、`lucide-react`、同套件 `useAiAssist` 型別、核心 `createAiLog`/`AiAssistEntry`——皆已具備或同 `filter-builder-ui`。
- 改造：拿掉 `useTranslations`，改由 app 傳入約 9 個已翻譯字串（`labels` prop：generate/ask/explain/check 標籤、cancel、notConfigured、viewRaw、thinking、answers、advisory、clear、reapply）。
- **行為逐位元不變**：字串仍為同一批（app 端用同一 `ToolUI` namespace 解析），只是解析點自元件內移至呼叫端。

---

## 8. 檔案佈局

```
packages/ai-assist/                         # @rfjs/ai-assist（publishable）
  src/
    index.ts        barrel（唯一 export 入口）
    types.ts        AiSettings / AiError(kind) / CompleteRequest / StreamDelta / AiClient
    auth.ts         AuthStrategy + apiKeyAuth ✅ / noAuth ✅ / OAuthStrategyConfig 🔒
    storage.ts      AiStorage + createBrowserStorage()
    settings.ts     load/save/clear/isConfigured/subscribe（收 storage，預設 browser）
    client.ts       createAiClient(...) + listAiModels + RetryPolicy（內建退避）
    proxy.ts        createAiProxyHandler(getServerSettings)
    log.ts          AiLogStore + createAiLog(key, storage?)
    *.spec.ts       co-located（既有 + 新增能力的 TDD）
  package.json  tsconfig.json  tsconfig.build.json  tsdown.config.ts  vitest.config.mts
  README.md  README.zh-TW.md

packages/ai-assist-ui/                      # @rfjs/ai-assist-ui（private）
  src/
    index.ts
    use-ai-assist.ts    hook
    ai-panel.tsx        AiPanel（labels-as-props）
    *.spec.tsx
  package.json  tsconfig.json  vitest.config.mts  README.md  README.zh-TW.md
```

- **One barrel**：僅 `src/index.ts` 進 `exports`（無 deep subpath），內部搬移不改發布 API。
- 核心 `platform: 'neutral'`（isomorphic，同 filter-builder 的 lib preset）。

---

## 9. app 遷移（import 改寫）

現有消費端（`grep` 已定位）：
`components/shared/ai-panel.tsx`（→ 移出至套件）、`ai-settings-dialog.tsx`（留 app，改 import）、`tools/_filter-builder/ai-assist-block.tsx`、`tools/decision-table/ui.tsx`、`tools/form-builder/ui.tsx`、`tools/table-builder/ui.tsx`，及各自 `*.spec`。

改寫規則：
- `@/lib/ai/types|settings|client|log` → `@rfjs/ai-assist`
- `@/lib/ai/use-ai-assist`、`@/components/shared/ai-panel` → `@rfjs/ai-assist-ui`
- `AiPanel` 呼叫點補上 `labels={{ ... }}`（app 用既有 `ToolUI` 訊息解析）。
- 移除 `apps/web/src/lib/ai/`（其 spec 隨源碼搬進套件）。
- 兩個 app 的 `next.config` `transpilePackages` 加入 `@rfjs/ai-assist-ui`（core 為已 build 套件，不需列入）。

---

## 10. 安全模型

- **模式一 · 前端 BYOK（apps/web 公開 showcase 預設、本案維持）**：訪客於設定 dialog 配置自己的 baseUrl/key，存於**自己**瀏覽器 localStorage；呼叫為**其瀏覽器 → 其 gateway 直連**。rfjs/Vercel 全程不觸碰任何人的 key。適用信任/自用情境，是公開頁的正確選擇（無共用密鑰、無帳單風險）。localStorage 明文＝XSS 可竊該 origin 的 key，屬 BYOK 固有取捨。
- **模式二 · server proxy（本案做成套件能力 + reference，公開站不啟用）**：瀏覽器不帶憑證 → 打同源 `/api/ai` → 後端以 server-only key（env/secret）呼叫 gateway。key 不落瀏覽器。
  - Vercel：Next.js route handler 原生為 serverless function；非 `NEXT_PUBLIC_` 的 env var 為 server-only、不進 client bundle。SSE 建議 Edge runtime。
  - 交付：`createAiProxyHandler` + proxy transport + **apps/web 的 reference `app/api/ai/route.ts`**（未設 server key 時回 disabled，**預設 UI 仍走 BYOK direct、不呼叫它**）。
  - 「公開站真的以你的 key 啟用試用」＝獨立產品決策（需 rate limit / 登入牆 / 額度），**非本案**。

---

## 11. 淨新增功能 ↔ TDD

| 能力 | 主要測試 |
|------|----------|
| `AuthStrategy`（apiKey/noAuth） | headers 產出；client 以各 strategy 組出正確 request |
| `AiStorage`（+ browser 預設） | fake `Map` adapter 下 settings/log 行為；browser adapter SSR 守衛 |
| `createAiProxyHandler` | direct→proxy 轉發、SSE 串流透傳、`getServerSettings` null → disabled、憑證不外洩 |
| proxy transport（client） | baseUrl=`/api/ai` + noAuth 的請求形狀；串流路徑 |
| opt-in retry | 429/5xx/timeout 重試、abort/config/4xx 不重試、退避、Retry-After、`maxRetries:0` 等同現況 |

既有 `client.spec` / `settings.spec` / `log.spec` / `use-ai-assist.spec` 隨源碼搬入套件，作為 BYOK 行為的回歸網。

---

## 12. 安全網 / 驗證

抽離後全綠：
- `pnpm --filter web vitest:run`（300+）、`pnpm --filter @rfjs/ai-assist vitest:run`、`pnpm --filter @rfjs/ai-assist-ui vitest:run`
- `pnpm --filter web check-types`、`pnpm --filter workbench check-types`、套件 `check-types`
- `pnpm --filter web lint`
- `pnpm --filter web build`、`pnpm --filter workbench build`、`pnpm --filter @rfjs/ai-assist build`
- e2e：打 **production**（`next build` + `next start --port 3002`，絕不 `next dev`）

---

## 13. 交付慣例

- **build/test config**：**建議沿用 sibling 發布套件（`filter-builder`/`data-filter`/`retry`）的 inline `tsdown defineConfig` + inline vitest**——目前**無任何 workspace 套件使用 `tpl-toolkit` factory**（該 factory 面向 `templates/` 標準專案）。brief 提及 tpl-toolkit factory；此為**開放細節（§15）**，於 spec review gate 定案。
- **changeset**：兩套件各附一份（`packages/*` 一律要）。`@rfjs/ai-assist`＝publishable（`minor`，描述新能力）；`@rfjs/ai-assist-ui`＝private（version-only 亦可）。若過程被動改到其他 `packages/*`，補 changeset。
- **README**：雙語（`README.md` + `README.zh-TW.md`），比照 `data-transform`/`retry`。
- **commit/PR**：英文 conventional（subject 全小寫、trailer 前空行、末行恰為 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`）。spec/plan 繁中。
- **worktree**：全程於 `feat-ai-assist-extract` worktree；**HOLD PR**（人工於 GitHub merge）。

---

## 14. 非目標與未來擴充

- **不實作**：OAuth strategy（僅介面）、parse self-repair（僅設計）、公開站啟用 proxy（產品決策）、`@rfjs/retry` isomorphic 化（獨立 PR）、workbench 新增 AI 消費點。
- **未來擴充落點**：`oauthAuth(...)` 填 `AuthStrategy`；`onParseError` self-repair 掛 `RetryPolicy` 面；proxy 啟用只需掛 reference handler + 前置閘門；Wave 3 chat dock 可復用同一 hook/panel/log。

---

## 15. 細節定案（review gate 已確認）

1. **build config 來源**：**inline**（同 sibling `filter-builder`/`data-filter`/`retry`）。目前無 workspace 套件使用 `tpl-toolkit` factory（面向 `templates/`），故不當第一個吃它者；與所有已發布 `@rfjs/*` 一致。
2. **proxy 模式的 model 欄位**：**前端可送 model 作為建議，但 server 端 `getServerSettings` 有最終覆寫/否決權**（避免前端指定任意/昂貴模型）。
