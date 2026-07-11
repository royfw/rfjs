# @rfjs/ai-assist

> 繁體中文 → [README.zh-TW.md](./README.zh-TW.md)

BYOK (bring-your-own-key) edit-time AI capability layer for OpenAI-compatible
endpoints — settings, a `complete`/SSE `stream` client, pluggable auth
strategies, an injectable storage adapter, an interaction log, and a
framework-agnostic server proxy handler. Isomorphic, framework-free.

## Installation

```bash
pnpm add @rfjs/ai-assist
```

## Usage

### `createAiClient(settings).complete` / `.stream`

Create a client from `AiSettings` (BYOK form: `baseUrl` + `apiKey` + `model`)
and call an OpenAI-compatible `/chat/completions` endpoint.

```typescript
import { createAiClient, type AiSettings } from '@rfjs/ai-assist';

const settings: AiSettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-...',
  model: 'gpt-4o-mini',
};

const client = createAiClient(settings);

// single-shot completion
const answer = await client.complete({
  system: 'You are a JSON generator.',
  user: 'Produce a table config for a users list.',
  json: true, // sets response_format: { type: 'json_object' }
});

// SSE streaming (display-only text — generation flows still use complete)
const full = await client.stream(
  { system: 'You are a helpful assistant.', user: 'Explain this filter.' },
  (delta) => {
    if (delta.content) process.stdout.write(delta.content);
    if (delta.reasoning) process.stdout.write(`[reasoning] ${delta.reasoning}`);
  },
);
```

`createAiClient` also accepts a lower-level `AiClientConfig` (`baseUrl` +
`model` + `auth: AuthStrategy` + optional `retry: RetryPolicy`) for non-BYOK
callers such as a proxy-backed client — see the auth section below. Retries
are opt-in (`maxRetries` defaults to `0`, i.e. no behavior change) and only
retry `429`/`5xx`/timeout responses, honoring `Retry-After` when present.

Errors are thrown as `AiError` with a `kind` of `'config' | 'http' | 'timeout'
| 'abort' | 'parse'`, plus optional `status`/`retryAfterMs` for HTTP errors.

### `apiKeyAuth` / `noAuth`

`AuthStrategy` decouples the client from how credentials are attached, so the
same client code works for BYOK, keyless local endpoints, and a same-origin
proxy.

```typescript
import { createAiClient, apiKeyAuth, noAuth } from '@rfjs/ai-assist';

// direct BYOK call with an explicit auth strategy
const direct = createAiClient({
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  auth: apiKeyAuth('sk-...'),
});

// browser client talking to your own same-origin proxy route (no key exposed)
const viaProxy = createAiClient({
  baseUrl: '/api/ai',
  model: 'gpt-4o-mini', // ignored by the proxy — the server's model wins
  auth: noAuth(),
});
```

An `OAuthStrategyConfig` shape is reserved for a future `oauthAuth` strategy;
it is not implemented in this release.

### `createBrowserStorage()` injection

Settings, the interaction log, and the browser storage default all go through
the small `AiStorage` interface (`get`/`set`/`remove`/optional `subscribe`),
so the core stays isomorphic — swap in any adapter on the server.

```typescript
import {
  createBrowserStorage,
  loadAiSettings,
  saveAiSettings,
  subscribeAiSettings,
  createAiLog,
} from '@rfjs/ai-assist';

const storage = createBrowserStorage(); // localStorage + same-tab/cross-tab events

saveAiSettings({ baseUrl: '...', apiKey: '...', model: '...' }, storage);
const settings = loadAiSettings(storage);

const unsubscribe = subscribeAiSettings(() => {
  console.log('settings changed (same tab or another tab)');
}, storage);

const log = createAiLog('rfjs.ai.log.myTool', storage);
log.append({
  id: crypto.randomUUID(),
  kind: 'generate',
  prompt: '...',
  at: new Date().toISOString(),
});
```

Any object implementing `AiStorage` works in place of `createBrowserStorage()`
— for example an in-memory map in tests, or a cookie/KV-backed adapter on the
server.

### `createAiProxyHandler` on a Next.js route handler

`createAiProxyHandler` builds a framework-agnostic `(req: Request) =>
Promise<Response>` handler that reads server-side settings (env/secret),
forwards the client's request body to the upstream gateway with the
server's key, overrides `model` with the server's configured model, and
passes the response straight through — including SSE streaming bodies.

