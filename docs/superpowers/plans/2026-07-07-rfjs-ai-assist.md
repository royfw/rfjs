# AI Assist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BYOK(baseUrl/apiKey/model,OpenAI-compatible)的 edit-time AI 輔助層:全站設定 dialog + 三個 assist —— filter-builder 家族「NL→條件樹」、decision-table「AI 表格檢查」、form-builder「NL→FormConfig」,全部經既有 parser 驗證後才落地。

**Architecture:** app-local seam(`apps/web/src/lib/ai/`,套件形狀:types/settings/client/hook 分檔,未來可機械抽成 `@rfjs/ai-assist`);`@rfjs/web-ui` 新增 shadcn Dialog(用既有統一 `radix-ui` 套件,**零新依賴**);設定存 localStorage、瀏覽器直連使用者端點;AI 輸出一律走既有驗證閘門(filter 家族直接重用 `useFilterBuilder.onCanonicalChange` 的 parse→setTree 路徑;form-builder 走 `jsonToCards`;decision-table findings 走 zod + 幻覺 id 過濾)。

**Tech Stack:** React 19、next-intl、radix-ui(Dialog)、zod、Vitest(jsdom,`vi.stubGlobal('fetch')`)、Playwright(既有 e2e 基礎設施)。

## Global Constraints

- 全程在 worktree `.claude/worktrees/feat-ai-assist`(基於 origin/main;已 install + build:packages)。`<worktree>` = `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-ai-assist`。
- **鐵律:AI 輸出永不直接落地** —— 一律 AI 吐 JSON → 既有 parser/zod 驗證 → 通過才進畫面;失敗顯示錯誤(原始輸出可檢視)。`@rfjs/*` 引擎套件(filter-builder/decision-table/form-builder)**零改動**。
- **Changeset 政策**:`packages/*` 有動就附 changeset,**private 也要**(本案:`@rfjs/web-ui` 新增 Dialog → patch changeset);`apps/*` 不用。
- 回應模式:單發 JSON + `AbortController` 取消;`AiClient` 介面預留 `stream()`(**不實作**)。逾時預設 60_000ms。
- localStorage key:`rfjs.ai.settings`;apiKey 只存瀏覽器;設定 dialog 明示資料會送到使用者自己的端點。
- i18n:設定 dialog 文案入**中央** `apps/web/src/messages/{en,zh-TW}.json` 新 `AiSettings` 命名空間;filter 家族共用 AI 列的鍵入**中央 `ToolUI`**(`ai*` 前綴,與 fragment 鍵不得撞名 —— `tools/index.spec.ts` 有檢查);decision-table 用 `dtAi*` 入其 fragment;form-builder 用 `fbAi*` 入其 fragment。en+zh-TW 鍵集必須一致。
- web-ui 是 source-consumed(transpilePackages)+ **Tailwind @source 掃描** —— 新元件的樣式類別無需額外設定,但**新元件檔必須含 `'use client'`**(repo 剛修過 hooks 漏指令的 CI 事故,引以為鑑)。
- Commit:英文 conventional,**subject 全小寫開頭**,body 與 trailer 之間空行,訊息最後一行精確為 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 測試指令:`pnpm -C <worktree> --filter web vitest:run -- <pattern>`;web-ui:`pnpm -C <worktree> --filter @rfjs/web-ui test`。**HOLD PR**。
- 紅線:不動 `apps/web/src/tools/flow-builder/**`、不動 `next.config.js`、不動任何 `@rfjs/*` 引擎套件原始碼。

---

## Task 1: `@rfjs/web-ui` Dialog 元件(+ changeset)

**Files:**
- Create: `packages/web-ui/src/components/dialog.tsx`
- Test: `packages/web-ui/src/components/dialog.spec.tsx`
- Create: `.changeset/web-ui-dialog.md`

**Interfaces:**
- Produces: `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose`(shadcn 形狀;`DialogContent` 內建右上 X 關閉鈕)。

- [ ] **Step 1: 寫失敗測試 `packages/web-ui/src/components/dialog.spec.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './dialog';

describe('Dialog', () => {
  it('opens from the trigger and renders title/description/content', () => {
    render(
      <Dialog>
        <DialogTrigger>open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>desc</DialogDescription>
          <p>body</p>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByText('body')).toBeNull();
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('closes via the built-in close button', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>t</DialogTitle>
          <p>body</p>
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText('body')).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter @rfjs/web-ui test`
Expected: FAIL —— 找不到 `./dialog`。

- [ ] **Step 3: 實作 `packages/web-ui/src/components/dialog.tsx`**(比照 popover.tsx:統一 `radix-ui` 套件、data-slot、cn)

```tsx
'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';

import { cn } from '../lib/utils';

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-lg',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:outline-hidden"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('flex flex-col gap-1.5', className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-footer" className={cn('flex justify-end gap-2', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg font-semibold leading-none', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter @rfjs/web-ui test`
Expected: PASS(dialog 2 tests + 既有全部)。jsdom 若因 radix Dialog 需要 `hasPointerCapture` 等 shim,比照 repo 其他 spec 檔頂部加同款 Element shim。

- [ ] **Step 5: 建 changeset `.changeset/web-ui-dialog.md`**

```markdown
---
'@rfjs/web-ui': patch
---

Add a shadcn-style `Dialog` component (built on the unified `radix-ui` package, no new dependency) — first consumer is the AI-assist settings dialog.
```

- [ ] **Step 6: lint + typecheck + Commit**

Run: `pnpm -C <worktree> --filter @rfjs/web-ui lint && pnpm -C <worktree> --filter @rfjs/web-ui typecheck`
Expected: 皆綠(script 名若為 `check-types` 以 package.json 為準)。

```bash
git add packages/web-ui/src/components/dialog.tsx packages/web-ui/src/components/dialog.spec.tsx .changeset/web-ui-dialog.md
git commit -m "feat(web-ui): add dialog component

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: `lib/ai` 核心(types + settings + client,TDD)

**Files:**
- Create: `apps/web/src/lib/ai/types.ts`
- Create: `apps/web/src/lib/ai/settings.ts`
- Create: `apps/web/src/lib/ai/client.ts`
- Test: `apps/web/src/lib/ai/settings.spec.ts`
- Test: `apps/web/src/lib/ai/client.spec.ts`

**Interfaces:**
- Produces:
  - `interface AiSettings { baseUrl: string; apiKey: string; model: string }`
  - `type AiErrorKind = 'config' | 'http' | 'timeout' | 'abort' | 'parse'`
  - `class AiError extends Error { kind: AiErrorKind; detail?: string }`
  - `interface CompleteRequest { system: string; user: string; json?: boolean; signal?: AbortSignal; timeoutMs?: number }`
  - `interface AiClient { complete(req: CompleteRequest): Promise<string> }`(stream 預留:介面註解標明未來加 `stream()`,不宣告)
  - `AI_SETTINGS_KEY = 'rfjs.ai.settings'`;`loadAiSettings(): AiSettings | null`;`saveAiSettings(s): void`;`clearAiSettings(): void`;`isConfigured(s: AiSettings | null): s is AiSettings`
  - `createAiClient(settings: AiSettings): AiClient`

- [ ] **Step 1: 寫 `apps/web/src/lib/ai/types.ts`**

```ts
/** BYOK 連線設定 —— 只存 localStorage,只在瀏覽器使用。 */
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
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export interface CompleteRequest {
  system: string;
  user: string;
  /** true → 要求 JSON 回應(response_format: json_object)。 */
  json?: boolean;
  signal?: AbortSignal;
  /** 預設 60_000ms。 */
  timeoutMs?: number;
}

