# @rfjs/ai-assist 抽離 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 apps/web 的 AI-assist seam 抽成可發布的 `@rfjs/ai-assist`（純核心）+ 私有 `@rfjs/ai-assist-ui`（React），並補齊 auth / storage / proxy 縫線與 opt-in retry；apps/web 既有 BYOK 行為逐位元不變。

**Architecture:** 兩套件比照 `filter-builder`(pure, 發布) / `filter-builder-ui`(react, private, transpilePackages)。核心 isomorphic：`types`/`auth`/`storage`/`settings`/`client`/`proxy`/`log`；React 層：`use-ai-assist` hook + `AiPanel`(labels-as-props)。既有測試為 BYOK 回歸網；新能力自帶 TDD。

**Tech Stack:** TypeScript 5.7+、tsdown（核心 build）、vitest（jsdom）、React 19、pnpm workspace、Next.js transpilePackages。

## Global Constraints

- 語言：spec/plan 繁中；commit/PR 英文 conventional（subject 全小寫；trailer 前空行；**末行恰為** `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`）。
- 鐵律：AI 輸出永不直接落地（經既有 parser/zod 閘門）；`@rfjs/*` 引擎套件維持 AI-free、零改動。
- BYOK 行為**逐位元不變**：`createAiClient(settings: AiSettings)` 對外簽名不變；`complete`/`stream` 一律送 `Authorization: Bearer <apiKey>`（空 key 亦送 `Bearer `）；`listAiModels` 空 key 省略 Bearer——**皆不改**。
- retry 預設 `maxRetries: 0`（＝今天行為）。OAuth 僅介面、parse self-repair 僅設計、公開站不啟用 proxy、不動 `@rfjs/retry`。
- build config：inline `tsdown defineConfig` + inline vitest（同 sibling，不用 tpl-toolkit factory）。核心 `platform: 'neutral'`。
- 每個 `packages/*` 附 changeset（`@rfjs/ai-assist` publishable=minor；`@rfjs/ai-assist-ui` private=version-only 亦可）；README 雙語。
- commit 用 `--no-verify` 僅限「worktree 尚無 node_modules」的前置；**Task 1 `pnpm install` 之後一律走正常 hook**。
- 全程於 worktree `feat-ai-assist-extract`（base=`origin/main`）；**HOLD PR**。
- 參考 spec：`docs/superpowers/specs/2026-07-10-ai-assist-extract-design.md`。

---

## Phase 0 — 核心套件 scaffold

### Task 1: Scaffold `@rfjs/ai-assist` + worktree 安裝

**Files:**
- Create: `packages/ai-assist/package.json`
- Create: `packages/ai-assist/tsconfig.json`
- Create: `packages/ai-assist/tsconfig.build.json`
- Create: `packages/ai-assist/tsdown.config.ts`
- Create: `packages/ai-assist/vitest.config.mts`
- Create: `packages/ai-assist/src/index.ts`（暫時空 barrel）

**Interfaces:**
- Produces: 一個可 build / 可 vitest 的空套件 `@rfjs/ai-assist`（後續 Task 填 src）。

- [ ] **Step 1: 寫 `packages/ai-assist/package.json`**

```json
{
  "name": "@rfjs/ai-assist",
  "version": "0.0.0",
  "description": "BYOK edit-time AI capability layer (OpenAI-compatible): settings, client (complete + SSE stream), auth strategies, storage adapter, server proxy handler, interaction log — isomorphic, framework-free",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "sideEffects": false,
  "private": false,
  "publishConfig": { "access": "public" },
  "scripts": {
    "clean": "pnpm exec npm-run-all --parallel clean:dist clean:types",
    "clean:types": "pnpm exec rimraf ./types",
    "clean:dist": "pnpm exec rimraf ./dist",
    "build": "pnpm run build:tsdown",
    "build:tsdown": "pnpm run clean && tsdown --config-loader unrun",
    "typecheck": "tsc --noEmit",
    "check-types": "tsc --noEmit",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
    "lint:fix": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "pnpm run vitest:run",
    "vitest:run": "vitest --passWithNoTests --run"
  },
  "keywords": ["ai", "byok", "openai-compatible", "llm", "sse", "streaming", "litellm", "ollama"],
  "author": "Roy Chuang",
  "license": "ISC",
  "repository": { "type": "git", "url": "git+https://github.com/royfw/rfjs.git", "directory": "packages/ai-assist" },
  "bugs": "https://github.com/royfw/rfjs/issues",
  "homepage": "https://github.com/royfw/rfjs/tree/main/packages/ai-assist#readme",
  "files": ["dist", "README.md", "README.zh-TW.md"],
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "jsdom": "^29.1.1",
    "npm-run-all": "^4.1.5",
    "prettier": "^3.5.1",
    "rimraf": "^6.0.1",
    "tsdown": "0.17.0-beta.6",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.24.0",
    "vitest": "^3.2.3"
  }
}
```

- [ ] **Step 2: 寫 `packages/ai-assist/tsconfig.json`**（複製自 `packages/filter-builder/tsconfig.json`，逐字相同）

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "rootDir": "./src",
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "importHelpers": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "declarationDir": "types",
    "emitDeclarationOnly": false,
    "outDir": "dist",
    "sourceMap": true,
    "paths": { "@/*": ["./src/*"] },
    "resolveJsonModule": true,
    "removeComments": true,
    "newLine": "lf",
    "noUnusedLocals": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"]
  },
  "exclude": ["node_modules", "dist*", "test", "types", "**/*.spec.ts", "**/*.test.ts", "**/*.e2e.spec.ts", "**/*.e2e.test.ts", "*.config.*"]
}
```

> 註：相對 filter-builder 多加 `DOM`/`DOM.Iterable` 到 `lib`——因為 `storage.ts`/`settings.ts` 用到 `window`/`localStorage`/`StorageEvent`（isomorphic 但型別需要 DOM lib）。

- [ ] **Step 3: 寫 `packages/ai-assist/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "*.config.*"]
}
```

- [ ] **Step 4: 寫 `packages/ai-assist/tsdown.config.ts`**（同 filter-builder，`platform: 'neutral'`）

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  tsconfig: 'tsconfig.build.json',
  target: 'es2023',
  platform: 'neutral',
  treeshake: true,
  sourcemap: true,
  clean: true,
  dts: true,
});
```

- [ ] **Step 5: 寫 `packages/ai-assist/vitest.config.mts`**（jsdom：settings/log/storage 需 localStorage+window）

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    globals: true,
    reporters: ['verbose'],
  },
});
```

- [ ] **Step 6: 寫暫時 `packages/ai-assist/src/index.ts`**

```ts
export {};
```

- [ ] **Step 7: 安裝（worktree 尚無 node_modules）**

Run: `pnpm install`
Expected: 完成、無錯；`@rfjs/ai-assist` 被納入 workspace；`turbo` 可用。

- [ ] **Step 8: 驗證 tooling**

Run: `pnpm --filter @rfjs/ai-assist vitest:run`
Expected: PASS（`--passWithNoTests`，0 tests）。

Run: `pnpm --filter @rfjs/ai-assist build`
Expected: 產出 `dist/index.js|mjs|d.ts`，無錯。

- [ ] **Step 9: Commit**

```bash
git add packages/ai-assist pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(ai-assist): scaffold @rfjs/ai-assist package

empty isomorphic core package with tsdown build (platform neutral) and
jsdom vitest, mirroring the filter-builder publishable-package layout.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — 核心：搬檔 + 加縫線（TDD）

### Task 2: `types.ts`（搬 + AiError 加選填 status/retryAfterMs）

**Files:**
- Create: `packages/ai-assist/src/types.ts`

**Interfaces:**
- Produces: `AiSettings`、`AiErrorKind`、`AiError`（新增選填 `status?: number`、`retryAfterMs?: number`）、`CompleteRequest`、`StreamDelta`、`AiClient`。

- [ ] **Step 1: 寫 `packages/ai-assist/src/types.ts`**

```ts
/** BYOK 連線設定 —— 只存 storage（預設 browser localStorage）。 */
export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type AiErrorKind = 'config' | 'http' | 'timeout' | 'abort' | 'parse';

export class AiError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    message: string,
    public readonly detail?: string,
    /** http 錯誤時的狀態碼——供 retry 分類（429/5xx 可重試）。 */
    public readonly status?: number,
    /** 由 Retry-After header 解析而來（毫秒）——供退避使用。 */
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export interface CompleteRequest {
  system: string;
  user: string;
  /** true → 要求 JSON 回應（response_format: json_object）。 */
  json?: boolean;
  signal?: AbortSignal;
  /** 預設 60_000ms。 */
  timeoutMs?: number;
}

/** 串流增量：content=回覆 token；reasoning=推理 token（r1 類模型經 litellm 透傳 reasoning_content）。 */
export interface StreamDelta {
  content?: string;
  reasoning?: string;
}

/** 單發完成 + 串流。串流僅用於 display-only 純文字（問答/解釋）；產生類仍走 complete（需完整 JSON 過閘門）。 */
export interface AiClient {
  complete(req: CompleteRequest): Promise<string>;
  /** SSE 串流；每個增量呼叫 onDelta，回傳累積的完整 content（與 complete 等價）。 */
  stream(req: CompleteRequest, onDelta: (d: StreamDelta) => void): Promise<string>;
}
```

- [ ] **Step 2: 暫時把 types 併入 barrel 以便 typecheck**

編輯 `packages/ai-assist/src/index.ts`：

```ts
export * from './types';
```

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @rfjs/ai-assist check-types`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add packages/ai-assist/src/types.ts packages/ai-assist/src/index.ts
git commit -m "$(cat <<'EOF'
feat(ai-assist): add core types with retry-aware AiError

move the ai types into the package and extend AiError with optional status
and retryAfterMs so the client can classify retryable http failures.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

### Task 3: `storage.ts`（AiStorage + createBrowserStorage）— TDD

**Files:**
- Create: `packages/ai-assist/src/storage.ts`
- Test: `packages/ai-assist/src/storage.spec.ts`

**Interfaces:**
- Produces: `AiStorage`（`get`/`set`/`remove`/選填 `subscribe`）、`createBrowserStorage(): AiStorage`。
- Consumes（後續 Task）：`settings.ts`/`log.ts` 以 `AiStorage` 為預設 `createBrowserStorage()`。

- [ ] **Step 1: 寫失敗測試 `packages/ai-assist/src/storage.spec.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBrowserStorage } from './storage';

