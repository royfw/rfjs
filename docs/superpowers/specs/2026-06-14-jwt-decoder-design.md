# jwt-decoder 網頁工具 — 設計

**日期：** 2026-06-14
**狀態：** 已批准（brainstorming 完成；待 writing-plans）
**範圍：** 讓 `jwt-decoder` 網頁快速工具上線（`/tools` 底下最後一個 coming-soon 工具），dogfood `@rfjs/jwt`。**僅 decode** —— 貼上 JWT，看 header + payload + signature 與即時的有效期狀態。不驗章、不需 secret、不做 refresh flow。

## 背景

`jwt-decoder` 已登記在 `@rfjs/web-core`（`surface: 'web'`、`status: 'planned'`、`relatedPackages: ['@rfjs/jwt']`），但沒有對應元件，所以 `/tools/[slug]` 頁面顯示 coming-soon 狀態。其餘六個網頁工具都已上線；這個補完成 7/7。

跟其他工具（純 client 端的 `lib/tools/*.ts`）不同，`@rfjs/jwt` 在 module 頂層 import `jsonwebtoken`，而它會 `require('crypto')` —— **非 client-safe**。因此 decode 必須在 server 端執行，透過 Next.js route handler。

## 決策（brainstorm 中鎖定）

- **僅 decode。** 不做簽章驗證、不需 secret 輸入。對應工具名稱與 jwt.io 的預設 decode 行為。
- **顯示 header + payload + signature**，外加人話化的有效期狀態。
- **擴充 `@rfjs/jwt`** 以暴露 complete decode（目前只回 payload）。加法、非 breaking。
- **架構：Next route handler**（`POST /api/tools/jwt-decode`），由 client 元件呼叫。`/api/*` 被 next-intl middleware matcher 排除（`(?!api|_next|_vercel|.*\..*)`），無 locale 中介層干擾。
- **兩個獨立的刷新機制：** decode 重跑（server fetch）只在 token 輸入改變時（300ms debounce）；有效期狀態則由 client 端每 1s interval 從已快取的 payload 重算（不額外打 server）。
- **refresh-token / grant flow 不在範圍** —— 那是 Phase 6「demo auth」（sign/verify + login/refresh 端點），獨立功能。

## 架構與資料流

```
components/tools/jwt-decoder.tsx (client)
   │  token 輸入 → 300ms debounce
   ▼
POST /api/tools/jwt-decode  { token }
   │  Jwt.decodeComplete(token)
   ▼
{ ok: true, header, payload, signature } | { ok: false, error: 'invalidJwt' }
   │
   ▼  client 端快取
render: Header Panel + Payload Panel（pretty JSON）+ 有效期 chip
   └─ 1s interval 重算 describeExp(payload.exp, now) —— 只更新 chip，不重打 server
```

## 元件（小而專注）

### 套件層
- **`packages/jwt/src/jwt.ts`** —— 新增 static `Jwt.decodeComplete(token: string)`，包 `jsonwebtoken.decode(token, { complete: true })`。回 `{ header, payload, signature } | null`（malformed token 回 null —— `decode` 是回 null 而非 throw）。static 因為 decode 不需 secret。隨 bump 附一個 changeset（發布是另一步；apps/web 吃 workspace 版）。

### apps/web —— server
- **`apps/web/src/app/api/tools/jwt-decode/route.ts`** —— `export const runtime = 'nodejs'`；`POST` handler：
  - 驗證 body `{ token: string }`（長度 ≥ 1）→ 形狀錯回 **400**。
  - `Jwt.decodeComplete(token)` → `null` → `{ ok: false, error: 'invalidJwt' }`（HTTP 200，request 形狀正確、只是 token 無效）。
  - 否則 `{ ok: true, header, payload, signature }`。