/** 單發完成介面;未來長文場景再加 stream()(刻意不先宣告)。 */
export interface AiClient {
  complete(req: CompleteRequest): Promise<string>;
}
```

- [ ] **Step 2: 寫失敗測試 `apps/web/src/lib/ai/settings.spec.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_SETTINGS_KEY, clearAiSettings, isConfigured, loadAiSettings, saveAiSettings } from './settings';

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
});
```

- [ ] **Step 3: 寫失敗測試 `apps/web/src/lib/ai/client.spec.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAiClient } from './client';
import { AiError } from './types';

const SETTINGS = { baseUrl: 'http://ai.local/v1', apiKey: 'sk-t', model: 'm1' };

function okResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('createAiClient.complete', () => {
  it('posts an openai-compatible chat body and returns the content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('hello'));
    vi.stubGlobal('fetch', fetchMock);
    const out = await createAiClient(SETTINGS).complete({ system: 'sys', user: 'usr' });
    expect(out).toBe('hello');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://ai.local/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer sk-t' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('m1');
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ]);
    expect(body.response_format).toBeUndefined();
  });

  it('json:true adds response_format json_object', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await createAiClient(SETTINGS).complete({ system: 's', user: 'u', json: true });
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('http error → AiError kind http with status detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    await expect(createAiClient(SETTINGS).complete({ system: 's', user: 'u' })).rejects.toMatchObject({
      name: 'AiError',
      kind: 'http',
    });
  });

  it('malformed success payload → AiError kind parse', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"weird":true}', { status: 200 })));
    await expect(createAiClient(SETTINGS).complete({ system: 's', user: 'u' })).rejects.toMatchObject({
      kind: 'parse',
    });
  });

  it('external abort → AiError kind abort', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_u, init) =>
        new Promise((_res, rej) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            rej(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
      ),
    );
    const ctl = new AbortController();
    const p = createAiClient(SETTINGS).complete({ system: 's', user: 'u', signal: ctl.signal });
    ctl.abort();
    await expect(p).rejects.toMatchObject({ kind: 'abort' });
  });

  it('timeout → AiError kind timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_u, init) =>
        new Promise((_res, rej) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            rej(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
      ),
    );
    const p = createAiClient(SETTINGS).complete({ system: 's', user: 'u', timeoutMs: 1000 });
    const assertion = expect(p).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    vi.useRealTimers();
  });

  it('missing settings fields → AiError kind config (no fetch)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      createAiClient({ baseUrl: '', apiKey: '', model: '' }).complete({ system: 's', user: 'u' }),
    ).rejects.toMatchObject({ kind: 'config' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(new AiError('config', 'x')).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 4: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- lib/ai`
Expected: FAIL —— 找不到 `./settings` / `./client`。

- [ ] **Step 5: 實作 `apps/web/src/lib/ai/settings.ts`**

```ts
import type { AiSettings } from './types';

export const AI_SETTINGS_KEY = 'rfjs.ai.settings';

export function loadAiSettings(): AiSettings | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(AI_SETTINGS_KEY);
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

export function saveAiSettings(s: AiSettings): void {
  window.localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(s));
}

export function clearAiSettings(): void {
  window.localStorage.removeItem(AI_SETTINGS_KEY);
}

export function isConfigured(s: AiSettings | null): s is AiSettings {
  return !!s && s.baseUrl.trim() !== '' && s.apiKey.trim() !== '' && s.model.trim() !== '';
}
```

- [ ] **Step 6: 實作 `apps/web/src/lib/ai/client.ts`**

```ts
import { AiError, type AiClient, type AiSettings, type CompleteRequest } from './types';
import { isConfigured } from './settings';

const DEFAULT_TIMEOUT_MS = 60_000;

/** OpenAI-compatible 單發 chat completion(litellm / Ollama / OpenAI 通用)。 */
export function createAiClient(settings: AiSettings): AiClient {
  return {
    async complete(req: CompleteRequest): Promise<string> {
      if (!isConfigured(settings)) {
        throw new AiError('config', 'AI connection is not configured');
      }
      const ctl = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        ctl.abort();
      }, req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      const onExternalAbort = () => ctl.abort();
      req.signal?.addEventListener('abort', onExternalAbort, { once: true });

      try {
        const res = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.apiKey}`,
          },
          body: JSON.stringify({
            model: settings.model,
            messages: [
              { role: 'system', content: req.system },
              { role: 'user', content: req.user },
            ],
            ...(req.json ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: ctl.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new AiError('http', `AI endpoint returned ${res.status}`, text.slice(0, 500));
        }
        const data = (await res.json().catch(() => null)) as
          | { choices?: { message?: { content?: unknown } }[] }
          | null;
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') {
          throw new AiError('parse', 'unexpected completion payload shape');
        }
        return content;
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
    },
  };
}
```

- [ ] **Step 7: 跑測試 + check-types 確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- lib/ai && pnpm -C <worktree> --filter web check-types`
Expected: PASS(settings 3 + client 7)。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/ai/types.ts apps/web/src/lib/ai/settings.ts apps/web/src/lib/ai/client.ts \
  apps/web/src/lib/ai/settings.spec.ts apps/web/src/lib/ai/client.spec.ts
git commit -m "feat(web): add byok ai client seam (types, settings storage, openai-compatible client)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: `useAiAssist` hook(TDD)

**Files:**
- Create: `apps/web/src/lib/ai/use-ai-assist.ts`
- Test: `apps/web/src/lib/ai/use-ai-assist.spec.ts`

**Interfaces:**
- Consumes: `loadAiSettings`/`isConfigured`(./settings)、`createAiClient`(./client)、`AiError`/`CompleteRequest`(./types)
- Produces:
  - `interface UseAiAssist { ready: boolean; loading: boolean; error: AiError | null; cancel: () => void; run<T>(req: Omit<CompleteRequest,'signal'>, parse: (raw: string) => T): Promise<T | null> }`
  - `function useAiAssist(): UseAiAssist` —— `ready` = isConfigured(每次 render 讀 settings);`run` 成功回 `T`、任何失敗(含 parse throw)設 `error` 回 `null`;**abort 不設 error**;新 run 取消前一個。

- [ ] **Step 1: 寫失敗測試 `apps/web/src/lib/ai/use-ai-assist.spec.ts`**

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveAiSettings } from './settings';
import { useAiAssist } from './use-ai-assist';

function okResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

beforeEach(() => {
  localStorage.clear();
  saveAiSettings({ baseUrl: 'http://ai.local/v1', apiKey: 'k', model: 'm' });
});
afterEach(() => vi.unstubAllGlobals());

describe('useAiAssist', () => {
  it('ready reflects configuration', () => {
    localStorage.clear();
    const { result } = renderHook(() => useAiAssist());
    expect(result.current.ready).toBe(false);
  });

  it('run: completes, parses, returns T, clears error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse('{"a":1}')));
    const { result } = renderHook(() => useAiAssist());
    let out: unknown;
    await act(async () => {
      out = await result.current.run({ system: 's', user: 'u', json: true }, (raw) => JSON.parse(raw));
    });
    expect(out).toEqual({ a: 1 });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('run: parse gate rejection lands in error and returns null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse('garbage')));
    const { result } = renderHook(() => useAiAssist());
    let out: unknown = 'sentinel';
    await act(async () => {
      out = await result.current.run({ system: 's', user: 'u' }, () => {
        throw new Error('invalid tree');
      });
    });
    expect(out).toBeNull();
    await waitFor(() => expect(result.current.error?.kind).toBe('parse'));
  });

  it('cancel: aborts without setting error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_u, init) =>
        new Promise((_res, rej) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            rej(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
      ),
    );
    const { result } = renderHook(() => useAiAssist());
    let p: Promise<unknown>;
    act(() => {
      p = result.current.run({ system: 's', user: 'u' }, (r) => r);
    });
    act(() => result.current.cancel());
    await act(async () => {
      expect(await p!).toBeNull();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- use-ai-assist`
Expected: FAIL。

- [ ] **Step 3: 實作 `apps/web/src/lib/ai/use-ai-assist.ts`**

```ts
'use client';

import * as React from 'react';

import { createAiClient } from './client';
import { isConfigured, loadAiSettings } from './settings';
import { AiError, type CompleteRequest } from './types';

export interface UseAiAssist {
  ready: boolean;
  loading: boolean;
  error: AiError | null;
  cancel: () => void;
  run<T>(req: Omit<CompleteRequest, 'signal'>, parse: (raw: string) => T): Promise<T | null>;
}

export function useAiAssist(): UseAiAssist {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<AiError | null>(null);
  const ctlRef = React.useRef<AbortController | null>(null);
  // settings 每次呼叫時讀(設定 dialog 存檔後,下一次 run 即用新值)。
  const ready = isConfigured(typeof window === 'undefined' ? null : loadAiSettings());

  const cancel = React.useCallback(() => {
    ctlRef.current?.abort();
  }, []);

  const run = React.useCallback(async <T,>(req: Omit<CompleteRequest, 'signal'>, parse: (raw: string) => T): Promise<T | null> => {
    const settings = loadAiSettings();
    if (!isConfigured(settings)) {
      setError(new AiError('config', 'AI connection is not configured'));
      return null;
    }
    ctlRef.current?.abort(); // 新 run 取消前一個
    const ctl = new AbortController();
    ctlRef.current = ctl;
    setLoading(true);
    setError(null);
    try {
      const raw = await createAiClient(settings).complete({ ...req, signal: ctl.signal });
      try {
        return parse(raw);
      } catch (e) {
        setError(new AiError('parse', e instanceof Error ? e.message : String(e), raw));
        return null;
      }
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('http', String(e));
      if (err.kind !== 'abort') setError(err); // 使用者取消不是錯誤
      return null;
    } finally {
      if (ctlRef.current === ctl) ctlRef.current = null;
      setLoading(false);
    }
  }, []);

  return { ready, loading, error, cancel, run };
}
```

- [ ] **Step 4: 跑測試確認通過 + Commit**

Run: `pnpm -C <worktree> --filter web vitest:run -- use-ai-assist && pnpm -C <worktree> --filter web check-types`
Expected: PASS(4)。

```bash
git add apps/web/src/lib/ai/use-ai-assist.ts apps/web/src/lib/ai/use-ai-assist.spec.ts
git commit -m "feat(web): add useAiAssist hook (run/parse gate, cancel, config gating)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: 設定 dialog + header ✨ 入口 + `AiSettings` i18n

**Files:**
- Create: `apps/web/src/components/shared/ai-settings-dialog.tsx`
- Modify: `apps/web/src/components/layout/app-header.tsx`(actions 區插入 `<AiSettingsDialog />`,在 `<LocaleSwitcher />` 之前)
- Modify: `apps/web/src/messages/en.json` + `apps/web/src/messages/zh-TW.json`(新頂層 `AiSettings` 命名空間)
- Test: `apps/web/src/components/shared/ai-settings-dialog.spec.tsx`

**Interfaces:**
- Consumes: web-ui `Dialog*`(Task 1)、`Button`/`Input`/`Label`(web-ui 既有)、`loadAiSettings`/`saveAiSettings`/`isConfigured`(Task 2)、`createAiClient`(Task 2)
- Produces: `function AiSettingsDialog()`(client component,含 trigger 按鈕本體;header 直接 render)

- [ ] **Step 1: 中央 i18n** —— `en.json` 頂層(`Packages` 之後)加:

```json
  "AiSettings": {
    "trigger": "AI settings",
    "title": "AI Assist",
    "description": "Bring your own key. Requests go directly from your browser to the endpoint you configure — nothing is stored server-side.",
    "baseUrl": "Base URL",
    "baseUrlPlaceholder": "http://localhost:4000/v1",
    "apiKey": "API key",
    "model": "Model",
    "test": "Test connection",
    "testOk": "Connection OK",
    "testFail": "Connection failed",
    "save": "Save",
    "saved": "Saved"
  }
```

`zh-TW.json` 同位置:

```json
  "AiSettings": {
    "trigger": "AI 設定",
    "title": "AI 輔助",
    "description": "自帶金鑰(BYOK)。請求由你的瀏覽器直接送往你設定的端點 —— 不經任何伺服器儲存。",
    "baseUrl": "Base URL",
    "baseUrlPlaceholder": "http://localhost:4000/v1",
    "apiKey": "API 金鑰",
    "model": "模型",
    "test": "測試連線",
    "testOk": "連線成功",
    "testFail": "連線失敗",
    "save": "儲存",
    "saved": "已儲存"
  }
```

- [ ] **Step 2: 寫失敗測試 `apps/web/src/components/shared/ai-settings-dialog.spec.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/messages/en.json';
import { AI_SETTINGS_KEY } from '@/lib/ai/settings';
import { AiSettingsDialog } from './ai-settings-dialog';

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="en" messages={en as Record<string, unknown>}>
      <AiSettingsDialog />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('AiSettingsDialog', () => {
  it('opens from the trigger and saves settings to localStorage', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /ai settings/i }));
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://x/v1' } });
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-1' } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'm' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(AI_SETTINGS_KEY)!)).toEqual({
        baseUrl: 'http://x/v1',
        apiKey: 'sk-1',
        model: 'm',
      });
    });
  });

  it('test connection reports success via the client', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
      ),
    );
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /ai settings/i }));
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://x/v1' } });
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-1' } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'm' } });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(screen.getByText(/connection ok/i)).toBeTruthy());
  });

  it('test connection failure shows the error line', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })));
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /ai settings/i }));
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://x/v1' } });
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-1' } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'm' } });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/connection failed/i));
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- ai-settings-dialog`
Expected: FAIL。

- [ ] **Step 4: 實作 `apps/web/src/components/shared/ai-settings-dialog.tsx`**

```tsx
'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@rfjs/web-ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@rfjs/web-ui/components/dialog';
import { Input } from '@rfjs/web-ui/components/input';
import { Label } from '@rfjs/web-ui/components/label';

