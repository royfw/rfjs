# @rfjs/ai-assist

> [English](./README.md) · 繁體中文

BYOK（自帶 API key）的編輯時 AI 能力層，面向 OpenAI-compatible 端點 —— 涵蓋
設定、`complete`/SSE `stream` client、可插拔的認證策略、可注入的儲存縫線、
互動紀錄，以及一個 framework-agnostic 的伺服端 proxy handler。Isomorphic、
零框架依賴。

## 安裝

```bash
pnpm add @rfjs/ai-assist
```

## 使用方式

### `createAiClient(settings).complete` / `.stream`

用 `AiSettings`（BYOK 表單：`baseUrl` + `apiKey` + `model`）建立 client，呼叫
OpenAI-compatible 的 `/chat/completions` 端點。

```typescript
import { createAiClient, type AiSettings } from '@rfjs/ai-assist';

const settings: AiSettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-...',
  model: 'gpt-4o-mini',
};

const client = createAiClient(settings);

// 單次完成
const answer = await client.complete({
  system: 'You are a JSON generator.',
  user: 'Produce a table config for a users list.',
  json: true, // 帶上 response_format: { type: 'json_object' }
});

// SSE 串流（僅用於 display-only 純文字——產生類流程仍走 complete）
const full = await client.stream(
  { system: 'You are a helpful assistant.', user: 'Explain this filter.' },
  (delta) => {
    if (delta.content) process.stdout.write(delta.content);
    if (delta.reasoning) process.stdout.write(`[reasoning] ${delta.reasoning}`);
  },
);
```

`createAiClient` 也接受較低階的 `AiClientConfig`（`baseUrl` + `model` +
`auth: AuthStrategy` + 可選 `retry: RetryPolicy`），供非 BYOK 呼叫端使用，例如
走 proxy 的 client —— 見下方認證段落。重試為 opt-in（`maxRetries` 預設
`0`，即行為不變），只重試 `429`/`5xx`/timeout，並在有 `Retry-After` header 時
遵循它（僅解析數字秒數形式；HTTP-date 形式會退回指數退避）。

錯誤會以 `AiError` 拋出，`kind` 為 `'config' | 'http' | 'timeout' | 'abort' |
'parse'`，HTTP 錯誤另附選填的 `status`/`retryAfterMs`。

### `apiKeyAuth` / `noAuth`

`AuthStrategy` 把「憑證怎麼附加」從 client 邏輯中解耦，讓同一份 client 程式碼
同時涵蓋 BYOK、無 key 的本機端點，以及同源 proxy。

```typescript
import { createAiClient, apiKeyAuth, noAuth } from '@rfjs/ai-assist';

// 直連 BYOK，明確帶入認證策略
const direct = createAiClient({
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  auth: apiKeyAuth('sk-...'),
});

// 瀏覽器端 client 打自己的同源 proxy 路由（不外露 key）
const viaProxy = createAiClient({
  baseUrl: '/api/ai',
  model: 'gpt-4o-mini', // 會被 proxy 忽略——由伺服端的 model 生效
  auth: noAuth(),
});
```

`OAuthStrategyConfig` 型別已為未來的 `oauthAuth` 策略預留形狀；本版本尚未
實作。

### 注入 `createBrowserStorage()`

設定、互動紀錄、以及瀏覽器儲存預設 adapter 都透過小巧的 `AiStorage` 介面
（`get`/`set`/`remove`/選填 `subscribe`）運作，讓核心保持 isomorphic —— 在
伺服端可換上任意 adapter。

```typescript
import {
  createBrowserStorage,
  loadAiSettings,
  saveAiSettings,
  subscribeAiSettings,
  createAiLog,
} from '@rfjs/ai-assist';

const storage = createBrowserStorage(); // localStorage + 同分頁/跨分頁事件

saveAiSettings({ baseUrl: '...', apiKey: '...', model: '...' }, storage);
const settings = loadAiSettings(storage);

const unsubscribe = subscribeAiSettings(() => {
  console.log('設定已變更（同分頁或其他分頁）');
}, storage);

const log = createAiLog('rfjs.ai.log.myTool', storage);
log.append({
  id: crypto.randomUUID(),
  kind: 'generate',
  prompt: '...',
  at: new Date().toISOString(),
});
```

任何實作 `AiStorage` 的物件都能取代 `createBrowserStorage()` —— 例如測試用的
記憶體 map，或伺服端的 cookie/KV adapter。

### 在 Next.js route handler 掛上 `createAiProxyHandler`

`createAiProxyHandler` 建立一個 framework-agnostic 的 `(req: Request) =>
Promise<Response>` handler：讀取伺服端設定（env/secret）、以伺服端的 key
將客戶端請求體轉發至上游 gateway、覆寫 `model` 為伺服端設定的模型，並將回應
原樣透傳——包含 SSE 串流 body。