```typescript
// app/api/ai/route.ts
import { createAiProxyHandler } from '@rfjs/ai-assist';

const handler = createAiProxyHandler({
  getServerSettings: async () => {
    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!baseUrl || !apiKey || !model) return null; // 501 when unconfigured
    return { baseUrl, apiKey, model };
  },
});

export const POST = handler;
```

The browser-side client then talks to `/api/ai` with `noAuth()` (see above) —
no API key ever reaches the client.

## Security model

- **BYOK direct** — the browser holds `AiSettings` (including the API key) in
  `AiStorage` and calls the AI endpoint directly with `apiKeyAuth`. Simple,
  but the key is present in client-side storage and network requests.
- **Server proxy** — the browser never sees a key. It calls same-origin
  `/api/ai` with `noAuth()`; `createAiProxyHandler` reads the real credentials
  server-side (`getServerSettings`) and forwards to the upstream gateway,
  overriding `model` so the server — not the client — decides which model is
  used.

Pick BYOK for local/dev tools where the user supplies their own key; pick the
proxy for anything shipped to end users.

## API summary

| Export                                                                                   | Kind     | Description                                                                 |
| ---------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `AiSettings`                                                                             | type     | BYOK connection shape: `baseUrl` + `apiKey` + `model`                       |
| `AiError`                                                                                | class    | Typed error (`kind`, `detail?`, `status?`, `retryAfterMs?`)                 |
| `AiErrorKind`                                                                            | type     | `'config' \| 'http' \| 'timeout' \| 'abort' \| 'parse'`                     |
| `CompleteRequest`                                                                        | type     | `system` + `user` + optional `json`/`signal`/`timeoutMs`                    |
| `StreamDelta`                                                                            | type     | `{ content?, reasoning? }` streaming increment                              |
| `AiClient`                                                                               | type     | `{ complete(req), stream(req, onDelta) }`                                   |
| `createAiClient(settings \| config)`                                                     | function | Build an `AiClient` from `AiSettings` or `AiClientConfig`                   |
| `AiClientConfig`                                                                         | type     | `baseUrl` + `model` + `auth: AuthStrategy` + optional `retry`               |
| `RetryPolicy`                                                                            | type     | Opt-in transport retry (`maxRetries`, `baseDelayMs?`, `respectRetryAfter?`) |
| `listAiModels(settings)`                                                                 | function | `GET {baseUrl}/models`, returns sorted model ids                            |
| `AuthStrategy`                                                                           | type     | `{ kind, authHeaders() }`                                                   |
| `apiKeyAuth(apiKey)`                                                                     | function | `Authorization: Bearer <key>` strategy                                      |
| `noAuth()`                                                                               | function | No auth headers (proxy / keyless endpoints)                                 |
| `OAuthStrategyConfig`                                                                    | type     | Reserved shape for a future OAuth strategy                                  |
| `AiStorage`                                                                              | type     | Injectable `get`/`set`/`remove`/optional `subscribe`                        |
| `createBrowserStorage()`                                                                 | function | `localStorage`-backed `AiStorage`, SSR-safe                                 |
| `loadAiSettings(storage?)` / `saveAiSettings(s, storage?)` / `clearAiSettings(storage?)` | function | Persist `AiSettings`                                                        |
| `isConfigured(s)`                                                                        | function | True when all three settings fields are non-empty                           |
| `subscribeAiSettings(cb, storage?)`                                                      | function | Same-tab + cross-tab settings change subscription                           |
| `AI_SETTINGS_KEY`                                                                        | const    | Default storage key for settings                                            |
| `createAiProxyHandler(opts)`                                                             | function | `(req: Request) => Promise<Response>` transparent server proxy              |
| `AiProxyOptions`                                                                         | type     | `{ getServerSettings(req) }`                                                |
| `AiAssistEntry` / `AiLogStore`                                                           | type     | Interaction log entry / store shape                                         |
| `createAiLog(storageKey, storage?)`                                                      | function | List/append/clear a capped interaction log                                  |
| `AI_LOG_LIMIT`                                                                           | const    | Max entries kept per log (`50`)                                             |