import { createAiClient } from '@/lib/ai/client';
import { loadAiSettings, saveAiSettings } from '@/lib/ai/settings';

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

export function AiSettingsDialog() {
  const t = useTranslations('AiSettings');
  const [open, setOpen] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [model, setModel] = React.useState('');
  const [test, setTest] = React.useState<TestState>('idle');
  const [saved, setSaved] = React.useState(false);

  // 開啟時載入既有設定。
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    setTest('idle');
    setSaved(false);
    if (next) {
      const s = loadAiSettings();
      setBaseUrl(s?.baseUrl ?? '');
      setApiKey(s?.apiKey ?? '');
      setModel(s?.model ?? '');
    }
  };

  const onTest = async () => {
    setTest('testing');
    try {
      await createAiClient({ baseUrl, apiKey, model }).complete({
        system: 'You are a connectivity check.',
        user: 'Reply with the single word: ok',
        timeoutMs: 15_000,
      });
      setTest('ok');
    } catch {
      setTest('fail');
    }
  };

  const onSave = () => {
    saveAiSettings({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() });
    setSaved(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('trigger')}>
          <Sparkles className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ai-base-url">{t('baseUrl')}</Label>
            <Input id="ai-base-url" value={baseUrl} placeholder={t('baseUrlPlaceholder')}
              onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ai-api-key">{t('apiKey')}</Label>
            <Input id="ai-api-key" type="password" value={apiKey}
              onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ai-model">{t('model')}</Label>
            <Input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          {test === 'ok' ? <p className="text-sm text-success">{t('testOk')}</p> : null}
          {test === 'fail' ? (
            <p role="alert" className="text-sm text-fault">{t('testFail')}</p>
          ) : null}
          {saved ? <p className="text-sm text-muted-foreground">{t('saved')}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onTest} disabled={test === 'testing'}>
            {t('test')}
          </Button>
          <Button size="sm" onClick={onSave}>{t('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

> `text-success` / `text-fault` 為 repo 既有 token(canonical-editor 用過 `text-fault`);若 `text-success` 不存在,改用 `text-emerald-600 dark:text-emerald-400`。

- [ ] **Step 5: header 接入** —— `apps/web/src/components/layout/app-header.tsx` import 並在 actions 區(`<LocaleSwitcher />` 之前)插入:

```tsx
import { AiSettingsDialog } from "../shared/ai-settings-dialog";
// actions 區:
<AiSettingsDialog />
```

(header 是 Server Component,插入 client 子元件是標準做法。)

- [ ] **Step 6: 跑測試 + build 確認**

Run: `pnpm -C <worktree> --filter web vitest:run -- ai-settings-dialog && pnpm -C <worktree> --filter web check-types && pnpm -C <worktree> --filter web build`
Expected: 測試 3 passed;build ✓(server header + client dialog 無 RSC 錯)。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/shared/ai-settings-dialog.tsx apps/web/src/components/layout/app-header.tsx \
  apps/web/src/messages/en.json apps/web/src/messages/zh-TW.json \
  apps/web/src/components/shared/ai-settings-dialog.spec.tsx
git commit -m "feat(web): add byok ai settings dialog with header entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: filter-builder 家族「NL→條件樹」(scaffold 一次,5 工具全拿)

**Files:**
- Create: `apps/web/src/tools/_filter-builder/ai-nl-filter.ts`(prompt 組裝,純函式)
- Create: `apps/web/src/tools/_filter-builder/ai-nl-row.tsx`(共用 AI 列元件)
- Modify: 5 個工具的 `ui.tsx`(`data-filter-builder`、`jsonb-query-builder`、`sql-filter-builder`、`mongo-query-builder`、`pg-filter-builder`;各插一行 `<AiNlRow …/>`,緊鄰其 `<CanonicalEditor …/>` 之上 —— 以 `grep -rn "<CanonicalEditor" apps/web/src/tools` 找確切位置。`es-query-builder` 若同樣渲染 CanonicalEditor 也一併接,以 grep 結果為準)
- Modify: `apps/web/src/messages/en.json` + `zh-TW.json`(**中央 `ToolUI`** 加 `ai*` 鍵)
- Test: `apps/web/src/tools/_filter-builder/ai-nl-filter.spec.ts` + `apps/web/src/tools/_filter-builder/ai-nl-row.spec.tsx`

**Interfaces:**
- Consumes: `useAiAssist`(Task 3)、`FilterBuilderState` 的 `schema` + `onCanonicalChange`(既有)、`parseFilterGroup`(`@rfjs/filter-builder`)
- Produces:
  - `buildNlFilterPrompt(nl: string, schema: FieldSchema[]): { system: string; user: string }`
  - `parseNlFilterResponse(raw: string): string` —— 驗證閘門:`JSON.parse` + `parseFilterGroup` 檢查,通過回傳 **pretty-printed JSON 字串**(交給 `onCanonicalChange` 套用),失敗 throw(訊息含原因)
  - `function AiNlRow({ schema, onApply }: { schema: FieldSchema[]; onApply: (canonicalJson: string) => void })`

- [ ] **Step 1: 中央 ToolUI 鍵**(en/zh-TW 的 `ToolUI` 物件各加;`ai*` 前綴不與任何 fragment 撞名):

en:
```json
      "aiNlPlaceholder": "Describe the filter in plain language…",
      "aiGenerate": "AI Generate",
      "aiCancel": "Cancel",
      "aiNotConfigured": "Set up an AI connection first (top-right ✨).",
```
zh-TW:
```json
      "aiNlPlaceholder": "用白話描述你要的過濾條件…",
      "aiGenerate": "AI 產生",
      "aiCancel": "取消",
      "aiNotConfigured": "請先設定 AI 連線(右上 ✨)。",
```

- [ ] **Step 2: 寫失敗測試 `ai-nl-filter.spec.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { buildNlFilterPrompt, parseNlFilterResponse } from './ai-nl-filter';

const SCHEMA = [
  { path: 'amount', dataType: 'numeric', include: true, kind: 'jsonb' },
  { path: 'dept', dataType: 'string', include: true, kind: 'jsonb' },
] as never;

describe('buildNlFilterPrompt', () => {
  it('embeds the field list and the user text', () => {
    const p = buildNlFilterPrompt('amount over 100', SCHEMA);
    expect(p.system).toContain('amount');
    expect(p.system).toContain('dept');
    expect(p.system).toContain('logic');
    expect(p.user).toBe('amount over 100');
  });
});

describe('parseNlFilterResponse (validation gate)', () => {
  it('accepts a valid filter group and returns pretty json', () => {
    const raw = JSON.stringify({ logic: 'and', filters: [{ field: 'amount', operator: 'gt', value: 100 }] });
    const out = parseNlFilterResponse(raw);
    expect(JSON.parse(out)).toMatchObject({ logic: 'and' });
    expect(out).toContain('\n'); // pretty-printed
  });

  it('rejects non-json and structurally invalid groups', () => {
    expect(() => parseNlFilterResponse('not json')).toThrow();
    expect(() => parseNlFilterResponse('{"nope":true}')).toThrow();
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- ai-nl-filter`
Expected: FAIL。

- [ ] **Step 4: 實作 `ai-nl-filter.ts`**

```ts
import { parseFilterGroup, type FieldSchema } from '@rfjs/filter-builder';

/** NL→條件樹的 prompt。輸出目標是 canonical FilterGroup JSON(不含 id 的簡單形狀)。 */
export function buildNlFilterPrompt(nl: string, schema: FieldSchema[]): { system: string; user: string } {
  const fields = schema
    .map((f) => `- ${f.path} (${f.dataType}${f.elementType ? `<${f.elementType}>` : ''})`)
    .join('\n');
  const system = [
    'You convert a natural-language description into a canonical filter group as JSON.',
    'Output ONLY a JSON object of shape: {"logic":"and|or|nor|not","filters":[<condition|group>...]}.',
    'A condition is {"field":"<path>","operator":"<op>","value":<value>}. Groups nest recursively.',
    'Common operators: eq, ne, gt, gte, lt, lte, in, nin, like, exists, elemmatch.',
    'Use ONLY these fields:',
    fields,
    'Example: {"logic":"and","filters":[{"field":"amount","operator":"gt","value":100},' +
      '{"logic":"or","filters":[{"field":"dept","operator":"eq","value":"Engineering"},' +
      '{"field":"dept","operator":"eq","value":"Product"}]}]}',
  ].join('\n');
  return { system, user: nl };
}

/** 驗證閘門:非 JSON / 非合法 filter group 一律 throw;通過回傳 pretty JSON(交給 onCanonicalChange)。 */
export function parseNlFilterResponse(raw: string): string {
  const parsed: unknown = JSON.parse(raw); // SyntaxError 自然上拋
  const text = JSON.stringify(parsed, null, 2);
  const r = parseFilterGroup(text);
  if (!r.ok) throw new Error(`invalid filter group: ${r.error.message}`);
  return text;
}
```

> `parseFilterGroup` 的簽名以實際為準(worktree 內 `packages/filter-builder/src/reverse.ts:49`);若它吃 object 而非字串,對應調整(測試意圖不變:合法通過、非法 throw)。`ReverseError` 的欄位名(`message`)也以實際型別為準。

- [ ] **Step 5: 寫失敗測試 `ai-nl-row.spec.tsx`**(mock `useAiAssist`)

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import en from '@/messages/en.json';

const mockRun = vi.fn();
vi.mock('@/lib/ai/use-ai-assist', () => ({
  useAiAssist: () => ({ ready: true, loading: false, error: null, cancel: vi.fn(), run: mockRun }),
}));

import { AiNlRow } from './ai-nl-row';

function renderRow(onApply = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en as Record<string, unknown>}>
      <AiNlRow schema={[]} onApply={onApply} />
    </NextIntlClientProvider>,
  );
  return onApply;
}

describe('AiNlRow', () => {
  it('runs the assist and applies the returned canonical json', async () => {
    mockRun.mockResolvedValue('{\n  "logic": "and",\n  "filters": []\n}');
    const onApply = renderRow();
    fireEvent.change(screen.getByPlaceholderText(/describe the filter/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /ai generate/i }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(expect.stringContaining('"logic"')));
  });

  it('does not apply when the run returns null (error path)', async () => {
    mockRun.mockResolvedValue(null);
    const onApply = renderRow();
    fireEvent.change(screen.getByPlaceholderText(/describe the filter/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /ai generate/i }));
    await waitFor(() => expect(mockRun).toHaveBeenCalled());
    expect(onApply).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: 實作 `ai-nl-row.tsx`**

```tsx
'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@rfjs/web-ui/components/button';
import { Input } from '@rfjs/web-ui/components/input';
import type { FieldSchema } from '@rfjs/filter-builder';

import { useAiAssist } from '@/lib/ai/use-ai-assist';
import { buildNlFilterPrompt, parseNlFilterResponse } from './ai-nl-filter';

export function AiNlRow({ schema, onApply }: { schema: FieldSchema[]; onApply: (canonicalJson: string) => void }) {
  const t = useTranslations('ToolUI');
  const ai = useAiAssist();
  const [nl, setNl] = React.useState('');

  const onGenerate = async () => {
    if (!nl.trim()) return;
    const prompt = buildNlFilterPrompt(nl, schema);
    const out = await ai.run({ ...prompt, json: true }, parseNlFilterResponse);
    if (out !== null) onApply(out);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={nl}
          placeholder={t('aiNlPlaceholder')}
          onChange={(e) => setNl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onGenerate();
          }}
        />
        {ai.loading ? (
          <Button size="sm" variant="outline" onClick={ai.cancel}>{t('aiCancel')}</Button>
        ) : (
          <Button size="sm" onClick={() => void onGenerate()} disabled={!ai.ready}>
            {t('aiGenerate')}
          </Button>
        )}
      </div>
      {!ai.ready ? <p className="text-xs text-muted-foreground">{t('aiNotConfigured')}</p> : null}
      {ai.error ? (
        <p role="alert" className="text-xs text-fault">
          [{ai.error.kind}] {ai.error.message}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 7: 接進 5(或 6)個工具** —— `grep -rn "<CanonicalEditor" apps/web/src/tools` 找出所有渲染點;在每個 `<CanonicalEditor` 的**正上方**插入:

```tsx
<AiNlRow schema={fb.schema} onApply={fb.onCanonicalChange} />
```

(各檔 `fb` 為該工具的 `useFilterBuilder()` 回傳變數,以實際變數名為準;import `{ AiNlRow } from "../_filter-builder"`,若 barrel 未匯出則在 `_filter-builder/index.ts` 加一行 export。)套用路徑=`onCanonicalChange`:與使用者手貼 canonical JSON **完全同一條**驗證/套用/錯誤呈現路徑(300ms debounce 後 parse→setTree+mergeFields;失敗顯示 ReverseError)。

- [ ] **Step 8: 全部測試 + 確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run && pnpm -C <worktree> --filter web check-types && pnpm -C <worktree> --filter web lint`
Expected: 全綠(含 `tools/index.spec.ts` 的 ToolUI 撞名檢查 —— `ai*` 在中央,fragment 不得再定義同名鍵)。

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/tools/_filter-builder apps/web/src/messages/en.json apps/web/src/messages/zh-TW.json \
  apps/web/src/tools/data-filter-builder/ui.tsx apps/web/src/tools/jsonb-query-builder/ui.tsx \
  apps/web/src/tools/sql-filter-builder/ui.tsx apps/web/src/tools/mongo-query-builder/ui.tsx \
  apps/web/src/tools/pg-filter-builder/ui.tsx apps/web/src/tools/es-query-builder/ui.tsx
git commit -m "feat(web): nl-to-filter-tree ai assist across the filter-builder tools

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(若 es-query-builder 未渲染 CanonicalEditor 則不列入 add。)

---

## Task 6: decision-table「AI 表格檢查」

**Files:**
- Create: `apps/web/src/tools/decision-table/ai-check.ts`
- Modify: `apps/web/src/tools/decision-table/ui.tsx`(Rules 表頭工具列加「AI 檢查」鈕 + findings 面板)
- Modify: `apps/web/src/tools/decision-table/messages.ts`(`dtAi*` 鍵,en+zh-TW)
- Test: `apps/web/src/tools/decision-table/ai-check.spec.ts`

**Interfaces:**
- Consumes: `useAiAssist`(Task 3)、`tableToJson`(`@rfjs/decision-table`)、zod
- Produces:
  - `interface AiFinding { kind: 'gap' | 'overlap' | 'unreachable' | 'note'; ruleIds: string[]; message: string }`
  - `buildCheckPrompt(tableJson: string, locale: string): { system: string; user: string }`
  - `parseCheckResponse(raw: string, validRuleIds: string[]): AiFinding[]` —— zod 驗證 + **ruleIds 過濾掉不存在的 id(防幻覺)**;非法 throw

- [ ] **Step 1: 寫失敗測試 `ai-check.spec.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { buildCheckPrompt, parseCheckResponse } from './ai-check';

describe('buildCheckPrompt', () => {
  it('embeds the table json and the locale instruction', () => {
    const p = buildCheckPrompt('{"version":1}', 'zh-TW');
    expect(p.user).toContain('{"version":1}');
    expect(p.system).toContain('zh-TW');
    expect(p.system).toContain('gap');
  });
});

describe('parseCheckResponse (gate + hallucination filter)', () => {
  const VALID = ['r1', 'r2'];

  it('accepts a valid findings payload and filters unknown rule ids', () => {
    const raw = JSON.stringify({
      findings: [
        { kind: 'overlap', ruleIds: ['r1', 'ghost'], message: 'r1 overlaps' },
        { kind: 'note', ruleIds: [], message: 'looks fine' },
      ],
    });
    const out = parseCheckResponse(raw, VALID);
    expect(out).toHaveLength(2);
    expect(out[0]!.ruleIds).toEqual(['r1']); // ghost 被濾掉
  });

  it('rejects non-json and wrong shapes', () => {
    expect(() => parseCheckResponse('nope', VALID)).toThrow();
    expect(() => parseCheckResponse('{"findings":[{"kind":"bogus","ruleIds":[],"message":"x"}]}', VALID)).toThrow();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- decision-table/ai-check`
Expected: FAIL。

- [ ] **Step 3: 實作 `ai-check.ts`**

```ts
import { z } from 'zod';

const findingSchema = z.object({
  kind: z.enum(['gap', 'overlap', 'unreachable', 'note']),
  ruleIds: z.array(z.string()),
  message: z.string().min(1),
});
const responseSchema = z.object({ findings: z.array(findingSchema) });

export type AiFinding = z.infer<typeof findingSchema>;

export function buildCheckPrompt(tableJson: string, locale: string): { system: string; user: string } {
  const system = [
    'You review a decision table (rules evaluated top-down; conditions are nested filter trees).',
    'Report findings as JSON ONLY: {"findings":[{"kind":"gap|overlap|unreachable|note","ruleIds":["<id>"],"message":"..."}]}.',
    'kinds: gap = input regions no rule covers; overlap = rules that can match the same input;',
    'unreachable = a rule an earlier rule always shadows; note = anything else worth knowing.',
    `Write every message in the "${locale}" language. Reference rules by their id.`,
  ].join('\n');
  return { system, user: tableJson };
}

/** 驗證閘門 + 幻覺過濾:未知 ruleId 移除(finding 本身保留)。 */
export function parseCheckResponse(raw: string, validRuleIds: string[]): AiFinding[] {
  const parsed = responseSchema.parse(JSON.parse(raw));
  const valid = new Set(validRuleIds);
  return parsed.findings.map((f) => ({ ...f, ruleIds: f.ruleIds.filter((id) => valid.has(id)) }));
}
```

- [ ] **Step 4: messages.ts 加鍵**(en/zh-TW 的 ToolUI 各加):

en:`dtAiCheck: "AI Check"`、`dtAiChecking: "Checking…"`、`dtAiFindings: "AI findings"`、`dtAiNoFindings: "No findings — the table looks consistent."`、`dtAiDisclaimer: "AI suggestions — not an engine verdict."`、`dtAiNotConfigured: "Set up an AI connection first (top-right ✨)."`
zh-TW:`dtAiCheck: "AI 檢查"`、`dtAiChecking: "檢查中…"`、`dtAiFindings: "AI 檢查結果"`、`dtAiNoFindings: "沒有發現問題 —— 表格看起來一致。"`、`dtAiDisclaimer: "AI 建議,非引擎判定。"`、`dtAiNotConfigured: "請先設定 AI 連線(右上 ✨)。"`

- [ ] **Step 5: ui.tsx 接線** —— Rules 表頭(hit policy Select 旁)加按鈕與狀態:

```tsx
// imports 增加:
import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { buildCheckPrompt, parseCheckResponse, type AiFinding } from "./ai-check";
import { useLocale } from "next-intl";

// 元件內:
const ai = useAiAssist();
const locale = useLocale();
const [findings, setFindings] = React.useState<AiFinding[] | null>(null);

const onAiCheck = async () => {
  const prompt = buildCheckPrompt(tableToJson(table), locale);
  const out = await ai.run({ ...prompt, json: true }, (raw) =>
    parseCheckResponse(raw, table.rules.map((r) => r.id)),
  );
  if (out !== null) setFindings(out);
};

// Rules header 按鈕(+ Rule 旁):
<Button size="sm" variant="outline" onClick={() => void onAiCheck()} disabled={!ai.ready || ai.loading}>
  {ai.loading ? t("dtAiChecking") : t("dtAiCheck")}
</Button>

// Rules 區塊下方 findings 面板:
{ai.error ? <p role="alert" className="px-3 py-2 text-xs text-fault">[{ai.error.kind}] {ai.error.message}</p> : null}
{findings !== null ? (
  <div data-testid="dt-ai-findings" className="border-t px-3 py-2 text-sm">
    <p className="mb-1 text-xs font-semibold text-muted-foreground">
      {t("dtAiFindings")} · {t("dtAiDisclaimer")}
    </p>
    {findings.length === 0 ? (
      <p className="text-xs text-muted-foreground">{t("dtAiNoFindings")}</p>
    ) : (
      <ul className="space-y-1 text-xs">
        {findings.map((f, i) => (
          <li key={i}>
            <span className="font-mono">[{f.kind}]</span>{" "}
            {f.ruleIds.length > 0 ? <span className="font-mono">({f.ruleIds.join(", ")})</span> : null}{" "}
            {f.message}
          </li>
        ))}
      </ul>
    )}
  </div>
) : null}
```

(確切插入點以現檔結構為準:按鈕進 Rules header 的按鈕群、面板放 `</ul>` 之後 Rules 卡片內。`!ai.ready` 時按鈕 disabled 並在旁顯示 `dtAiNotConfigured` 小字。)

- [ ] **Step 6: 全綠 + Commit**

Run: `pnpm -C <worktree> --filter web vitest:run -- decision-table && pnpm -C <worktree> --filter web check-types`
Expected: 既有 decision-table 測試 + ai-check 4 全綠。

```bash
git add apps/web/src/tools/decision-table/ai-check.ts apps/web/src/tools/decision-table/ai-check.spec.ts \
  apps/web/src/tools/decision-table/ui.tsx apps/web/src/tools/decision-table/messages.ts
git commit -m "feat(web): ai table check for the decision-table tool

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: form-builder「NL→FormConfig」

**Files:**
- Create: `apps/web/src/tools/form-builder/ai-nl-form.ts`
- Modify: `apps/web/src/tools/form-builder/ui.tsx`(工具列/畫布上方加 AI 輸入列)
- Modify: `apps/web/src/tools/form-builder/messages.ts`(`fbAi*` 鍵,en+zh-TW)
- Test: `apps/web/src/tools/form-builder/ai-nl-form.spec.ts`

**Interfaces:**
- Consumes: `useAiAssist`(Task 3)、既有 `jsonToCards`(`./model`,內含 `parseFormConfig` 驗證)
- Produces:
  - `buildNlFormPrompt(nl: string): { system: string; user: string }`
  - `parseNlFormResponse(raw: string): string` —— `JSON.parse` + **`jsonToCards(text)` 試轉**(驗證閘門;throw 即拒絕),通過回傳 pretty JSON 字串(呼叫端再以既有匯入路徑套用)

- [ ] **Step 1: 寫失敗測試 `ai-nl-form.spec.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { buildNlFormPrompt, parseNlFormResponse } from './ai-nl-form';

describe('buildNlFormPrompt', () => {
  it('describes the formconfig shape and component whitelist', () => {
    const p = buildNlFormPrompt('a leave request form');
    expect(p.system).toContain('"version"');
    expect(p.system).toContain('Input');
    expect(p.user).toBe('a leave request form');
  });
});

describe('parseNlFormResponse (gate = jsonToCards/parseFormConfig)', () => {
  it('accepts a minimal valid formconfig', () => {
    const raw = JSON.stringify({
      version: 1,
      fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }],
    });
    const out = parseNlFormResponse(raw);
    expect(JSON.parse(out).version).toBe(1);
  });

  it('rejects non-json and invalid configs', () => {
    expect(() => parseNlFormResponse('nope')).toThrow();
    expect(() => parseNlFormResponse('{"version":99,"fields":"x"}')).toThrow();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- ai-nl-form`
Expected: FAIL。

- [ ] **Step 3: 實作 `ai-nl-form.ts`**

```ts
import { jsonToCards } from './model';

/** NL→FormConfig。輸出 v1 簡化形狀(fields[]),交給既有 jsonToCards 匯入。 */
export function buildNlFormPrompt(nl: string): { system: string; user: string } {
  const system = [
    'You design a form config as JSON ONLY, shape:',
    '{"version":1,"fields":[{"key":"<snake_or_camel>","label":"<label>","component":"<Component>","dataType":"<type>","required":<bool>?}]}',
    'Allowed component/dataType pairs: Input/string, Textarea/string, Number/numeric, Email/string,',
    'Switch/boolean, Checkbox/boolean, Radio/string, Select/string, DatePicker/date.',
    'Radio/Select need "options":[{"label":"...","value":"..."}].',
    'Keep it minimal and practical. Output the JSON object only.',
  ].join('\n');
  return { system, user: nl };
}

/** 驗證閘門:jsonToCards(內含 parseFormConfig)試轉,失敗 throw。 */
export function parseNlFormResponse(raw: string): string {
  const text = JSON.stringify(JSON.parse(raw), null, 2);
  jsonToCards(text); // throws on invalid
  return text;
}
```

> component/dataType 白名單以 `@rfjs/form-builder` 實際 schema 為準(實作時對照 `config-schema.ts`;測試的最小 config 若被既有 schema 拒絕,調整白名單與測試資料,守住「合法通過/非法 throw」意圖)。

- [ ] **Step 4: messages.ts 加鍵**(ToolUI,en/zh-TW):

en:`fbAiPlaceholder: "Describe the form you want…"`、`fbAiGenerate: "AI Generate"`、`fbAiCancel: "Cancel"`、`fbAiNotConfigured: "Set up an AI connection first (top-right ✨)."`
zh-TW:`fbAiPlaceholder: "用白話描述你要的表單…"`、`fbAiGenerate: "AI 產生"`、`fbAiCancel: "取消"`、`fbAiNotConfigured: "請先設定 AI 連線(右上 ✨)。"`

- [ ] **Step 5: ui.tsx 接線** —— 在畫布/分頁區上方(以現檔頂部工具列位置為準)加 AI 輸入列;套用 = 既有 JSON 匯入路徑(找到現檔處理 `jsonToCards` 匯入的 handler,呼叫同一 setter 把 groups/cards 換成 AI 產物):

```tsx
// imports:
import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { buildNlFormPrompt, parseNlFormResponse } from "./ai-nl-form";
import { Sparkles } from "lucide-react"; // 若已有則沿用

// 元件內:
const ai = useAiAssist();
const [aiNl, setAiNl] = React.useState("");
const onAiGenerate = async () => {
  if (!aiNl.trim()) return;
  const out = await ai.run({ ...buildNlFormPrompt(aiNl), json: true }, parseNlFormResponse);
  if (out !== null) {
    const { groups: g, cards: c } = jsonToCards(out);
    // 以現檔既有的 state setters 套用(與 JSON 匯入 handler 同款呼叫,以現檔為準):
    setGroups(g);
    setCards(c);
  }
};

// JSX(工具列下、畫布上):
<div className="flex items-center gap-2">
  <Sparkles className="size-4 shrink-0 text-muted-foreground" />
  <input value={aiNl} placeholder={t("fbAiPlaceholder")} onChange={(e) => setAiNl(e.target.value)}
    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
  {ai.loading ? (
    <Button size="sm" variant="outline" onClick={ai.cancel}>{t("fbAiCancel")}</Button>
  ) : (
    <Button size="sm" onClick={() => void onAiGenerate()} disabled={!ai.ready}>{t("fbAiGenerate")}</Button>
  )}
</div>
{!ai.ready ? <p className="text-xs text-muted-foreground">{t("fbAiNotConfigured")}</p> : null}
{ai.error ? <p role="alert" className="text-xs text-fault">[{ai.error.kind}] {ai.error.message}</p> : null}
```

(form-builder ui.tsx 的實際 state setter 名稱(groups/cards)與 `t` 的命名空間以現檔為準;若該檔未用 `useTranslations("ToolUI")` 則補。)

- [ ] **Step 6: 全綠 + Commit**

Run: `pnpm -C <worktree> --filter web vitest:run -- form-builder && pnpm -C <worktree> --filter web check-types && pnpm -C <worktree> --filter web lint`
Expected: 既有 form-builder 測試不破 + ai-nl-form 3 全綠。

```bash
git add apps/web/src/tools/form-builder/ai-nl-form.ts apps/web/src/tools/form-builder/ai-nl-form.spec.ts \
  apps/web/src/tools/form-builder/ui.tsx apps/web/src/tools/form-builder/messages.ts
git commit -m "feat(web): nl-to-formconfig ai assist for the form-builder tool

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: e2e + 終審驗證

**Files:**
- Create: `apps/web/e2e/ai-settings.e2e.ts`

- [ ] **Step 1: 建 `apps/web/e2e/ai-settings.e2e.ts`**(不打真 AI)

```ts
import { test, expect } from "@playwright/test";

test("header sparkles opens the ai settings dialog", async ({ page }) => {
  await page.goto("/en/tools/decision-table");
  await page.getByRole("button", { name: /ai settings/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel(/base url/i)).toBeVisible();
});

test("unconfigured ai leaves assist buttons disabled with guidance", async ({ page }) => {
  await page.goto("/en/tools/decision-table");
  const check = page.getByRole("button", { name: /ai check/i });
  await expect(check).toBeVisible({ timeout: 15_000 });
  await expect(check).toBeDisabled();
});
```

- [ ] **Step 2: 終審驗證(全 gate)**

Run:
```bash
pnpm -C <worktree> --filter @rfjs/web-ui test
pnpm -C <worktree> --filter @rfjs/web-ui lint
pnpm -C <worktree> --filter web check-types
pnpm -C <worktree> --filter web lint
pnpm -C <worktree> --filter web vitest:run
pnpm -C <worktree> --filter web build
pnpm -C <worktree> --filter workbench build
```
Expected: 全綠(workbench build 也要 —— web-ui 是兩個 app 共用,新 Dialog 不得破壞 workbench;這是上次 CI 事故的教訓)。

- [ ] **Step 3: e2e(production server,勿用 next dev)**

```bash
cd <worktree>/apps/web && pnpm exec next start --port 3002 &   # 結束後停掉
pnpm -C <worktree> --filter web test:e2e
```
Expected: 全部通過(新 2 條 + 既有)。

- [ ] **Step 4: 手動截圖驗證(light + dark)**

production server 上檢查:header ✨ → dialog(填寫/測試連線 UI)、filter 工具的 AI 列(未設定引導)、decision-table 的 AI 檢查鈕、form-builder 的 AI 列;dark 模式可讀。若本機有 litellm 端點,實測一條 NL→樹(非必要條件)。截圖留存。

- [ ] **Step 5: Commit + 收尾**

```bash
git add apps/web/e2e/ai-settings.e2e.ts
git commit -m "test(web): e2e smoke for ai settings dialog and unconfigured guidance

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
**HOLD:** 不開 PR;報告 + 截圖摘要,等指示。

---

## 附錄:Spec ↔ Plan 對應(self-review)

| Spec 需求 | 對應 Task |
| --- | --- |
| web-ui Dialog(radix 統一套件、零新依賴)+ changeset(private 也要) | Task 1 |
| lib/ai seam(types/settings/client,套件形狀)+ 具名錯誤 + 逾時/取消 + json mode | Task 2 |
| useAiAssist(run/parse 閘門、cancel 不設錯、config gating) | Task 3 |
| 全站設定 dialog + header ✨ + AiSettings i18n + 測試連線 + 資料外送明示 | Task 4 |
| NL→條件樹(scaffold 一次 ×5-6 工具;套用走 onCanonicalChange 同路徑) | Task 5 |
| decision-table AI 檢查(findings zod + 幻覺 id 過濾 + 免責標註 + locale 指示) | Task 6 |
| NL→FormConfig(jsonToCards/parseFormConfig 閘門、既有匯入路徑套用) | Task 7 |
| e2e(不打真 AI)+ web/workbench build + 截圖 + HOLD | Task 8 |
| 鐵律(輸出不直接落地)/ 引擎套件零改動 / stream 預留不實作 | 全程 |