```typescript
// app/api/ai/chat/completions/route.ts
import { createAiProxyHandler } from '@rfjs/ai-assist';

const handler = createAiProxyHandler({
  getServerSettings: async () => {
    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!baseUrl || !apiKey || !model) return null; // 未設定時回 501
    return { baseUrl, apiKey, model };
  },
});

export const POST = handler;
```

瀏覽器端的 client 接著以 `baseUrl: '/api/ai'` 搭配 `noAuth()`（見上）—— client
會自動補上 `/chat/completions`，對應到上方的路由 —— API key 完全不會出現在
客戶端。

## 安全模型

- **BYOK 直連** —— 瀏覽器把 `AiSettings`（含 API key）存在 `AiStorage`，用
  `apiKeyAuth` 直接呼叫 AI 端點。簡單，但 key 會出現在客戶端儲存與網路請求中。
- **伺服端 proxy** —— 瀏覽器完全看不到 key。它以 `noAuth()` 打同源
  `/api/ai`；`createAiProxyHandler` 在伺服端讀取真正的憑證
  （`getServerSettings`）並轉發至上游 gateway，同時覆寫 `model`，讓「用哪個
  模型」由伺服端而非客戶端決定。

給使用者自帶 key 的本機/開發工具選 BYOK；面向終端使用者上線的產品選 proxy。

## API 一覽

| Export                                                                                   | 種類     | 說明                                                                  |
| ---------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| `AiSettings`                                                                             | type     | BYOK 連線形狀：`baseUrl` + `apiKey` + `model`                         |
| `AiError`                                                                                | class    | 型別化錯誤（`kind`、`detail?`、`status?`、`retryAfterMs?`）           |
| `AiErrorKind`                                                                            | type     | `'config' \| 'http' \| 'timeout' \| 'abort' \| 'parse'`               |
| `CompleteRequest`                                                                        | type     | `system` + `user` + 選填 `json`/`signal`/`timeoutMs`                  |
| `StreamDelta`                                                                            | type     | `{ content?, reasoning? }` 串流增量                                   |
| `AiClient`                                                                               | type     | `{ complete(req), stream(req, onDelta) }`                             |
| `createAiClient(settings \| config)`                                                     | function | 由 `AiSettings` 或 `AiClientConfig` 建立 `AiClient`                   |
| `AiClientConfig`                                                                         | type     | `baseUrl` + `model` + `auth: AuthStrategy` + 選填 `retry`             |
| `RetryPolicy`                                                                            | type     | opt-in 傳輸重試（`maxRetries`、`baseDelayMs?`、`respectRetryAfter?`） |
| `listAiModels(settings)`                                                                 | function | `GET {baseUrl}/models`，回傳排序後的模型 id                           |
| `AuthStrategy`                                                                           | type     | `{ kind, authHeaders() }`                                             |
| `apiKeyAuth(apiKey)`                                                                     | function | `Authorization: Bearer <key>` 策略                                    |
| `noAuth()`                                                                               | function | 不附任何認證 header（proxy / 無 key 端點）                            |
| `OAuthStrategyConfig`                                                                    | type     | 為未來 OAuth 策略預留的形狀                                           |
| `AiStorage`                                                                              | type     | 可注入的 `get`/`set`/`remove`/選填 `subscribe`                        |
| `createBrowserStorage()`                                                                 | function | `localStorage` 版 `AiStorage`，SSR 安全                               |
| `loadAiSettings(storage?)` / `saveAiSettings(s, storage?)` / `clearAiSettings(storage?)` | function | 持久化 `AiSettings`                                                   |
| `isConfigured(s)`                                                                        | function | 三個設定欄位皆非空才回 true                                           |
| `subscribeAiSettings(cb, storage?)`                                                      | function | 同分頁 + 跨分頁的設定變更訂閱                                         |
| `AI_SETTINGS_KEY`                                                                        | const    | 設定的預設儲存 key                                                    |
| `createAiProxyHandler(opts)`                                                             | function | `(req: Request) => Promise<Response>` 透明伺服端 proxy                |
| `AiProxyOptions`                                                                         | type     | `{ getServerSettings(req) }`                                          |
| `AiAssistEntry` / `AiLogStore`                                                           | type     | 互動紀錄項目 / store 形狀                                             |
| `createAiLog(storageKey, storage?)`                                                      | function | 列出/新增/清空一份有上限的互動紀錄                                    |
| `AI_LOG_LIMIT`                                                                           | const    | 每份紀錄保留的最大筆數（`50`）                                        |