describe('createBrowserStorage', () => {
  beforeEach(() => localStorage.clear());

  it('get/set/remove round-trips through localStorage', () => {
    const s = createBrowserStorage();
    expect(s.get('k')).toBeNull();
    s.set('k', 'v');
    expect(s.get('k')).toBe('v');
    expect(localStorage.getItem('k')).toBe('v');
    s.remove('k');
    expect(s.get('k')).toBeNull();
  });

  it('subscribe fires on same-tab set/remove and stops after unsubscribe', () => {
    const s = createBrowserStorage();
    const cb = vi.fn();
    const unsub = s.subscribe!(cb);
    s.set('k', 'v');
    expect(cb).toHaveBeenCalledTimes(1);
    s.remove('k');
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    s.set('k', 'v2');
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `pnpm --filter @rfjs/ai-assist vitest:run storage`
Expected: FAIL（`createBrowserStorage` 尚未定義）。

- [ ] **Step 3: 寫 `packages/ai-assist/src/storage.ts`**

```ts
/** 可注入的 key-value 儲存縫線 —— 讓 settings/log 脫離 window，核心得以 isomorphic。 */
export interface AiStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** 設定響應式訂閱用（同分頁 + 跨分頁）；回傳取消訂閱。非瀏覽器可省略。 */
  subscribe?(callback: () => void): () => void;
}

/** 同分頁存/清時派送（storage 事件只跨分頁，同分頁不觸發）。 */
const AI_STORAGE_EVENT = 'rfjs:ai-storage';

/** 預設 adapter：localStorage + 同分頁自訂事件 + 跨分頁 storage 事件。SSR 安全（window 守衛）。 */
export function createBrowserStorage(): AiStorage {
  const notify = () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(AI_STORAGE_EVENT));
  };
  return {
    get: (key) => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
    set: (key, value) => {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
      notify();
    },
    remove: (key) => {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
      notify();
    },
    subscribe: (callback) => {
      if (typeof window === 'undefined') return () => {};
      const onStorage = () => callback();
      window.addEventListener(AI_STORAGE_EVENT, callback);
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(AI_STORAGE_EVENT, callback);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `pnpm --filter @rfjs/ai-assist vitest:run storage`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/ai-assist/src/storage.ts packages/ai-assist/src/storage.spec.ts
git commit -m "$(cat <<'EOF'
feat(ai-assist): add injectable AiStorage with browser default

introduce the storage seam so settings and log stop hardwiring window; the
browser adapter wraps localStorage plus the same-tab custom event and
cross-tab storage event, guarded for ssr.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `settings.ts`（搬 + 收 storage 參數）

**Files:**
- Create: `packages/ai-assist/src/settings.ts`
- Test: `packages/ai-assist/src/settings.spec.ts`（搬既有 + 加注入測試）

**Interfaces:**
- Consumes: `AiStorage`/`createBrowserStorage`（Task 3）、`AiSettings`（Task 2）。
- Produces: `AI_SETTINGS_KEY`、`loadAiSettings(storage?)`、`saveAiSettings(s, storage?)`、`clearAiSettings(storage?)`、`isConfigured(s)`、`subscribeAiSettings(callback, storage?)`。

- [ ] **Step 1: 寫 `packages/ai-assist/src/settings.ts`**

```ts
import type { AiSettings } from './types';
import { type AiStorage, createBrowserStorage } from './storage';

export const AI_SETTINGS_KEY = 'rfjs.ai.settings';

export function loadAiSettings(storage: AiStorage = createBrowserStorage()): AiSettings | null {
  const raw = storage.get(AI_SETTINGS_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<AiSettings>;
    if (typeof v.baseUrl === 'string' && typeof v.apiKey === 'string' && typeof v.model === 'string') {
      return { baseUrl: v.baseUrl, apiKey: v.apiKey, model: v.model };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAiSettings(s: AiSettings, storage: AiStorage = createBrowserStorage()): void {
  storage.set(AI_SETTINGS_KEY, JSON.stringify(s));
}

export function clearAiSettings(storage: AiStorage = createBrowserStorage()): void {
  storage.remove(AI_SETTINGS_KEY);
}

export function isConfigured(s: AiSettings | null): s is AiSettings {
  return !!s && s.baseUrl.trim() !== '' && s.apiKey.trim() !== '' && s.model.trim() !== '';
}

/** 訂閱設定變更：同分頁自訂事件 + 跨分頁 storage 事件（委派給 storage.subscribe）。回傳取消訂閱。 */
export function subscribeAiSettings(
  callback: () => void,
  storage: AiStorage = createBrowserStorage(),
): () => void {
  return storage.subscribe?.(callback) ?? (() => {});
}
```

- [ ] **Step 2: 寫 `packages/ai-assist/src/settings.spec.ts`**（前半＝搬既有逐字；末段＝新注入測試）

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_SETTINGS_KEY,
  clearAiSettings,
  isConfigured,
  loadAiSettings,
  saveAiSettings,
  subscribeAiSettings,
} from './settings';
import type { AiStorage } from './storage';

describe('ai settings storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips settings through localStorage', () => {
    expect(loadAiSettings()).toBeNull();
    saveAiSettings({ baseUrl: 'http://localhost:4000/v1', apiKey: 'sk-x', model: 'gpt-test' });
    expect(loadAiSettings()).toEqual({ baseUrl: 'http://localhost:4000/v1', apiKey: 'sk-x', model: 'gpt-test' });
    expect(localStorage.getItem(AI_SETTINGS_KEY)).toBeTruthy();
    clearAiSettings();
    expect(loadAiSettings()).toBeNull();
  });

  it('isConfigured requires all three fields non-empty', () => {
    expect(isConfigured(null)).toBe(false);
    expect(isConfigured({ baseUrl: '', apiKey: 'k', model: 'm' })).toBe(false);
    expect(isConfigured({ baseUrl: 'u', apiKey: 'k', model: 'm' })).toBe(true);
  });

  it('tolerates corrupted stored json', () => {
    localStorage.setItem(AI_SETTINGS_KEY, 'not json');
    expect(loadAiSettings()).toBeNull();
  });

  it('notifies same-tab subscribers on save and clear', () => {
    const cb = vi.fn();
    const unsub = subscribeAiSettings(cb);
    saveAiSettings({ baseUrl: 'u', apiKey: 'k', model: 'm' });
    expect(cb).toHaveBeenCalledTimes(1);
    clearAiSettings();
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    saveAiSettings({ baseUrl: 'u', apiKey: 'k', model: 'm' });
    expect(cb).toHaveBeenCalledTimes(2); // 取消訂閱後不再收到
  });

  it('uses an injected storage adapter (no window/localStorage touch)', () => {
    const map = new Map<string, string>();
    const fake: AiStorage = {
      get: (k) => map.get(k) ?? null,
      set: (k, v) => void map.set(k, v),
      remove: (k) => void map.delete(k),
    };
    saveAiSettings({ baseUrl: 'u', apiKey: 'k', model: 'm' }, fake);
    expect(map.get(AI_SETTINGS_KEY)).toBeTruthy();
    expect(loadAiSettings(fake)).toEqual({ baseUrl: 'u', apiKey: 'k', model: 'm' });
    expect(localStorage.getItem(AI_SETTINGS_KEY)).toBeNull(); // 沒碰 localStorage
    // 無 subscribe 的 adapter → 取得 no-op unsub，不拋錯
    expect(typeof subscribeAiSettings(() => {}, fake)).toBe('function');
  });
});
```

- [ ] **Step 3: 跑測試**

Run: `pnpm --filter @rfjs/ai-assist vitest:run settings`
Expected: PASS（含既有 4 案 + 新注入案）。

- [ ] **Step 4: Commit**

```bash
git add packages/ai-assist/src/settings.ts packages/ai-assist/src/settings.spec.ts
git commit -m "$(cat <<'EOF'
feat(ai-assist): move settings onto the storage adapter

settings load/save/clear/subscribe now take an AiStorage defaulting to the
browser adapter, so the app call sites are unchanged while the core stays
isomorphic and unit-testable with an injected map.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `log.ts`（搬 + 收 storage 參數）

**Files:**
- Create: `packages/ai-assist/src/log.ts`
- Test: `packages/ai-assist/src/log.spec.ts`（搬既有 + 加注入測試）

**Interfaces:**
- Consumes: `AiStorage`/`createBrowserStorage`（Task 3）。
- Produces: `AiAssistEntry`、`AI_LOG_LIMIT`、`AiLogStore`、`createAiLog(storageKey, storage?)`。

- [ ] **Step 1: 寫 `packages/ai-assist/src/log.ts`**

```ts
import { type AiStorage, createBrowserStorage } from './storage';

/** AI 互動紀錄的持久化接口 —— 重新套用 / 聊天歷史共用；後端可換。 */
export interface AiAssistEntry {
  id: string;
  kind: 'generate' | 'ask' | 'explain' | 'check';
  prompt?: string;
  answer?: string;
  appliedJson?: string;
  at: string;
}

export const AI_LOG_LIMIT = 50;

export interface AiLogStore {
  list(): AiAssistEntry[];
  append(entry: AiAssistEntry): AiAssistEntry[];
  clear(): void;
}

const KINDS = new Set(['generate', 'ask', 'explain', 'check']);

function isEntry(v: unknown): v is AiAssistEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Partial<AiAssistEntry>;
  return typeof e.id === 'string' && typeof e.kind === 'string' && KINDS.has(e.kind) && typeof e.at === 'string';
}

/** 只保留 string 的選填欄位——防止被竄改的紀錄（如 appliedJson 為數字）流入重新套用 / 畫面。 */
function normalize(e: AiAssistEntry): AiAssistEntry {
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return { id: e.id, kind: e.kind, at: e.at, prompt: str(e.prompt), answer: str(e.answer), appliedJson: str(e.appliedJson) };
}

export function createAiLog(storageKey: string, storage: AiStorage = createBrowserStorage()): AiLogStore {
  const list = (): AiAssistEntry[] => {
    const raw = storage.get(storageKey);
    if (!raw) return [];
    try {
      const v: unknown = JSON.parse(raw);
      return Array.isArray(v) ? v.filter(isEntry).map(normalize) : [];
    } catch {
      return [];
    }
  };
  return {
    list,
    append(entry) {
      const next = [...list(), entry].slice(-AI_LOG_LIMIT);
      storage.set(storageKey, JSON.stringify(next));
      return next;
    },
    clear() {
      storage.remove(storageKey);
    },
  };
}
```

- [ ] **Step 2: 寫 `packages/ai-assist/src/log.spec.ts`**（搬既有逐字 + 末段注入測試）

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_LOG_LIMIT, createAiLog, type AiAssistEntry } from './log';
import type { AiStorage } from './storage';

const KEY = 'rfjs.ai.log.test-tool';

function entry(n: number): AiAssistEntry {
  return { id: `id-${n}`, kind: 'ask', prompt: `q${n}`, answer: `a${n}`, at: `2026-07-08T00:00:${String(n % 60).padStart(2, '0')}.000Z` };
}

beforeEach(() => localStorage.clear());

describe('createAiLog', () => {
  it('list/append/clear 往返（chronological，append 回傳新列表）', () => {
    const log = createAiLog(KEY);
    expect(log.list()).toEqual([]);
    const after1 = log.append(entry(1));
    expect(after1).toHaveLength(1);
    log.append(entry(2));
    expect(log.list().map((e) => e.id)).toEqual(['id-1', 'id-2']);
    log.clear();
    expect(log.list()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it(`超過 AI_LOG_LIMIT（${AI_LOG_LIMIT}）裁掉最舊`, () => {
    const log = createAiLog(KEY);
    for (let i = 0; i < AI_LOG_LIMIT + 3; i++) log.append(entry(i));
    const list = log.list();
    expect(list).toHaveLength(AI_LOG_LIMIT);
    expect(list[0]?.id).toBe('id-3'); // 0,1,2 被裁
  });

  it('損毀 JSON → 空陣列；非陣列 → 空陣列', () => {
    localStorage.setItem(KEY, '{not json');
    expect(createAiLog(KEY).list()).toEqual([]);
    localStorage.setItem(KEY, '{"a":1}');
    expect(createAiLog(KEY).list()).toEqual([]);
  });

  it('不同 key 互不干擾', () => {
    const a = createAiLog('rfjs.ai.log.a');
    const b = createAiLog('rfjs.ai.log.b');
    a.append(entry(1));
    expect(b.list()).toEqual([]);
  });

  it('過濾形狀不合法的項目（缺 id / kind 非法）；check 為合法 kind', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([entry(1), { kind: 'ask' }, { id: 'x', kind: 'nope' }, { id: 'c1', kind: 'check', answer: 'ok', at: '2026-07-08T00:00:00.000Z' }]),
    );
    expect(createAiLog(KEY).list().map((e) => e.id)).toEqual(['id-1', 'c1']);
  });

  it('被竄改的非 string 選填欄位在讀取時被剔除（不流入重新套用）', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([{ id: 'g1', kind: 'generate', prompt: 42, appliedJson: { evil: true }, at: '2026-07-08T00:00:00.000Z' }]),
    );
    const [e] = createAiLog(KEY).list();
    expect(e!.id).toBe('g1');
    expect(e!.prompt).toBeUndefined();
    expect(e!.appliedJson).toBeUndefined();
  });

  it('uses an injected storage adapter', () => {
    const map = new Map<string, string>();
    const fake: AiStorage = {
      get: (k) => map.get(k) ?? null,
      set: (k, v) => void map.set(k, v),
      remove: (k) => void map.delete(k),
    };
    const log = createAiLog(KEY, fake);
    log.append(entry(1));
    expect(log.list().map((e) => e.id)).toEqual(['id-1']);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
```

- [ ] **Step 3: 跑測試**

Run: `pnpm --filter @rfjs/ai-assist vitest:run log`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add packages/ai-assist/src/log.ts packages/ai-assist/src/log.spec.ts
git commit -m "$(cat <<'EOF'
feat(ai-assist): move interaction log onto the storage adapter

createAiLog takes an AiStorage defaulting to the browser adapter; behavior
and the 50-entry cap plus tamper coercion are unchanged.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `auth.ts`（AuthStrategy + apiKeyAuth / noAuth）— TDD

**Files:**
- Create: `packages/ai-assist/src/auth.ts`
- Test: `packages/ai-assist/src/auth.spec.ts`

**Interfaces:**
- Produces: `AuthStrategy`（`kind`、`authHeaders()`）、`apiKeyAuth(apiKey)`、`noAuth()`、`OAuthStrategyConfig`（型別，僅預留）。
- Consumes（後續）：`client.ts` 以 `AuthStrategy` 產出 Authorization header。

- [ ] **Step 1: 寫失敗測試 `packages/ai-assist/src/auth.spec.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { apiKeyAuth, noAuth } from './auth';

describe('AuthStrategy', () => {
  it('apiKeyAuth emits a Bearer header (even for empty key, preserving byok behavior)', async () => {
    expect(await apiKeyAuth('sk-t').authHeaders()).toEqual({ Authorization: 'Bearer sk-t' });
    expect(apiKeyAuth('sk-t').kind).toBe('apiKey');
    expect(await apiKeyAuth('').authHeaders()).toEqual({ Authorization: 'Bearer ' });
  });

  it('noAuth emits no headers', async () => {
    expect(await noAuth().authHeaders()).toEqual({});
    expect(noAuth().kind).toBe('none');
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `pnpm --filter @rfjs/ai-assist vitest:run auth`
Expected: FAIL（`apiKeyAuth`/`noAuth` 未定義）。

- [ ] **Step 3: 寫 `packages/ai-assist/src/auth.ts`**

```ts
/** 認證策略 —— 貢獻要附加到請求的 header。抽象讓 client 一次涵蓋 BYOK / 無 key / proxy / 未來 OAuth。 */
export interface AuthStrategy {
  readonly kind: 'apiKey' | 'oauth' | 'none';
  authHeaders(): Promise<Record<string, string>>;
}

/** BYOK：送 `Authorization: Bearer <key>`（空 key 仍送 `Bearer `，保留既有行為）。 */
export function apiKeyAuth(apiKey: string): AuthStrategy {
  return {
    kind: 'apiKey',
    authHeaders: async () => ({ Authorization: `Bearer ${apiKey}` }),
  };
}

/** 不附任何憑證 —— proxy 的瀏覽器端（靠同源 cookie）或 keyless 本機端點。 */
export function noAuth(): AuthStrategy {
  return {
    kind: 'none',
    authHeaders: async () => ({}),
  };
}

/** 未來 "Sign in with Claude/ChatGPT" OAuth 的設定形狀 —— 本 wave 僅預留型別，不實作 `oauthAuth`。 */
export interface OAuthStrategyConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  scopes?: string[];
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `pnpm --filter @rfjs/ai-assist vitest:run auth`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/ai-assist/src/auth.ts packages/ai-assist/src/auth.spec.ts
git commit -m "$(cat <<'EOF'
feat(ai-assist): add AuthStrategy with apiKey and noAuth

one auth abstraction the client uses to build request headers; apiKeyAuth
preserves the exact byok bearer behavior, noAuth covers proxy/keyless, and
OAuthStrategyConfig reserves the oauth shape without implementing it.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `client.ts`（搬 + auth/config overload + opt-in retry）

**Files:**
- Create: `packages/ai-assist/src/client.ts`
- Test: `packages/ai-assist/src/client.spec.ts`（搬既有逐字 + 加 config/auth/retry 測試）

**Interfaces:**
- Consumes: `AiError`/`AiClient`/`AiSettings`/`CompleteRequest`/`StreamDelta`（Task 2）、`apiKeyAuth`/`AuthStrategy`（Task 6）、`isConfigured`（Task 4）。
- Produces: `RetryPolicy`、`AiClientConfig`、`listAiModels(settings)`、`createAiClient(settings | config)`。

- [ ] **Step 1: 寫 `packages/ai-assist/src/client.ts`**（完整）

```ts
import { AiError, type AiClient, type AiSettings, type CompleteRequest, type StreamDelta } from './types';
import { apiKeyAuth, type AuthStrategy } from './auth';
import { isConfigured } from './settings';

const DEFAULT_TIMEOUT_MS = 60_000;
const MODELS_TIMEOUT_MS = 15_000;
const DEFAULT_BASE_DELAY_MS = 500;

/** opt-in 傳輸重試。預設 maxRetries:0 → 完全等於今天的行為。 */
export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs?: number;
  respectRetryAfter?: boolean;
}

/** 一般化的 client 設定：baseUrl + auth（取代寫死 apiKey），可選 retry。 */
export interface AiClientConfig {
  baseUrl: string;
  model: string;
  auth: AuthStrategy;
  retry?: RetryPolicy;
}

const stripTrailingSlash = (u: string) => u.replace(/\/+$/, '');

/** 列出端點可用模型（GET {baseUrl}/models，OpenAI-compatible）。
 * 只要求 baseUrl —— apiKey 可留空（如 Ollama），有值才帶 Bearer。 */
export async function listAiModels(
  settings: Pick<AiSettings, 'baseUrl' | 'apiKey'>,
): Promise<string[]> {
  if (settings.baseUrl.trim() === '') {
    throw new AiError('config', 'base URL is required');
  }
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, MODELS_TIMEOUT_MS);
  try {
    const res = await fetch(`${stripTrailingSlash(settings.baseUrl)}/models`, {
      headers: settings.apiKey.trim() ? { Authorization: `Bearer ${settings.apiKey}` } : {},
      signal: ctl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AiError('http', `models request returned ${res.status}`, text.slice(0, 500));
    }
    const data = (await res.json().catch(() => null)) as { data?: { id?: unknown }[] } | null;
    if (!data || !Array.isArray(data.data)) {
      throw new AiError('parse', 'unexpected models payload shape');
    }
    return data.data
      .map((m) => m?.id)
      .filter((id): id is string => typeof id === 'string')
      .sort();
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw timedOut
        ? new AiError('timeout', 'models request timed out')
        : new AiError('abort', 'models request cancelled');
    }
    throw new AiError('http', e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(e: AiError): boolean {
  if (e.kind === 'timeout') return true;
  if (e.kind === 'http' && typeof e.status === 'number') return e.status === 429 || e.status >= 500;
  return false;
}

function parseRetryAfterMs(res: Response): number | undefined {
  const h = res.headers.get('retry-after');
  if (!h) return undefined;
  const secs = Number(h);
  return Number.isFinite(secs) ? secs * 1000 : undefined;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createAiClient(settings: AiSettings): AiClient;
export function createAiClient(config: AiClientConfig): AiClient;
export function createAiClient(arg: AiSettings | AiClientConfig): AiClient {
  const fromSettings = !('auth' in arg);
  const config: AiClientConfig = fromSettings
    ? { baseUrl: (arg as AiSettings).baseUrl, model: (arg as AiSettings).model, auth: apiKeyAuth((arg as AiSettings).apiKey) }
    : (arg as AiClientConfig);
  const retry = config.retry;

  // BYOK(settings) 保留既有嚴格閘門（三欄皆需）；typed config 只要求 baseUrl（proxy 的 model 由 server 決定）。
  const guard = () => {
    if (fromSettings) {
      if (!isConfigured(arg as AiSettings)) throw new AiError('config', 'AI connection is not configured');
    } else if (config.baseUrl.trim() === '') {
      throw new AiError('config', 'AI connection is not configured');
    }
  };

  const doFetch = async (req: CompleteRequest, stream: boolean): Promise<Response> => {
    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctl.abort();
    }, req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const onExternalAbort = () => ctl.abort();
    req.signal?.addEventListener('abort', onExternalAbort, { once: true });
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(await config.auth.authHeaders()) };
      const res = await fetch(`${stripTrailingSlash(config.baseUrl)}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          ...(stream ? { stream: true } : {}),
          ...(req.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: ctl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new AiError('http', `AI endpoint returned ${res.status}`, text.slice(0, 500), res.status, parseRetryAfterMs(res));
      }
      return res;
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (e instanceof Error && e.name === 'AbortError') {
        throw timedOut
          ? new AiError('timeout', 'AI request timed out')
          : new AiError('abort', 'AI request cancelled');
      }
      throw new AiError('http', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener('abort', onExternalAbort);
    }
  };

  // 預設 maxRetries:0 → 只跑一次、first error 即拋 → 與今天行為等價。
  const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    const max = retry?.maxRetries ?? 0;
    const base = retry?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (!(e instanceof AiError) || attempt >= max || !isRetryable(e)) throw e;
        const ra = retry?.respectRetryAfter === false ? undefined : e.retryAfterMs;
        await sleep(ra ?? base * 2 ** attempt);
      }
    }
  };

  return {
    async complete(req: CompleteRequest): Promise<string> {
      guard();
      return withRetry(async () => {
        const res = await doFetch(req, false);
        const data = (await res.json().catch(() => null)) as
          | { choices?: { message?: { content?: unknown } }[] }
          | null;
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new AiError('parse', 'unexpected completion payload shape');
        return content;
      });
    },

    async stream(req: CompleteRequest, onDelta: (d: StreamDelta) => void): Promise<string> {
      guard();
      return withRetry(async () => {
        const res = await doFetch(req, true);
        if (!res.body) throw new AiError('parse', 'response has no stream body');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let full = '';
        // SSE：每筆事件為 `data: {...}` 行，以 [DONE] 收尾；逐行解析 delta。
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '' || data === '[DONE]') continue;
            try {
              const json = JSON.parse(data) as {
                choices?: { delta?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown } }[];
              };
              const delta = json.choices?.[0]?.delta;
              const content = typeof delta?.content === 'string' ? delta.content : undefined;
              const reasoning =
                typeof delta?.reasoning_content === 'string'
                  ? delta.reasoning_content
                  : typeof delta?.reasoning === 'string'
                    ? delta.reasoning
                    : undefined;
              if (content) full += content;
              if (content || reasoning) onDelta({ content, reasoning });
            } catch {
              /* 忽略單筆壞掉的 chunk，續讀 */
            }
          }
        }
        return full;
      });
    },
  };
}
```

- [ ] **Step 2: 寫 `packages/ai-assist/src/client.spec.ts`**（搬既有逐字，改 import 加 `apiKeyAuth`/`noAuth`；末段加 config/auth/retry 測試）

搬 `apps/web/src/lib/ai/client.spec.ts` 全部內容到此檔，**只改兩處**：
1. import 行改為：`import { createAiClient, listAiModels } from './client';` + `import { AiError } from './types';` + 新增 `import { apiKeyAuth, noAuth } from './auth';`
2. 在檔尾 `describe('createAiClient.stream', ...)` 之後，追加下列新 describe：

```ts
describe('createAiClient — typed config (auth + baseUrl)', () => {
  it('apiKeyAuth config posts with Bearer, same as settings form', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('hi'));
    vi.stubGlobal('fetch', fetchMock);
    const out = await createAiClient({ baseUrl: 'http://ai.local/v1', model: 'm1', auth: apiKeyAuth('sk-t') }).complete({ system: 's', user: 'u' });
    expect(out).toBe('hi');
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-t');
  });

  it('noAuth (proxy transport) omits Authorization and posts to baseUrl/chat/completions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('via proxy'));
    vi.stubGlobal('fetch', fetchMock);
    const out = await createAiClient({ baseUrl: '/api/ai', model: 'proxy', auth: noAuth() }).complete({ system: 's', user: 'u' });
    expect(out).toBe('via proxy');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ai/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('typed config with empty baseUrl → config (no fetch)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(createAiClient({ baseUrl: '', model: 'm', auth: noAuth() }).complete({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'config' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('createAiClient — opt-in retry', () => {
  const CFG = (retry: { maxRetries: number; baseDelayMs?: number }) => ({ baseUrl: 'http://ai.local/v1', model: 'm', auth: apiKeyAuth('k'), retry });

  it('retries a 503 then succeeds when maxRetries>0', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(okResponse('recovered'));
    vi.stubGlobal('fetch', fetchMock);
    const out = await createAiClient(CFG({ maxRetries: 1, baseDelayMs: 1 })).complete({ system: 's', user: 'u' });
    expect(out).toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createAiClient(CFG({ maxRetries: 3, baseDelayMs: 1 })).complete({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'http' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('default (no retry policy) does not retry a 503', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('busy', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createAiClient(SETTINGS).complete({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'http' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: 跑測試（既有 + 新）**

Run: `pnpm --filter @rfjs/ai-assist vitest:run client`
Expected: PASS（既有 complete/listAiModels/stream 全綠 + 新 config/auth/retry 全綠）。

- [ ] **Step 4: Commit**

```bash
git add packages/ai-assist/src/client.ts packages/ai-assist/src/client.spec.ts
git commit -m "$(cat <<'EOF'
feat(ai-assist): generalize client to AuthStrategy + baseUrl with opt-in retry

createAiClient keeps the AiSettings byok overload byte-identical and adds a
typed config overload (baseUrl + auth) that unlocks proxy transport via
noAuth. an opt-in RetryPolicy retries 429/5xx/timeout with backoff and
Retry-After; the default maxRetries 0 is exactly today's behavior.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `proxy.ts`（createAiProxyHandler）— TDD

**Files:**
- Create: `packages/ai-assist/src/proxy.ts`
- Test: `packages/ai-assist/src/proxy.spec.ts`

**Interfaces:**
- Consumes: `AiSettings`（Task 2）。
- Produces: `AiProxyOptions`（`getServerSettings`）、`createAiProxyHandler(opts): (req: Request) => Promise<Response>`。

- [ ] **Step 1: 寫失敗測試 `packages/ai-assist/src/proxy.spec.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAiProxyHandler } from './proxy';

const SETTINGS = { baseUrl: 'http://gw.local/v1', apiKey: 'sk-server', model: 'server-model' };

function req(body: unknown) {
  return new Request('http://app.local/api/ai/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('createAiProxyHandler', () => {
  it('forwards to the gateway with server auth and overrides the model', async () => {
    const upstream = new Response(JSON.stringify({ choices: [{ message: { content: 'hi' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal('fetch', fetchMock);
    const handler = createAiProxyHandler({ getServerSettings: () => SETTINGS });
    const res = await handler(req({ model: 'client-suggested', messages: [{ role: 'system', content: 's' }] }));
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://gw.local/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-server');
    const sent = JSON.parse(init.body as string);
    expect(sent.model).toBe('server-model'); // server wins over client suggestion
  });

  it('returns 501 (no fetch) when getServerSettings yields null', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const handler = createAiProxyHandler({ getServerSettings: () => null });
    const res = await handler(req({ messages: [] }));
    expect(res.status).toBe(501);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes upstream status and streaming content-type straight through', async () => {
    const upstream = new Response('data: {"choices":[{"delta":{"content":"x"}}]}\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream));
    const handler = createAiProxyHandler({ getServerSettings: () => SETTINGS });
    const res = await handler(req({ stream: true, messages: [] }));
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(await res.text()).toContain('delta');
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `pnpm --filter @rfjs/ai-assist vitest:run proxy`
Expected: FAIL（`createAiProxyHandler` 未定義）。

- [ ] **Step 3: 寫 `packages/ai-assist/src/proxy.ts`**

```ts
import type { AiSettings } from './types';

export interface AiProxyOptions {
  /** 由呼叫端提供 server 端連線設定（通常讀 env / secret）。回 null → 停用（501）。 */
  getServerSettings: (req: Request) => Promise<AiSettings | null> | AiSettings | null;
}

/** framework-agnostic 透明代理：吃標準 Request、以 server 端 key + model 轉發至 gateway、原樣回傳
 *  （含 SSE 串流 body passthrough）。掛進 Next route handler / Fastify / 任何 fetch-style 後端即成 proxy。
 *  前端 client 走 proxy 時以 noAuth 打 /api/ai，body 為標準 OpenAI 形狀；此處覆寫 model 為 server 設定。 */
export function createAiProxyHandler(opts: AiProxyOptions): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const settings = await opts.getServerSettings(req);
    if (!settings) {
      return new Response(JSON.stringify({ error: 'ai proxy not configured' }), {
        status: 501,
        headers: { 'content-type': 'application/json' },
      });
    }
    const clientBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const upstreamBody = { ...clientBody, model: settings.model }; // server model wins
    const upstream = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify(upstreamBody),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  };
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `pnpm --filter @rfjs/ai-assist vitest:run proxy`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/ai-assist/src/proxy.ts packages/ai-assist/src/proxy.spec.ts
git commit -m "$(cat <<'EOF'
feat(ai-assist): add framework-agnostic server proxy handler

createAiProxyHandler transparently forwards a Request to the gateway with
server-held credentials, overrides the model with server settings, streams
the response body through, and returns 501 when getServerSettings is null.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: barrel + build + 雙語 README + changeset

**Files:**
- Modify: `packages/ai-assist/src/index.ts`
- Create: `packages/ai-assist/README.md`
- Create: `packages/ai-assist/README.zh-TW.md`
- Create: `.changeset/ai-assist-extract.md`

**Interfaces:**
- Produces: 完整發布面（barrel 匯出全部核心公共符號）。

- [ ] **Step 1: 寫完整 barrel `packages/ai-assist/src/index.ts`**

```ts
export * from './types';
export * from './auth';
export * from './storage';
export * from './settings';
export * from './client';
export * from './proxy';
export * from './log';
```

- [ ] **Step 2: 全套件測試 + typecheck + build**

Run: `pnpm --filter @rfjs/ai-assist vitest:run`
Expected: PASS（storage/settings/log/auth/client/proxy 全綠）。

Run: `pnpm --filter @rfjs/ai-assist check-types`
Expected: PASS。

Run: `pnpm --filter @rfjs/ai-assist build`
Expected: 產出 `dist/index.{js,mjs,d.ts}`，無錯。

- [ ] **Step 3: 寫 `packages/ai-assist/README.md`**（英文；比照 data-transform 版面：標題 / 安裝 / 用法 / API）

內容需涵蓋：套件一句話定位、`pnpm add @rfjs/ai-assist`、四段範例（`createAiClient(settings).complete/stream`、`apiKeyAuth`/`noAuth`、`createBrowserStorage` 注入、`createAiProxyHandler` 掛 Next route handler）、安全模型段（BYOK direct vs proxy）、API 一覽表。連結至 `README.zh-TW.md`。

- [ ] **Step 4: 寫 `packages/ai-assist/README.zh-TW.md`**（繁中對照，同結構）。

- [ ] **Step 5: 寫 `.changeset/ai-assist-extract.md`**

```markdown
---
"@rfjs/ai-assist": minor
---

Extract the BYOK edit-time AI capability layer into a publishable,
framework-free package: `AiSettings`/`AiError`/`AiClient` types, an
OpenAI-compatible client with `complete` + SSE `stream` + `listAiModels`, an
`AuthStrategy` abstraction (`apiKeyAuth`/`noAuth`; OAuth shape reserved), an
injectable `AiStorage` with a browser default, `settings`/`createAiLog`
persistence, a framework-agnostic `createAiProxyHandler`, and an opt-in
transport `RetryPolicy` (default off). BYOK behavior is unchanged.
```

- [ ] **Step 6: Commit**

```bash
git add packages/ai-assist/src/index.ts packages/ai-assist/README.md packages/ai-assist/README.zh-TW.md .changeset/ai-assist-extract.md
git commit -m "$(cat <<'EOF'
feat(ai-assist): complete public barrel, bilingual readme, and changeset

export the full core surface, document byok and proxy usage in both
languages, and add the publishable changeset.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — React 層 `@rfjs/ai-assist-ui`（private）

### Task 10: Scaffold `@rfjs/ai-assist-ui`

**Files:**
- Create: `packages/ai-assist-ui/package.json`
- Create: `packages/ai-assist-ui/tsconfig.json`
- Create: `packages/ai-assist-ui/vitest.config.mts`
- Create: `packages/ai-assist-ui/src/index.ts`（暫時空）

**Interfaces:**
- Produces: private 套件 `@rfjs/ai-assist-ui`，dep `@rfjs/ai-assist`、`@rfjs/web-ui`、`lucide-react`；React peer。

- [ ] **Step 1: 寫 `packages/ai-assist-ui/package.json`**（比照 filter-builder-ui）

```json
{
  "name": "@rfjs/ai-assist-ui",
  "version": "0.0.0",
  "description": "React layer over @rfjs/ai-assist: the useAiAssist hook and the AiPanel shell (labels-as-props), consumed via transpilePackages",
  "type": "module",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit",
    "test": "vitest --passWithNoTests --run",
    "vitest:run": "vitest --passWithNoTests --run"
  },
  "dependencies": {
    "@rfjs/ai-assist": "workspace:*",
    "@rfjs/web-ui": "workspace:*",
    "lucide-react": "^1.17.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-react": "^7.37.4",
    "eslint-plugin-react-hooks": "^5.1.0",
    "jsdom": "^29.1.1",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "typescript": "6.0.3",
    "typescript-eslint": "^8.61.0",
    "vitest": "^3.2.4"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: 寫 `packages/ai-assist-ui/tsconfig.json`**（逐字複製 `packages/filter-builder-ui/tsconfig.json`）

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["es2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: 寫 `packages/ai-assist-ui/vitest.config.mts`**（逐字複製 filter-builder-ui 版，含 jsdom）

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.(ts|tsx)'],
    globals: true,
    reporters: ['verbose'],
  },
});
```

- [ ] **Step 4: 寫暫時 barrel `packages/ai-assist-ui/src/index.ts`**

```ts
export {};
```

- [ ] **Step 5: 安裝（新增 workspace 套件 + 連結）**

Run: `pnpm install`
Expected: 完成、`@rfjs/ai-assist-ui` 納入 workspace、連結到 `@rfjs/ai-assist`。

- [ ] **Step 6: 驗證**

Run: `pnpm --filter @rfjs/ai-assist-ui vitest:run`
Expected: PASS（0 tests）。

- [ ] **Step 7: Commit**

```bash
git add packages/ai-assist-ui pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(ai-assist-ui): scaffold private react package

empty @rfjs/ai-assist-ui mirroring filter-builder-ui: ships source via
transpilePackages, depends on @rfjs/ai-assist and @rfjs/web-ui with a react
peer, jsdom vitest.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `use-ai-assist.ts`（搬 + import 改指向核心）

**Files:**
- Create: `packages/ai-assist-ui/src/use-ai-assist.ts`
- Test: `packages/ai-assist-ui/src/use-ai-assist.spec.ts`

**Interfaces:**
- Consumes: `createAiClient`、`isConfigured`、`loadAiSettings`、`subscribeAiSettings`、`AiError`、`CompleteRequest`（皆自 `@rfjs/ai-assist`）。
- Produces: `UseAiAssist`、`useAiAssist()`。

- [ ] **Step 1: 寫 `packages/ai-assist-ui/src/use-ai-assist.ts`**（＝搬 `apps/web/src/lib/ai/use-ai-assist.ts` 逐字，**只改 import 三行**）

把原本：

```ts
import { createAiClient } from './client';
import { isConfigured, loadAiSettings, subscribeAiSettings } from './settings';
import { AiError, type CompleteRequest } from './types';
```

改為單一來源：

```ts
import { AiError, createAiClient, isConfigured, loadAiSettings, subscribeAiSettings, type CompleteRequest } from '@rfjs/ai-assist';
```

其餘（`'use client'`、hook 本體 `run`/`runStream`/`cancel`/`ready`…）**逐字不變**。

- [ ] **Step 2: 寫 `packages/ai-assist-ui/src/use-ai-assist.spec.ts`**（＝搬既有逐字，**只改 import 兩行**）

把原本：

```ts
import { clearAiSettings, saveAiSettings } from './settings';
import { useAiAssist } from './use-ai-assist';
```

改為：

```ts
import { clearAiSettings, saveAiSettings } from '@rfjs/ai-assist';
import { useAiAssist } from './use-ai-assist';
```

其餘測試內容（6 案：ready/live/run/runStream/parse/cancel/superseded）**逐字不變**。

- [ ] **Step 3: 跑測試**

Run: `pnpm --filter @rfjs/ai-assist-ui vitest:run use-ai-assist`
Expected: PASS（6 案全綠）。

- [ ] **Step 4: Commit**

```bash
git add packages/ai-assist-ui/src/use-ai-assist.ts packages/ai-assist-ui/src/use-ai-assist.spec.ts
git commit -m "$(cat <<'EOF'
feat(ai-assist-ui): move the useAiAssist hook onto the core package

hook logic is unchanged; it now imports client/settings/types from
@rfjs/ai-assist instead of relative app paths.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `ai-panel.tsx`（搬 + next-intl → labels-as-props）

**Files:**
- Create: `packages/ai-assist-ui/src/ai-panel.tsx`
- Test: `packages/ai-assist-ui/src/ai-panel.spec.tsx`

**Interfaces:**
- Consumes: `useAiAssist`（同套件）、`createAiLog`/`AiAssistEntry`（`@rfjs/ai-assist`）、`@rfjs/web-ui` 的 Button/Textarea、`lucide-react`。
- Produces: `AI_BLOCK_OPEN_KEY`、`AiPanelAction`、`AiPanelLabels`、`AiPanel`。

- [ ] **Step 1: 寫 `packages/ai-assist-ui/src/ai-panel.tsx`**（＝搬 `apps/web/src/components/shared/ai-panel.tsx`，套下列四項改造）

改造項目：
1. 移除 `import { useTranslations } from "next-intl";`。
2. import 改為套件來源：
   ```tsx
   import { createAiLog, type AiAssistEntry } from "@rfjs/ai-assist";
   import { useAiAssist } from "./use-ai-assist";
   ```
3. 新增 `AiPanelLabels` 型別，並在 props 加 `labels: AiPanelLabels`；移除元件內 `const t = useTranslations("ToolUI");`。
4. 元件內所有 `t("aiXxx")` 改為 `labels.xxx`（對照表如下），`kindLabel` map 改用 `labels`。

新增型別（放在 `AiPanelAction` 附近）：

```tsx
export interface AiPanelLabels {
  kindGenerate: string;
  kindAsk: string;
  kindExplain: string;
  kindCheck: string;
  cancel: string;
  notConfigured: string;
  viewRaw: string;
  thinking: string;
  answers: string;
  advisory: string;
  clear: string;
  reapply: string;
}
```

props 介面加入 `labels: AiPanelLabels;`（與 `title`/`placeholder`/`actions`/`logKey`/`ai`/`onReapply`/`appliedSummary` 並列）。

字串對照（把左邊全部換成右邊）：

| 原 | 新 |
|---|---|
| `t("aiKindGenerate")` | `labels.kindGenerate` |
| `t("aiKindAsk")` | `labels.kindAsk` |
| `t("aiKindExplain")` | `labels.kindExplain` |
| `t("aiKindCheck")` | `labels.kindCheck` |
| `t("aiCancel")` | `labels.cancel` |
| `t("aiNotConfigured")` | `labels.notConfigured` |
| `t("aiViewRaw")` | `labels.viewRaw` |
| `t("aiThinking")` | `labels.thinking` |
| `t("aiAnswers")` | `labels.answers` |
| `t("aiAdvisory")` | `labels.advisory` |
| `t("aiClear")` | `labels.clear` |
| `t("aiReapply")` | `labels.reapply` |

具體地，`kindLabel` 從：

```tsx
const kindLabel: Record<string, string> = {
  generate: t("aiKindGenerate"),
  ask: t("aiKindAsk"),
  explain: t("aiKindExplain"),
  check: t("aiKindCheck"),
};
```

改為：

```tsx
const kindLabel: Record<string, string> = {
  generate: labels.kindGenerate,
  ask: labels.kindAsk,
  explain: labels.kindExplain,
  check: labels.kindCheck,
};
```

其餘結構、className、收合/持久化/串流/紀錄堆疊邏輯**逐字不變**。

- [ ] **Step 2: 寫 `packages/ai-assist-ui/src/ai-panel.spec.tsx`**（＝搬既有，去掉 next-intl provider、改用固定英文 labels）

以下為完整改寫後檔案（移除 `NextIntlClientProvider` 與 `@/messages`，改注入 `LABELS`；assertions 對同一批英文字串不變）：

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiAssistEntry } from "@rfjs/ai-assist";
import { AiPanel, type AiPanelAction, type AiPanelLabels } from "./ai-panel";

const LABELS: AiPanelLabels = {
  kindGenerate: "Generate",
  kindAsk: "Ask",
  kindExplain: "Explain",
  kindCheck: "Check",
  cancel: "Cancel",
  notConfigured: "Set up an AI connection first (top-right ✨).",
  viewRaw: "View raw output",
  thinking: "Thinking…",
  answers: "AI answers",
  advisory: "AI suggestions, not engine verdicts",
  clear: "Clear",
  reapply: "Re-apply",
};

const mockCancel = vi.fn();
let mockReady = true;
let mockLoading = false;
let mockError: { kind: string; message: string; detail?: string } | null = null;
let mockStreamText = "";
let mockStreamReasoning = "";
const fakeAi = () =>
  ({ ready: mockReady, loading: mockLoading, error: mockError, cancel: mockCancel, run: vi.fn(), runStream: vi.fn(), streamText: mockStreamText, streamReasoning: mockStreamReasoning }) as never;

const LOG_KEY = "rfjs.ai.log.panel-spec";
const askRun = vi.fn<(input: string) => Promise<Omit<AiAssistEntry, "id" | "at"> | null>>();
const explainRun = vi.fn<(input: string) => Promise<Omit<AiAssistEntry, "id" | "at"> | null>>();

function actions(): AiPanelAction[] {
  return [
    { key: "ask", label: "Ask it", needsInput: true, primary: true, run: askRun },
    { key: "explain", label: "Explain it", run: explainRun },
  ];
}

function renderPanel(extra: Partial<Parameters<typeof AiPanel>[0]> = {}) {
  return render(
    <AiPanel title="AI assist" placeholder="type here…" actions={actions()} logKey={LOG_KEY} ai={fakeAi()} labels={LABELS} {...extra} />,
  );
}

beforeEach(() => {
  localStorage.clear();
  askRun.mockReset();
  explainRun.mockReset();
  mockCancel.mockReset();
  mockReady = true;
  mockLoading = false;
  mockError = null;
  mockStreamText = "";
  mockStreamReasoning = "";
});

describe("AiPanel — 動作與輸入", () => {
  it("needsInput 動作在空輸入時 disabled；免輸入動作可按", () => {
    renderPanel();
    expect((screen.getByRole("button", { name: /^ask it$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^explain it$/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("run 回 entry → 落地堆疊並寫 localStorage、輸入清空；回 null → 不落地", async () => {
    askRun.mockResolvedValue({ kind: "ask", prompt: "q1", answer: "a1" });
    renderPanel();
    const input = screen.getByPlaceholderText("type here…");
    fireEvent.change(input, { target: { value: "q1" } });
    fireEvent.click(screen.getByRole("button", { name: /^ask it$/i }));
    await waitFor(() => expect(screen.getByText("a1")).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(LOG_KEY)!)).toHaveLength(1);
    expect((input as HTMLTextAreaElement).value).toBe("");

    explainRun.mockResolvedValue(null);
    fireEvent.click(screen.getByRole("button", { name: /^explain it$/i }));
    await waitFor(() => expect(explainRun).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem(LOG_KEY)!)).toHaveLength(1); // 不變
  });

  it("Enter 觸發第一個 needsInput 動作；isComposing / Shift+Enter / loading 不觸發", async () => {
    askRun.mockResolvedValue({ kind: "ask", prompt: "q", answer: "a" });
    renderPanel();
    const input = screen.getByPlaceholderText("type here…");
    fireEvent.change(input, { target: { value: "q" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(askRun).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(askRun).toHaveBeenCalledTimes(1));
  });

  it("loading：顯示取消並可呼叫 cancel；動作 disabled", () => {
    mockLoading = true;
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(mockCancel).toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /^explain it$/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("未設定：動作 disabled + 引導文案", () => {
    mockReady = false;
    renderPanel();
    expect(screen.getByText(/set up an ai connection/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^explain it$/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("parse 錯誤：alert 顯示 [parse] 且附原始輸出摺疊", () => {
    mockError = { kind: "parse", message: "bad", detail: '{"raw":1}' };
    renderPanel();
    expect(screen.getByRole("alert").textContent).toMatch(/\[parse\] bad/);
    expect(screen.getByText(/view raw output/i)).toBeTruthy();
    expect(screen.getByText('{"raw":1}')).toBeTruthy();
  });

  it("串流中：顯示即時回覆與可摺疊的思考區；非串流（streamText 空）不顯示", () => {
    mockLoading = true;
    mockStreamText = "streaming answer…";
    mockStreamReasoning = "step 1";
    const { rerender } = renderPanel();
    expect(screen.getByText("streaming answer…")).toBeTruthy();
    expect(screen.getByText(/thinking/i)).toBeTruthy();
    expect(screen.getByText("step 1")).toBeTruthy();
    mockStreamText = "";
    mockStreamReasoning = "";
    rerender(
      <AiPanel title="AI assist" placeholder="type here…" actions={actions()} logKey={LOG_KEY} ai={fakeAi()} labels={LABELS} />,
    );
    expect(screen.queryByText(/thinking/i)).toBeNull();
  });
});

describe("AiPanel — 收合 / 持久化 / 重新套用", () => {
  it("收合：點標題隱藏內容並存偏好；再點展開存 1", async () => {
    renderPanel();
    const toggle = screen.getByRole("button", { name: /ai assist/i });
    fireEvent.click(toggle);
    expect(screen.queryByPlaceholderText("type here…")).toBeNull();
    expect(localStorage.getItem("rfjs.ai.block.open")).toBe("0");
    fireEvent.click(toggle);
    expect(screen.getByPlaceholderText("type here…")).toBeTruthy();
    expect(localStorage.getItem("rfjs.ai.block.open")).toBe("1");
  });

  it("偏好 0 時掛載即收合（effect 還原，需 waitFor）", async () => {
    localStorage.setItem("rfjs.ai.block.open", "0");
    renderPanel();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /ai assist/i }).getAttribute("aria-expanded")).toBe("false"),
    );
    expect(screen.queryByPlaceholderText("type here…")).toBeNull();
  });

  it("掛載還原堆疊（最新在上）；清除清空 localStorage", async () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        { id: "1", kind: "explain", answer: "第一則", at: "2026-07-08T00:00:00.000Z" },
        { id: "2", kind: "explain", answer: "第二則", at: "2026-07-08T00:00:01.000Z" },
      ]),
    );
    renderPanel();
    const items = await screen.findAllByText(/第[一二]則/);
    expect(items[0]!.textContent).toBe("第二則");
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(localStorage.getItem(LOG_KEY)).toBeNull();
  });

  it("onReapply + appliedJson 才顯示重新套用，點擊帶正確 entry；appliedSummary 呈現", async () => {
    const onReapply = vi.fn();
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        { id: "g1", kind: "generate", prompt: "p", appliedJson: "{}", at: "2026-07-08T00:00:00.000Z" },
        { id: "e1", kind: "explain", answer: "x", at: "2026-07-08T00:00:01.000Z" },
      ]),
    );
    renderPanel({ onReapply, appliedSummary: () => "applied summary!" });
    await screen.findByText("applied summary!");
    const btns = screen.getAllByRole("button", { name: /^re-apply$/i });
    expect(btns).toHaveLength(1);
    fireEvent.click(btns[0]!);
    expect(onReapply).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }));
  });

  it("未給 onReapply：有 appliedJson 也不顯示按鈕", async () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([{ id: "g1", kind: "generate", prompt: "p", appliedJson: "{}", at: "2026-07-08T00:00:00.000Z" }]),
    );
    renderPanel({ appliedSummary: () => "s" });
    await screen.findByText("s");
    expect(screen.queryByRole("button", { name: /^re-apply$/i })).toBeNull();
  });
});
```

- [ ] **Step 3: 跑測試**

Run: `pnpm --filter @rfjs/ai-assist-ui vitest:run ai-panel`
Expected: PASS（全 12 案）。

- [ ] **Step 4: check-types**

Run: `pnpm --filter @rfjs/ai-assist-ui check-types`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/ai-assist-ui/src/ai-panel.tsx packages/ai-assist-ui/src/ai-panel.spec.tsx
git commit -m "$(cat <<'EOF'
feat(ai-assist-ui): move AiPanel with labels-as-props

drop the next-intl coupling; AiPanel now takes a labels object so any i18n
framework can drive it. structure, persistence, streaming, and reapply
behavior are unchanged.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `-ui` barrel + 雙語 README + changeset

**Files:**
- Modify: `packages/ai-assist-ui/src/index.ts`
- Create: `packages/ai-assist-ui/README.md`
- Create: `packages/ai-assist-ui/README.zh-TW.md`
- Create: `.changeset/ai-assist-ui-extract.md`

- [ ] **Step 1: 寫 barrel `packages/ai-assist-ui/src/index.ts`**

```ts
export * from './use-ai-assist';
export * from './ai-panel';
```

- [ ] **Step 2: 全套件測試 + check-types**

Run: `pnpm --filter @rfjs/ai-assist-ui vitest:run`
Expected: PASS。

Run: `pnpm --filter @rfjs/ai-assist-ui check-types`
Expected: PASS。

- [ ] **Step 3: 寫 `packages/ai-assist-ui/README.md`**（英文；比照 filter-builder-ui 版面）
涵蓋：定位、`useAiAssist()` 用法、`<AiPanel>` 的 props（含 `labels`）、labels-as-props 說明、consumed via transpilePackages（非發布）。連結 `README.zh-TW.md`。

- [ ] **Step 4: 寫 `packages/ai-assist-ui/README.zh-TW.md`**（繁中對照）。

- [ ] **Step 5: 寫 `.changeset/ai-assist-ui-extract.md`**

```markdown
---
"@rfjs/ai-assist-ui": patch
---

Add the private React layer over `@rfjs/ai-assist`: the `useAiAssist` hook
and the `AiPanel` shell (labels-as-props, no i18n framework coupling),
consumed via Next.js transpilePackages.
```

- [ ] **Step 6: Commit**

```bash
git add packages/ai-assist-ui/src/index.ts packages/ai-assist-ui/README.md packages/ai-assist-ui/README.zh-TW.md .changeset/ai-assist-ui-extract.md
git commit -m "$(cat <<'EOF'
feat(ai-assist-ui): barrel, bilingual readme, and changeset

export the hook and panel, document usage in both languages, and add the
private-package changeset.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — apps/web 遷移（行為不變；安全網＝既有 web 測試）

> 前置：`@rfjs/ai-assist` 的 `dist/` 已於 Task 9 build。web 的 vitest / build 透過 `exports` 解析核心 `dist`——**若期間又改動核心，需 `pnpm --filter @rfjs/ai-assist build` 重建**。`@rfjs/ai-assist-ui` 走 transpilePackages（source），不需 build。

### Task 14: web 依賴 + transpilePackages + 設定 dialog 改 import

**Files:**
- Modify: `apps/web/package.json`（deps）
- Modify: `apps/web/next.config.ts`（transpilePackages）
- Modify: `apps/web/src/components/shared/ai-settings-dialog.tsx`（import）
- Modify: `apps/web/src/components/shared/ai-settings-dialog.spec.tsx`（import）

**Interfaces:**
- Consumes: `@rfjs/ai-assist`（client/settings/types）、`@rfjs/ai-assist-ui`。

- [ ] **Step 1: `apps/web/package.json` 加兩個 workspace 依賴**

在 `dependencies` 內（`@rfjs/*` 字母序附近）加：

```json
    "@rfjs/ai-assist": "workspace:*",
    "@rfjs/ai-assist-ui": "workspace:*",
```

- [ ] **Step 2: `apps/web/next.config.ts` 的 transpilePackages 加入 `-ui`**

把陣列改為（新增最後一項）：

```ts
  transpilePackages: [
    "@rfjs/web-ui",
    "@rfjs/web-core",
    "@rfjs/filter-builder-ui",
    "@rfjs/form-builder-ui",
    "@rfjs/bpmn-ui",
    "@rfjs/table-builder-ui",
    "@rfjs/ai-assist-ui",
  ],
```

> 註：只加 `-ui`（source 套件）。`@rfjs/ai-assist` 是 dist 套件，不列入 transpile。

- [ ] **Step 3: `pnpm install`（連結新依賴）**

Run: `pnpm install`
Expected: 完成、web 連到兩個新套件。

- [ ] **Step 4: 改 `ai-settings-dialog.tsx` 的三行 import → 單一核心來源**

把：

```tsx
import { createAiClient, listAiModels } from '@/lib/ai/client';
import { loadAiSettings, saveAiSettings } from '@/lib/ai/settings';
import { AiError } from '@/lib/ai/types';
```

改為：

```tsx
import { AiError, createAiClient, listAiModels, loadAiSettings, saveAiSettings } from '@rfjs/ai-assist';
```

其餘（`useTranslations('AiSettings')`、dialog 本體）不變。

- [ ] **Step 5: 改 `ai-settings-dialog.spec.tsx` 的 import**

把：

```tsx
import { AI_SETTINGS_KEY } from '@/lib/ai/settings';
```

改為：

```tsx
import { AI_SETTINGS_KEY } from '@rfjs/ai-assist';
```

- [ ] **Step 6: 驗證 dialog 測試 + typecheck**

Run: `pnpm --filter @rfjs/ai-assist build`（確保核心 dist 最新）
Run: `pnpm --filter web vitest:run ai-settings-dialog`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/next.config.ts apps/web/src/components/shared/ai-settings-dialog.tsx apps/web/src/components/shared/ai-settings-dialog.spec.tsx pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
refactor(web): point the ai settings dialog at @rfjs/ai-assist

add the ai-assist + ai-assist-ui workspace deps, transpile the ui package,
and repoint the settings dialog imports at the extracted core. no behavior
change.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: 四個工具改 import + 注入 labels

**Files:**
- Create: `apps/web/src/components/shared/ai-panel-labels.ts`
- Modify: `apps/web/src/tools/_filter-builder/ai-assist-block.tsx`
- Modify: `apps/web/src/tools/decision-table/ui.tsx`
- Modify: `apps/web/src/tools/form-builder/ui.tsx`
- Modify: `apps/web/src/tools/table-builder/ui.tsx`
- Modify: 上述四者的 `*.spec.tsx`（mock 路徑）

**Interfaces:**
- Consumes: `@rfjs/ai-assist-ui`（`useAiAssist`、`AiPanel`、`AiPanelAction`、`AiPanelLabels`）。
- Produces: `useAiPanelLabels()`（app 端共用，把 `ToolUI` 訊息組成 `AiPanelLabels`）。

- [ ] **Step 1: 建共用 labels hook `apps/web/src/components/shared/ai-panel-labels.ts`**

```ts
import { useTranslations } from "next-intl";
import type { AiPanelLabels } from "@rfjs/ai-assist-ui";

/** 把 ToolUI 的 AI 文案組成 AiPanel 的 labels（labels-as-props；DRY 於四個工具）。 */
export function useAiPanelLabels(): AiPanelLabels {
  const t = useTranslations("ToolUI");
  return {
    kindGenerate: t("aiKindGenerate"),
    kindAsk: t("aiKindAsk"),
    kindExplain: t("aiKindExplain"),
    kindCheck: t("aiKindCheck"),
    cancel: t("aiCancel"),
    notConfigured: t("aiNotConfigured"),
    viewRaw: t("aiViewRaw"),
    thinking: t("aiThinking"),
    answers: t("aiAnswers"),
    advisory: t("aiAdvisory"),
    clear: t("aiClear"),
    reapply: t("aiReapply"),
  };
}
```

- [ ] **Step 2: `_filter-builder/ai-assist-block.tsx`**

把兩行 import：

```tsx
import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { AiPanel, type AiPanelAction } from "@/components/shared/ai-panel";
```

改為：

```tsx
import { AiPanel, useAiAssist, type AiPanelAction } from "@rfjs/ai-assist-ui";
import { useAiPanelLabels } from "@/components/shared/ai-panel-labels";
```

在元件內 `const ai = useAiAssist();` 之後加：

```tsx
  const aiLabels = useAiPanelLabels();
```

在 `<AiPanel` 標籤加一個 prop（與 `ai={ai}` 並列）：

```tsx
      labels={aiLabels}
```

- [ ] **Step 3: `decision-table/ui.tsx`**

把：

```tsx
import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { AiPanel } from "@/components/shared/ai-panel";
```

改為：

```tsx
import { AiPanel, useAiAssist } from "@rfjs/ai-assist-ui";
import { useAiPanelLabels } from "@/components/shared/ai-panel-labels";
```

在 `const ai = useAiAssist();` 之後加 `const aiLabels = useAiPanelLabels();`，並在 `<AiPanel` 加 `labels={aiLabels}`。

- [ ] **Step 4: `form-builder/ui.tsx`**

把：

```tsx
import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { AiPanel } from "@/components/shared/ai-panel";
```

改為：

```tsx
import { AiPanel, useAiAssist } from "@rfjs/ai-assist-ui";
import { useAiPanelLabels } from "@/components/shared/ai-panel-labels";
```

在 `const ai = useAiAssist();` 之後加 `const aiLabels = useAiPanelLabels();`，並在 `<AiPanel` 加 `labels={aiLabels}`。

- [ ] **Step 5: `table-builder/ui.tsx`**

把：

```tsx
import { AiPanel } from "@/components/shared/ai-panel";
import { useAiAssist } from "@/lib/ai/use-ai-assist";
```

改為：

```tsx
import { AiPanel, useAiAssist } from "@rfjs/ai-assist-ui";
import { useAiPanelLabels } from "@/components/shared/ai-panel-labels";
```

在 `const ai = useAiAssist();` 之後加 `const aiLabels = useAiPanelLabels();`，並在 `<AiPanel` 加 `labels={aiLabels}`。

- [ ] **Step 6: 四個 `*.spec.tsx` 的 mock 路徑改為 `@rfjs/ai-assist-ui`（保留真 AiPanel）**

四檔（`_filter-builder/ai-assist-block.spec.tsx`、`decision-table/ui.spec.tsx`、`form-builder/ui.spec.tsx`、`table-builder/ui.spec.tsx`）內原本：

```tsx
vi.mock("@/lib/ai/use-ai-assist", () => ({
  useAiAssist: () => ({ ready: mockReady, loading: mockLoading, error: mockError, cancel: mockCancel, run: mockRun, runStream: mockRun, streamText: "", streamReasoning: "" }),
}));
```

改為（用 `importOriginal` 保留真的 `AiPanel`，只覆寫 hook）：

```tsx
vi.mock("@rfjs/ai-assist-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rfjs/ai-assist-ui")>()),
  useAiAssist: () => ({ ready: mockReady, loading: mockLoading, error: mockError, cancel: mockCancel, run: mockRun, runStream: mockRun, streamText: "", streamReasoning: "" }),
}));
```

（各檔 mock 物件的欄位/變數名維持原檔既有者；table-builder 版若原本多帶欄位，一律保留原欄位、只改路徑與 `importOriginal` 包法。）

- [ ] **Step 7: 驗證四工具測試**

Run: `pnpm --filter @rfjs/ai-assist build && pnpm --filter web vitest:run tools/`
Expected: PASS（filter/decision-table/form/table 全綠）。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/shared/ai-panel-labels.ts apps/web/src/tools
git commit -m "$(cat <<'EOF'
refactor(web): point tool ai panels at @rfjs/ai-assist-ui with labels

each tool now imports useAiAssist and AiPanel from the ui package and feeds
translated labels via a shared useAiPanelLabels hook; specs mock the ui
package while keeping the real panel. no behavior change.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: 刪除舊 seam + 加 proxy reference route handler

**Files:**
- Delete: `apps/web/src/lib/ai/`（整個目錄，含 types/auth-less 舊碼與其 spec）
- Delete: `apps/web/src/components/shared/ai-panel.tsx`、`ai-panel.spec.tsx`
- Create: `apps/web/src/app/api/ai/chat/completions/route.ts`
- Create: `apps/web/src/app/api/ai/chat/completions/route.spec.ts`

**Interfaces:**
- Consumes: `createAiProxyHandler`（`@rfjs/ai-assist`）。

- [ ] **Step 1: 確認 web 內已無舊 seam 引用**

Run: `grep -rn "@/lib/ai\|shared/ai-panel" apps/web/src`
Expected: 無輸出（Task 14/15 已全數改指向套件）。

- [ ] **Step 2: 刪除舊檔**

```bash
git rm -r apps/web/src/lib/ai
git rm apps/web/src/components/shared/ai-panel.tsx apps/web/src/components/shared/ai-panel.spec.tsx
```

- [ ] **Step 3: 寫 reference route `apps/web/src/app/api/ai/chat/completions/route.ts`**

```ts
import { createAiProxyHandler } from "@rfjs/ai-assist";

// Reference server-proxy handler. The public showcase keeps using browser BYOK;
// this route stays disabled (501) unless AI_PROXY_* env is configured, and exists
// to demonstrate / enable the server-proxy mode (key held server-side, never in the
// browser). Wire a gate (auth / rate-limit) before enabling on a public deployment.
const handler = createAiProxyHandler({
  getServerSettings: () => {
    const baseUrl = process.env.AI_PROXY_BASE_URL;
    const apiKey = process.env.AI_PROXY_API_KEY;
    const model = process.env.AI_PROXY_MODEL;
    if (!baseUrl || !apiKey || !model) return null; // not configured → 501
    return { baseUrl, apiKey, model };
  },
});

export const POST = (req: Request): Promise<Response> => handler(req);
```

- [ ] **Step 4: 寫 `apps/web/src/app/api/ai/chat/completions/route.spec.ts`**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_PROXY_BASE_URL;
  delete process.env.AI_PROXY_API_KEY;
  delete process.env.AI_PROXY_MODEL;
});

function req(body: unknown) {
  return new Request("http://web.local/api/ai/chat/completions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("ai proxy reference route", () => {
  it("returns 501 when AI_PROXY_* env is not configured (disabled by default)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ messages: [] }));
    expect(res.status).toBe(501);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards with server credentials when env is configured", async () => {
    process.env.AI_PROXY_BASE_URL = "http://gw.local/v1";
    process.env.AI_PROXY_API_KEY = "sk-server";
    process.env.AI_PROXY_MODEL = "server-model";
    const upstream = new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ model: "client", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://gw.local/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-server");
  });
});
```

- [ ] **Step 5: 驗證 route 測試 + web 全套**

Run: `pnpm --filter @rfjs/ai-assist build && pnpm --filter web vitest:run`
Expected: PASS（全 300+，含新 route.spec；無 `@/lib/ai` 解析錯誤）。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/ai
git commit -m "$(cat <<'EOF'
refactor(web): remove the local ai seam and add a proxy reference route

delete apps/web/src/lib/ai and the old ai-panel now that both live in the
extracted packages; add a disabled-by-default server-proxy route handler
(501 until AI_PROXY_* env is set) demonstrating the proxy capability.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: 全域驗證（安全網）

**Files:** 無（純驗證）。

- [ ] **Step 1: 建置所有套件（turbo 會先 build 依賴）**

Run: `pnpm build:packages`
Expected: `@rfjs/ai-assist` 等全數 build 成功。

- [ ] **Step 2: 套件單元測試**

Run: `pnpm --filter @rfjs/ai-assist vitest:run && pnpm --filter @rfjs/ai-assist-ui vitest:run`
Expected: PASS。

- [ ] **Step 3: web 全套測試（BYOK 行為回歸網）**

Run: `pnpm --filter web vitest:run`
Expected: PASS（300+）。

- [ ] **Step 4: 型別檢查（web + workbench + 套件）**

Run: `pnpm --filter web check-types && pnpm --filter workbench check-types && pnpm --filter @rfjs/ai-assist check-types && pnpm --filter @rfjs/ai-assist-ui check-types`
Expected: PASS。

- [ ] **Step 5: Lint**

Run: `pnpm --filter web lint`
Expected: PASS。

- [ ] **Step 6: 兩個 app build**

Run: `pnpm --filter web build && pnpm --filter workbench build`
Expected: 兩者成功（workbench 未用 ai-assist，但須確認未被牽連破壞）。

- [ ] **Step 7: e2e（打 production，絕不 next dev）**

Run: `pnpm --filter web build && pnpm --filter web start --port 3002 &`（背景起 production server）
接著跑 web 的 e2e 指令（依 web `package.json` 既有 e2e script，對 `http://localhost:3002`）。
Expected: 既有 AI 相關 e2e 全綠；結束後關閉背景 server。

- [ ] **Step 8: 最終確認 + commit（若有 lint/format 微調）**

Run: `git status`
Expected: 乾淨，或僅 format 微調；如有則：

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(ai-assist): final formatting after extraction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

**HOLD PR** —— 不開 PR、不推送；把分支 `worktree-feat-ai-assist-extract` 交回使用者於 GitHub 自行處理。

---

## Self-Review（plan 對照 spec）

**Spec coverage：**
- Q1 兩套件切分 → Task 1（core scaffold）、Task 10（-ui scaffold）✅
- Q2 storage adapter + browser 預設 → Task 3（storage）、Task 4/5（settings/log 收 storage）✅
- Q3 AuthStrategy + baseUrl + proxy → Task 6（auth）、Task 7（client config overload）、Task 8（proxy handler）、Task 16（reference route）✅
- Q4 opt-in retry / 不動 @rfjs/retry / self-repair 僅設計 → Task 7（RetryPolicy 預設關）✅；self-repair 未加 dead API ✅
- Q5 AiPanel 移 -ui + labels-as-props → Task 12（panel）、Task 15（labels 注入）✅
- 抽離邊界（prompt 組裝、dialog、wiring 留 app）→ Task 14/15 僅改 import + labels，prompt 檔未動 ✅
- 安全模型（BYOK 不變、proxy reference 預設關）→ Task 7 guard 保留、Task 16 route 501 預設 ✅
- 交付：inline build config（Task 1/10）、雙語 README（Task 9/13）、兩 changeset（Task 9/13）、驗證網（Task 17）✅

**Placeholder scan：** 無 TBD/TODO；README 內容以「需涵蓋項目」明列（Task 9/13）——實作時據此撰寫，非程式碼步驟故不附整段文字。

**Type consistency：** `AiPanelLabels`（Task 12 定義）↔ `useAiPanelLabels()`（Task 15 產出）欄位一致；`AiClientConfig`/`RetryPolicy`（Task 7）↔ client 測試（Task 7）一致；`createAiProxyHandler`/`AiProxyOptions`（Task 8）↔ reference route（Task 16）一致；`AiStorage`（Task 3）↔ settings/log 注入（Task 4/5）一致；`AiError` 加 `status`/`retryAfterMs`（Task 2）↔ client retry 分類（Task 7）一致。

**已知、可接受的行為差異（非回歸）：** storage 的同分頁事件改為通用 `rfjs:ai-storage`；log 寫入現在也會派送該事件，故 settings 訂閱者在 log 寫入時會被喚醒一次——但 `useSyncExternalStore` 對相同 snapshot 不重繪，功能上惰性、既有測試全綠。