### apps/web —— client 邏輯（盡量純函式）
- **`apps/web/src/lib/tools/jwt-decoder.ts`**
  - `type DecodeResult = { ok: true; header: unknown; payload: unknown; signature: string } | { ok: false; error: 'invalidJwt' | 'request' }`
  - `async function decodeJwt(token: string): Promise<DecodeResult>` —— POST 到 route；非 2xx / 網路失敗對應到 `{ ok: false, error: 'request' }`。
  - `function describeExp(expSec: number | undefined, nowSec: number): { state: 'valid' | 'expired' | 'none'; secondsLeft?: number }` —— **純函式**；`now` 由外部注入（內部不用 `Date.now()`，可測）。人話標籤（如「expires in 23m」）由元件用 `state` + `secondsLeft` + i18n 組出。

### apps/web —— 元件
- **`apps/web/src/components/tools/jwt-decoder.tsx`** —— client 元件，ToolShell 版面：
  - 輸入：token 的 textarea；change 時 300ms debounce → `decodeJwt`。
  - 輸出：`Header` Panel + `Payload` Panel（pretty JSON）+ 有效期 chip。
  - 有效期 chip：1s `setInterval` 從快取結果重算 `describeExp(payload.exp, Math.floor(Date.now()/1000))`；卸載時與無 payload 時清掉。
  - 輸出狀態互斥：空輸入 → 中性；decode 錯誤 → 輸出區顯示錯誤訊息；成功 → Header/Payload/有效期。（每次新的 debounced decode 取代前一次輸出。）

### 接線
- **`apps/web/src/components/tools/registry.tsx`** —— 在 `TOOL_COMPONENTS` 加 `"jwt-decoder": JwtDecoder`（這就是 live 的閘）。
- **`apps/web/src/messages/{en,zh-TW}.json`** —— 在 `ToolUI` 加：`token`、`header`、`payload`、`signature`、`expiresIn`（`"expires in {duration}"`）、`expired`、`noExpiry`、`error.invalidJwt`、`error.request`。（`Tools.jwt-decoder.title/description` 已存在。）
- **`apps/web/package.json`** + `pnpm-lock.yaml` —— 加 `@rfjs/jwt`（`workspace:*`），同一 commit；驗證 `pnpm install --frozen-lockfile`。

## 錯誤處理（皆非破壞性）

| 情況 | 行為 |
|---|---|
| 空輸入 | 不發 request；中性狀態 |
| malformed token（`decode` → null） | route `{ ok:false, error:'invalidJwt' }` → 錯誤訊息 |
| 網路 / 非 2xx | `{ ok:false, error:'request' }` → 通用錯誤訊息 |
| body 形狀錯 | route 回 400 |

client 端永不 import `@rfjs/jwt`（server-only），只有 route handler 用它，保持 client bundle 乾淨。

## 測試

- **`@rfjs/jwt`**（`packages/jwt/src/jwt.spec.ts`，co-located）：`decodeComplete` —— 合法 HS256 token → `{ header:{alg,typ}, payload, signature }`；malformed 字串 → `null`。
- **route handler**（`apps/web/src/app/api/tools/jwt-decode/route.spec.ts`）：import `POST`，餵 `Request` —— 合法 token → 200 `{ ok:true, header, payload }`；malformed → 200 `{ ok:false, error:'invalidJwt' }`；壞 body → 400。
- **`describeExp`**（`apps/web/src/lib/tools/jwt-decoder.spec.ts`）：expired（`exp < now`）、valid（`exp > now`，斷言 `secondsLeft`）、none（`exp` undefined）。`now` 注入。
- 元件：不強求輕量 render —— 有意義的邏輯都在純 helper + route。

## 不在本輪範圍

- 簽章驗證 + secret 輸入。
- refresh-token / grant flow（→ Phase 6 demo auth）。
- 編輯 / 重新編碼 token。
- `tools.ts` 的 `status` 維持 `'planned'`（與已上線的 batch-2 工具一致）；live 的閘是 `TOOL_COMPONENTS` 是否註冊。
