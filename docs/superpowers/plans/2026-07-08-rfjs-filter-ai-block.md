# Filter 家族 AI 助理區塊(Wave 1)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 6 個 filter 工具的 AI 從 `{ }` 分頁搬進 FILTER LOGIC 面板,升級為「產生 / 提問 / 解釋」三動作的 `AiAssistBlock`,回答堆疊存 localStorage(`AiLogStore` 接口)。

**Architecture:** seam 層新增 `lib/ai/log.ts`(持久化接口)與 scaffold 層 `ai-explain.ts`(解釋/問答 prompt);`AiAssistBlock` 取代 `AiNlRow`(刪除),經 `_filter-builder` scaffold 接進 6 個工具的 FILTER LOGIC 區塊;`QueryOutputPanel` / `DataPanel` 的 `aiRow` slot 移除。產生路徑的驗證閘門(`parseNlFilterResponse` → `onCanonicalChange`)完全不變;解釋/問答為 display-only 純文字。

**Tech Stack:** Next.js 15(apps/web)、next-intl、vitest + @testing-library/react、Playwright e2e、既有 `useAiAssist` hook。

**Spec:** `docs/superpowers/specs/2026-07-08-rfjs-filter-ai-block-design.md`
**Mockup(視覺定稿,實作須對齊)**:`docs/superpowers/specs/2026-07-08-rfjs-filter-ai-block-mockup.html`

## Global Constraints

- 只動 `apps/web`;`packages/*` 零改動 → 不需 changeset(若意外動到 packages/* 必附 changeset,private 也要)。
- 「產生」走既有閘門:`parseNlFilterResponse`(驗證失敗 throw)→ 成功才 `onApply`(= `fb.onCanonicalChange`)。解釋/問答 display-only:純文字 `whitespace-pre-wrap` 呈現,**不 render HTML/Markdown**,不碰任何 tree/schema 狀態。
- i18n:新鍵全進**中央 ToolUI**(`apps/web/src/messages/{en,zh-TW}.json`),en 與 zh-TW 鍵集合一致;`tools/index.spec.ts` 的中央/fragment 不衝突檢查必須綠。移除 `aiNlPlaceholder`(兩語系同步刪)。
- React hook 模組第一行必須 `"use client"`。
- 錯誤呈現慣例:`role="alert"` + `[{kind}] {message}`;`parse` 且有 `detail` 時附 `<details><summary>{aiViewRaw}</summary><pre>…</pre></details>`。abort 不顯示為錯誤(hook 既有行為)。
- 持久化:`AI_LOG_LIMIT = 50`;localStorage key 慣例 `rfjs.ai.log.<toolId>`;損毀 JSON / SSR → 空陣列。
- commit 英文 conventional,subject 全小寫開頭,trailer 前空行,最後一行恰為 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 測試指令:`pnpm --filter web vitest:run`(單檔:`pnpm --filter web vitest run <path>`);type:`pnpm --filter web check-types`;lint:`pnpm --filter web lint`。
- e2e 一律打 production server(`next build` + `next start --port 3002`),**絕不** `next dev`(inotify 限制)。殘留 server:`PID=$(ss -ltnp | grep 3002 | grep -oP 'pid=\K[0-9]+')` 後 `kill -9 $PID`。

---

### Task 1: `lib/ai/log.ts` — AiLogStore 持久化接口

**Files:**
- Create: `apps/web/src/lib/ai/log.ts`
- Test: `apps/web/src/lib/ai/log.spec.ts`

**Interfaces:**
- Consumes: 無(獨立模組;瀏覽器 localStorage)。
- Produces(Task 3 依賴,簽名精確如下):
  ```ts
  export interface AiAssistEntry {
    id: string;
    kind: 'generate' | 'ask' | 'explain';
    prompt?: string;
    answer?: string;
    appliedJson?: string;
    at: string; // ISO 時間戳
  }
  export const AI_LOG_LIMIT = 50;
  export interface AiLogStore {
    list(): AiAssistEntry[];
    append(entry: AiAssistEntry): AiAssistEntry[];
    clear(): void;
  }
  export function createAiLog(storageKey: string): AiLogStore;
  ```

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/lib/ai/log.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_LOG_LIMIT, createAiLog, type AiAssistEntry } from './log';

const KEY = 'rfjs.ai.log.test-tool';

function entry(n: number): AiAssistEntry {
  return { id: `id-${n}`, kind: 'ask', prompt: `q${n}`, answer: `a${n}`, at: `2026-07-08T00:00:${String(n % 60).padStart(2, '0')}.000Z` };
}

beforeEach(() => localStorage.clear());

describe('createAiLog', () => {
  it('list/append/clear 往返(chronological,append 回傳新列表)', () => {
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

  it(`超過 AI_LOG_LIMIT(${AI_LOG_LIMIT})裁掉最舊`, () => {
    const log = createAiLog(KEY);
    for (let i = 0; i < AI_LOG_LIMIT + 3; i++) log.append(entry(i));
    const list = log.list();
    expect(list).toHaveLength(AI_LOG_LIMIT);
    expect(list[0].id).toBe('id-3'); // 0,1,2 被裁
  });

  it('損毀 JSON → 空陣列;非陣列 → 空陣列', () => {
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

  it('過濾形狀不合法的項目(缺 id / kind 非法)', () => {
    localStorage.setItem(KEY, JSON.stringify([entry(1), { kind: 'ask' }, { id: 'x', kind: 'nope' }]));
    expect(createAiLog(KEY).list().map((e) => e.id)).toEqual(['id-1']);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm --filter web vitest run src/lib/ai/log.spec.ts`
Expected: FAIL(`./log` 不存在)。

- [ ] **Step 3: 實作**

`apps/web/src/lib/ai/log.ts`:

```ts
/** AI 互動紀錄的持久化接口 —— Wave 2 重新套用 / Wave 3 聊天歷史共用;後端可換。 */
export interface AiAssistEntry {
  id: string;
  kind: 'generate' | 'ask' | 'explain';
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

const KINDS = new Set(['generate', 'ask', 'explain']);

function isEntry(v: unknown): v is AiAssistEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Partial<AiAssistEntry>;
  return typeof e.id === 'string' && typeof e.kind === 'string' && KINDS.has(e.kind) && typeof e.at === 'string';
}

export function createAiLog(storageKey: string): AiLogStore {
  const list = (): AiAssistEntry[] => {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    try {
      const v: unknown = JSON.parse(raw);
      return Array.isArray(v) ? v.filter(isEntry) : [];
    } catch {
      return [];
    }
  };
  return {
    list,
    append(entry) {
      const next = [...list(), entry].slice(-AI_LOG_LIMIT);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    },
    clear() {
      if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
    },
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm --filter web vitest run src/lib/ai/log.spec.ts`
Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ai/log.ts apps/web/src/lib/ai/log.spec.ts
git commit -m "feat(web): add ai log store interface with localstorage backend"
```
(trailer 依 Global Constraints。)

---

### Task 2: `ai-explain.ts` — 解釋/問答 prompt 組裝

**Files:**
- Create: `apps/web/src/tools/_filter-builder/ai-explain.ts`
- Test: `apps/web/src/tools/_filter-builder/ai-explain.spec.ts`

**Interfaces:**
- Consumes:`FieldSchema`(`@rfjs/filter-builder`,形狀 `{ path, dataType, elementType? }`)。
- Produces(Task 3 依賴):
  ```ts
  export interface ExplainContext {
    canonicalJson: string;
    schema: FieldSchema[];
    compiled: string | null;
    engineId: string;
    locale: string;
  }
  export function buildExplainPrompt(ctx: ExplainContext): { system: string; user: string };
  export function buildAskPrompt(ctx: ExplainContext, question: string): { system: string; user: string };
  ```

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/_filter-builder/ai-explain.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { FieldSchema } from '@rfjs/filter-builder';

import { buildAskPrompt, buildExplainPrompt, type ExplainContext } from './ai-explain';

const SCHEMA: FieldSchema[] = [
  { path: 'age', dataType: 'numeric', kind: 'jsonb' },
  { path: 'active', dataType: 'boolean', kind: 'jsonb' },
];

const CTX: ExplainContext = {
  canonicalJson: '{"logic":"and","filters":[{"field":"age","dataType":"numeric","operator":"gt","value":30}]}',
  schema: SCHEMA,
  compiled: 'WHERE age > $1',
  engineId: 'pg-filter',
  locale: 'zh-TW',
};

describe('buildExplainPrompt', () => {
  it('system 含引擎、欄位清單、canonical、compiled、locale、純文字指示', () => {
    const p = buildExplainPrompt(CTX);
    expect(p.system).toContain('pg-filter');
    expect(p.system).toContain('age (numeric)');
    expect(p.system).toContain(CTX.canonicalJson);
    expect(p.system).toContain('WHERE age > $1');
    expect(p.system).toContain('zh-TW');
    expect(p.system.toLowerCase()).toContain('plain text');
    expect(p.user).toMatch(/explain/i);
  });

  it('compiled 為 null 時標示 (none)', () => {
    const p = buildExplainPrompt({ ...CTX, compiled: null });
    expect(p.system).toContain('(none)');
  });
});

describe('buildAskPrompt', () => {
  it('user 為問題原文,system 同 context', () => {
    const p = buildAskPrompt(CTX, '能挑出 30 歲以上的活躍使用者嗎?');
    expect(p.user).toBe('能挑出 30 歲以上的活躍使用者嗎?');
    expect(p.system).toContain(CTX.canonicalJson);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm --filter web vitest run src/tools/_filter-builder/ai-explain.spec.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作**

`apps/web/src/tools/_filter-builder/ai-explain.ts`:

```ts
import type { FieldSchema } from "@rfjs/filter-builder";

export interface ExplainContext {
  canonicalJson: string;
  schema: FieldSchema[];
  compiled: string | null;
  engineId: string;
  locale: string;
}

/** 解釋/問答共用的 system context(display-only,回覆純文字,不需 JSON 模式)。 */
function buildSystem(ctx: ExplainContext): string {
  const fields = ctx.schema
    .map((f) => `- ${f.path} (${f.dataType}${f.elementType ? `<${f.elementType}>` : ""})`)
    .join("\n");
  return [
    `You are an assistant for a ${ctx.engineId} filter builder.`,
    "The user's field definitions:",
    fields,
    "Current filter tree (canonical JSON):",
    ctx.canonicalJson,
    `Compiled output: ${ctx.compiled ?? "(none)"}`,
    `Answer in the "${ctx.locale}" language, in plain text (no Markdown), concisely.`,
  ].join("\n");
}

export function buildExplainPrompt(ctx: ExplainContext): { system: string; user: string } {
  return {
    system: buildSystem(ctx),
    user: "Explain what data this filter selects. If the tree is empty, say there are no conditions yet.",
  };
}

export function buildAskPrompt(ctx: ExplainContext, question: string): { system: string; user: string } {
  return { system: buildSystem(ctx), user: question };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm --filter web vitest run src/tools/_filter-builder/ai-explain.spec.ts`
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/_filter-builder/ai-explain.ts apps/web/src/tools/_filter-builder/ai-explain.spec.ts
git commit -m "feat(web): add explain and ask prompt builders for filter tools"
```

---

### Task 3: `AiAssistBlock` 元件 + 中央 i18n(取代 AiNlRow)

**Files:**
- Create: `apps/web/src/tools/_filter-builder/ai-assist-block.tsx`
- Create: `apps/web/src/tools/_filter-builder/ai-assist-block.spec.tsx`
- Delete: `apps/web/src/tools/_filter-builder/ai-nl-row.tsx`、`apps/web/src/tools/_filter-builder/ai-nl-row.spec.tsx`
- Modify: `apps/web/src/tools/_filter-builder/index.ts`(barrel:`AiNlRow` → `AiAssistBlock`)
- Modify: `apps/web/src/messages/en.json`、`apps/web/src/messages/zh-TW.json`(中央 ToolUI)

**Interfaces:**
- Consumes:Task 1 的 `createAiLog`/`AiAssistEntry`;Task 2 的 `buildExplainPrompt`/`buildAskPrompt`;既有 `useAiAssist`(`{ ready, loading, error, cancel, run }`,`run<T>(req, parse) → Promise<T|null>`)、`buildNlFilterPrompt`/`parseNlFilterResponse`(不動)。
- Produces(Task 4 依賴):
  ```tsx
  export function AiAssistBlock(props: {
    schema: FieldSchema[];
    canonicalJson: string;
    compiled: string | null;
    engineId: string;
    onApply: (canonicalJson: string) => void;
    logKey: string;
  }): JSX.Element;
  ```

- [ ] **Step 1: 更新中央 i18n(兩語系,鍵集合一致)**

`apps/web/src/messages/en.json` 的 ToolUI:**刪除** `aiNlPlaceholder`,**新增**(放在 `aiGenerate` 前後皆可,兩檔案順序一致):

```json
"aiBlockPlaceholder": "Describe a filter or ask a question…",
"aiAsk": "Ask",
"aiExplain": "Explain current filter",
"aiAnswers": "AI answers",
"aiAdvisory": "AI suggestions, not engine verdicts",
"aiApplied": "Applied ({count} conditions)",
"aiClear": "Clear",
"aiKindGenerate": "Generate",
"aiKindAsk": "Ask",
"aiKindExplain": "Explain"
```

`apps/web/src/messages/zh-TW.json` 對應:

```json
"aiBlockPlaceholder": "描述條件或提出問題…",
"aiAsk": "提問",
"aiExplain": "解釋目前條件",
"aiAnswers": "AI 回答",
"aiAdvisory": "AI 建議,非引擎判定",
"aiApplied": "已套用({count} 個條件)",
"aiClear": "清除紀錄",
"aiKindGenerate": "產生",
"aiKindAsk": "提問",
"aiKindExplain": "解釋"
```

驗證 JSON:`node -e "JSON.parse(require('fs').readFileSync('apps/web/src/messages/en.json'));JSON.parse(require('fs').readFileSync('apps/web/src/messages/zh-TW.json'));console.log('ok')"`

- [ ] **Step 2: 寫失敗測試**

`apps/web/src/tools/_filter-builder/ai-assist-block.spec.tsx`(遷移並擴充原 `ai-nl-row.spec.tsx`;沿用其 mock 手法 —— 先讀原檔確認 mock `useAiAssist` 的方式後照搬):

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import type { FieldSchema } from "@rfjs/filter-builder";

const mockRun = vi.fn();
const mockCancel = vi.fn();
let mockReady = true;
let mockLoading = false;
let mockError: { kind: string; message: string; detail?: string } | null = null;

vi.mock("@/lib/ai/use-ai-assist", () => ({
  useAiAssist: () => ({ ready: mockReady, loading: mockLoading, error: mockError, cancel: mockCancel, run: mockRun }),
}));

import { AiAssistBlock } from "./ai-assist-block";

const SCHEMA: FieldSchema[] = [{ path: "age", dataType: "numeric", kind: "jsonb" }];
const LOG_KEY = "rfjs.ai.log.spec-tool";

function renderBlock(onApply = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en as Record<string, unknown>}>
      <AiAssistBlock
        schema={SCHEMA}
        canonicalJson='{"logic":"and","filters":[]}'
        compiled={"WHERE 1=1"}
        engineId="pg-filter"
        onApply={onApply}
        logKey={LOG_KEY}
      />
    </NextIntlClientProvider>,
  );
  return onApply;
}

beforeEach(() => {
  localStorage.clear();
  mockRun.mockReset();
  mockCancel.mockReset();
  mockReady = true;
  mockLoading = false;
  mockError = null;
});

describe("AiAssistBlock — generate(既有行為遷移)", () => {
  it("成功:onApply 收到 parse 後結果、堆疊出現 generate 項、寫入 localStorage", async () => {
    const json = '{\n  "logic": "and",\n  "filters": []\n}';
    mockRun.mockResolvedValue(json);
    const onApply = renderBlock();
    fireEvent.change(screen.getByPlaceholderText(/describe a filter/i), { target: { value: "active users" } });
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(json));
    expect(screen.getByText(/applied \(0 conditions\)/i)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(LOG_KEY)!)).toHaveLength(1);
  });

  it("失敗(run 回 null):onApply 不被呼叫、堆疊不變", async () => {
    mockRun.mockResolvedValue(null);
    const onApply = renderBlock();
    fireEvent.change(screen.getByPlaceholderText(/describe a filter/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() => expect(mockRun).toHaveBeenCalled());
    expect(onApply).not.toHaveBeenCalled();
    expect(localStorage.getItem(LOG_KEY)).toBeNull();
  });
});

describe("AiAssistBlock — ask / explain", () => {
  it("提問:堆疊出現問題+回答(display-only,不呼叫 onApply)", async () => {
    mockRun.mockResolvedValue("可以,條件會…");
    const onApply = renderBlock();
    fireEvent.change(screen.getByPlaceholderText(/describe a filter/i), { target: { value: "能挑出活躍嗎?" } });
    fireEvent.click(screen.getByRole("button", { name: /^ask$/i }));
    await waitFor(() => expect(screen.getByText("可以,條件會…")).toBeTruthy());
    expect(screen.getByText("能挑出活躍嗎?")).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
    // ask 走非 JSON 模式
    expect(mockRun.mock.calls[0][0].json).toBeUndefined();
  });

  it("解釋:免輸入可按、堆疊出現回答", async () => {
    mockRun.mockResolvedValue("這組條件會選出…");
    renderBlock();
    fireEvent.click(screen.getByRole("button", { name: /explain current filter/i }));
    await waitFor(() => expect(screen.getByText("這組條件會選出…")).toBeTruthy());
  });

  it("空輸入:generate 與 ask 均 disabled;explain 可按", () => {
    renderBlock();
    expect((screen.getByRole("button", { name: /^generate$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^ask$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /explain current filter/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("AiAssistBlock — 持久化 / 清除 / 狀態", () => {
  it("掛載時從 log 還原堆疊(最新在上)", async () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        { id: "1", kind: "explain", answer: "第一則", at: "2026-07-08T00:00:00.000Z" },
        { id: "2", kind: "explain", answer: "第二則", at: "2026-07-08T00:00:01.000Z" },
      ]),
    );
    renderBlock();
    const answers = await screen.findAllByText(/第[一二]則/);
    expect(answers[0].textContent).toBe("第二則"); // 最新在上
  });

  it("清除:堆疊清空且 localStorage 移除", async () => {
    localStorage.setItem(LOG_KEY, JSON.stringify([{ id: "1", kind: "explain", answer: "x", at: "2026-07-08T00:00:00.000Z" }]));
    renderBlock();
    await screen.findByText("x");
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(screen.queryByText("x")).toBeNull();
    expect(localStorage.getItem(LOG_KEY)).toBeNull();
  });

  it("未設定:三顆動作按鈕 disabled + 引導文案", () => {
    mockReady = false;
    renderBlock();
    expect(screen.getByText(/set up an ai connection/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /explain current filter/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("loading:顯示取消按鈕,按下呼叫 cancel", () => {
    mockLoading = true;
    renderBlock();
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(mockCancel).toHaveBeenCalled();
  });

  it("parse 錯誤:alert 顯示 [parse] 且附原始輸出摺疊", () => {
    mockError = { kind: "parse", message: "bad", detail: '{"raw":1}' };
    renderBlock();
    expect(screen.getByRole("alert").textContent).toMatch(/\[parse\] bad/);
    expect(screen.getByText(/view raw output/i)).toBeTruthy();
    expect(screen.getByText('{"raw":1}')).toBeTruthy();
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm --filter web vitest run src/tools/_filter-builder/ai-assist-block.spec.tsx`
Expected: FAIL(元件不存在)。

- [ ] **Step 4: 實作元件**

`apps/web/src/tools/_filter-builder/ai-assist-block.tsx`:

```tsx
"use client";

import * as React from "react";
import { FileText, HelpCircle, Sparkles, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@rfjs/web-ui/components/button";
import { Input } from "@rfjs/web-ui/components/input";
import type { FieldSchema } from "@rfjs/filter-builder";

import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { createAiLog, type AiAssistEntry } from "@/lib/ai/log";
import { buildNlFilterPrompt, parseNlFilterResponse } from "./ai-nl-filter";
import { buildAskPrompt, buildExplainPrompt, type ExplainContext } from "./ai-explain";

const KIND_ICON = { generate: Zap, ask: HelpCircle, explain: FileText } as const;

/** 簡單葉數:遞迴數 filters 內非 group 的條件(顯示「已套用(N 個條件)」用)。 */
function countConditions(json: string): number {
  try {
    const walk = (g: unknown): number => {
      if (typeof g !== "object" || g === null || !Array.isArray((g as { filters?: unknown[] }).filters)) return 0;
      return (g as { filters: unknown[] }).filters.reduce<number>(
        (n, f) => n + (typeof f === "object" && f !== null && "filters" in f ? walk(f) : 1),
        0,
      );
    };
    return walk(JSON.parse(json));
  } catch {
    return 0;
  }
}

export function AiAssistBlock({
  schema,
  canonicalJson,
  compiled,
  engineId,
  onApply,
  logKey,
}: {
  schema: FieldSchema[];
  canonicalJson: string;
  compiled: string | null;
  engineId: string;
  onApply: (canonicalJson: string) => void;
  logKey: string;
}) {
  const t = useTranslations("ToolUI");
  const locale = useLocale();
  const ai = useAiAssist();
  const [nl, setNl] = React.useState("");
  const log = React.useMemo(() => createAiLog(logKey), [logKey]);
  const [entries, setEntries] = React.useState<AiAssistEntry[]>([]);

  // 掛載時還原(避免 SSR/hydration 差異,list() 只在 client 跑)。
  React.useEffect(() => setEntries(log.list()), [log]);

  const ctx: ExplainContext = { canonicalJson, schema, compiled, engineId, locale };

  const push = (partial: Omit<AiAssistEntry, "id" | "at">) => {
    const entry: AiAssistEntry = { ...partial, id: crypto.randomUUID(), at: new Date().toISOString() };
    setEntries(log.append(entry));
  };

  const onGenerate = async () => {
    if (!nl.trim()) return;
    const prompt = buildNlFilterPrompt(nl, schema);
    const out = await ai.run({ ...prompt, json: true }, parseNlFilterResponse);
    if (out !== null) {
      onApply(out);
      push({ kind: "generate", prompt: nl, appliedJson: out });
      setNl("");
    }
  };

  const onAsk = async () => {
    if (!nl.trim()) return;
    const out = await ai.run(buildAskPrompt(ctx, nl), (raw) => raw.trim());
    if (out !== null) {
      push({ kind: "ask", prompt: nl, answer: out });
      setNl("");
    }
  };

  const onExplain = async () => {
    const out = await ai.run(buildExplainPrompt(ctx), (raw) => raw.trim());
    if (out !== null) push({ kind: "explain", answer: out });
  };

  const onClear = () => {
    log.clear();
    setEntries([]);
  };

  const busyOrOff = !ai.ready || ai.loading;
  const kindLabel = { generate: t("aiKindGenerate"), ask: t("aiKindAsk"), explain: t("aiKindExplain") } as const;

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={nl}
          placeholder={t("aiBlockPlaceholder")}
          disabled={!ai.ready}
          onChange={(e) => setNl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onGenerate();
          }}
          className="min-w-48 flex-1"
        />
        <Button size="sm" onClick={() => void onGenerate()} disabled={busyOrOff || !nl.trim()}>
          {t("aiGenerate")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => void onAsk()} disabled={busyOrOff || !nl.trim()}>
          {t("aiAsk")}
        </Button>
        <span className="h-5 w-px bg-border" aria-hidden />
        <Button size="sm" variant="outline" onClick={() => void onExplain()} disabled={busyOrOff}>
          {t("aiExplain")}
        </Button>
        {ai.loading ? (
          <Button size="sm" variant="outline" onClick={ai.cancel}>
            {t("aiCancel")}
          </Button>
        ) : null}
      </div>

      {!ai.ready ? <p className="text-xs text-muted-foreground">{t("aiNotConfigured")}</p> : null}

      {ai.error ? (
        <div role="alert" className="text-xs text-fault">
          <p>
            [{ai.error.kind}] {ai.error.message}
          </p>
          {ai.error.kind === "parse" && ai.error.detail ? (
            <details>
              <summary>{t("aiViewRaw")}</summary>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">{ai.error.detail}</pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="rounded-md border bg-card">
          <div className="flex items-baseline justify-between gap-3 border-b px-3 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{t("aiAnswers")}</span>
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {t("aiAdvisory")}
              <Button size="xs" variant="ghost" onClick={onClear}>
                {t("aiClear")}
              </Button>
            </span>
          </div>
          <ul className="flex flex-col">
            {[...entries].reverse().map((e) => {
              const Icon = KIND_ICON[e.kind];
              return (
                <li key={e.id} className="flex gap-2.5 border-b px-3 py-2 text-sm last:border-b-0">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      <span className="mr-1.5 rounded border bg-muted/40 px-1 py-px font-mono text-[10px]">
                        {kindLabel[e.kind]}
                      </span>
                      {e.prompt}
                    </span>
                    {e.kind === "generate" ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t("aiApplied", { count: countConditions(e.appliedJson ?? "") })}
                      </span>
                    ) : (
                      <span className="whitespace-pre-wrap">{e.answer}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
```

注意:repo 無 `text-success` token(v1 已確認)—— 成功色一律用 `text-emerald-600 dark:text-emerald-400`(上面程式碼即正確版)。

- [ ] **Step 5: 刪除舊檔 + 更新 barrel**

```bash
git rm apps/web/src/tools/_filter-builder/ai-nl-row.tsx apps/web/src/tools/_filter-builder/ai-nl-row.spec.tsx
```

`apps/web/src/tools/_filter-builder/index.ts` 第 7 行改為:

```ts
export { AiAssistBlock } from "./ai-assist-block";
```

(此時 6 個工具的 `AiNlRow` import 會 type-error —— Task 4 處理;本 task 先確保新元件測試綠。)

- [ ] **Step 6: 跑測試確認通過**

Run: `pnpm --filter web vitest run src/tools/_filter-builder/`
Expected: ai-assist-block 10 案例 + 既有 scaffold 測試全綠(`check-types` 此時預期紅,Task 4 恢復 —— 不要在本 task 跑)。

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/src/tools/_filter-builder/ apps/web/src/messages/
git commit -m "feat(web): add ai assist block with generate, ask, explain and persisted answers"
```

---

### Task 4: 6 工具接線 + 移除 aiRow slot

**Files:**
- Modify: `apps/web/src/tools/{sql-filter-builder,jsonb-query-builder,mongo-query-builder,es-query-builder,pg-filter-builder,data-filter-builder}/ui.tsx`
- Modify: `apps/web/src/tools/_filter-builder/query-output-panel.tsx`(移除 `aiRow` prop)
- Modify: `apps/web/src/tools/data-filter-builder/ui/data-panel.tsx`(移除 `aiRow` prop)
- Modify(如有 aiRow 斷言): `apps/web/src/tools/_filter-builder/query-output-panel.spec.tsx`

**Interfaces:**
- Consumes:Task 3 的 `AiAssistBlock`(props 見 Task 3 Produces)。
- Produces:無(終端接線)。

- [ ] **Step 1: 修改 5 個標準工具(sql/jsonb/mongo/es/pg)**

以 `sql-filter-builder/ui.tsx` 為例(其餘 4 個做**完全相同的三處修改**,僅代入下表的值):

(a) import:`AiNlRow` → `AiAssistBlock`(來源同為 `@/tools/_filter-builder` barrel;實際檔案第 9 行附近)。

(b) FILTER LOGIC section 的 `<div className="overflow-x-auto p-5 sm:p-6">` 內、`<FilterTreeEditor` 之前插入:

```tsx
          <div className="mb-4">
            <AiAssistBlock
              schema={fb.schema}
              canonicalJson={fb.canonicalJson}
              compiled={compiled.ok ? compiled.primary : null}
              engineId="sql-filter"
              onApply={fb.onCanonicalChange}
              logKey="rfjs.ai.log.sql-filter-builder"
            />
          </div>
```

(c) `QueryOutputPanel` 呼叫處刪掉一整行 `aiRow={<AiNlRow schema={fb.schema} onApply={fb.onCanonicalChange} />}`。

每工具代入值(engineId 與該檔 `FilterTreeEditor` 的 `engineId` 一致;logKey 用工具 slug):

| 工具 ui.tsx | engineId | logKey |
| --- | --- | --- |
| sql-filter-builder | `"sql-filter"` | `"rfjs.ai.log.sql-filter-builder"` |
| jsonb-query-builder | `"jsonb"` | `"rfjs.ai.log.jsonb-query-builder"` |
| mongo-query-builder | `"mongo"` | `"rfjs.ai.log.mongo-query-builder"` |
| es-query-builder | `"es-query"` | `"rfjs.ai.log.es-query-builder"` |
| pg-filter-builder | `"pg-filter"` | `"rfjs.ai.log.pg-filter-builder"` |

- [ ] **Step 2: 修改 data-filter-builder(無 compiled 的特例)**

`apps/web/src/tools/data-filter-builder/ui.tsx`:
(a) import 同上換名。
(b) hero section(`dfbFilterLogic` 那個 `<section>`)的 `<div className="overflow-x-auto p-5 sm:p-6">` 內、`<FilterTreeEditor` 之前插入:

```tsx
          <div className="mb-4">
            <AiAssistBlock
              schema={fb.schema}
              canonicalJson={fb.canonicalJson}
              compiled={null}
              engineId="data-filter"
              onApply={fb.onCanonicalChange}
              logKey="rfjs.ai.log.data-filter-builder"
            />
          </div>
```

(c) `DataPanel` 呼叫處刪掉 `aiRow={…}` 一行。

- [ ] **Step 3: 移除兩個面板的 aiRow prop**

`query-output-panel.tsx`:刪 props 解構的 `aiRow,`、介面宣告 `aiRow?: ReactNode;`(含其註解)、render 處 `{aiRow}`;若 `ReactNode` import 因此未使用,一併移除。`data-panel.tsx` 同樣三處。`query-output-panel.spec.tsx` 若有 aiRow 相關斷言(先 grep `aiRow`)一併刪除。

- [ ] **Step 4: 全套驗證**

```bash
pnpm --filter web vitest:run    # 期望全綠
pnpm --filter web check-types   # 期望乾淨(Task 3 的紅在此恢復)
pnpm --filter web lint          # 期望乾淨
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/
git commit -m "feat(web): mount ai assist block in filter logic across the six filter tools"
```

---

### Task 5: e2e 煙霧 + 完整 gates + 截圖

**Files:**
- Create: `apps/web/e2e/filter-ai-block.e2e.ts`

**Interfaces:**
- Consumes:Task 4 完成後的頁面;既有 e2e 慣例(`apps/web/e2e/ai-settings.e2e.ts` 同款,production server port 3002)。

- [ ] **Step 1: 寫 e2e(不打真 AI)**

`apps/web/e2e/filter-ai-block.e2e.ts`:

```ts
import { test, expect } from "@playwright/test";

test("ai assist block lives in the filter logic section", async ({ page }) => {
  await page.goto("/en/tools/pg-filter-builder");
  const input = page.getByPlaceholder(/describe a filter or ask a question/i);
  await expect(input).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /explain current filter/i })).toBeVisible();
});

test("unconfigured ai leaves the three actions disabled with guidance", async ({ page }) => {
  await page.goto("/en/tools/data-filter-builder");
  await expect(page.getByRole("button", { name: /explain current filter/i })).toBeDisabled({ timeout: 15_000 });
  await expect(page.getByText(/set up an ai connection first/i)).toBeVisible();
});
```

- [ ] **Step 2: 完整 gates(依序,全須綠)**

```bash
pnpm --filter web vitest:run
pnpm --filter web check-types
pnpm --filter web lint
pnpm --filter web build
pnpm --filter workbench build
# e2e:production server
cd apps/web && pnpm exec next start --port 3002 &   # build 已完成
pnpm exec playwright test                            # 期望全數通過(既有 13 + 新 2)
PID=$(ss -ltnp | grep 3002 | grep -oP 'pid=\K[0-9]+'); kill -9 $PID
```

- [ ] **Step 3: 截圖對 mockup(light/dark)**

用 playwright(chromium)對 `http://localhost:3002/en/tools/pg-filter-builder` 截 light 與 dark(`colorScheme` + `localStorage.theme`)各一張,存到 session scratchpad;肉眼比對 `docs/superpowers/specs/2026-07-08-rfjs-filter-ai-block-mockup.html` 的狀態 A(未設定):AI 區塊次層底色、按鈕層級(產生=主色)、分隔線、引導文案位置須一致。不一致 → 修 → 重截。

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/filter-ai-block.e2e.ts
git commit -m "test(web): e2e smoke for the filter ai assist block"
```

---

## Self-Review(已跑)

1. **Spec 覆蓋**:①a 解釋(T2+T3)、①b 問答(T2+T3)、④ 搬家+aiRow 移除(T4)、堆疊+持久化+清除+上限(T1+T3)、i18n 中央鍵+刪 aiNlPlaceholder(T3)、錯誤慣例含 aiViewRaw(T3)、e2e+gates+截圖(T5)。無缺口。
2. **Placeholder 掃描**:無 TBD/TODO;T4 的 5 工具重複以「完全相同三處修改+代入表」給足精確值,非 "similar to"。
3. **型別一致**:`AiAssistEntry`(T1)= T3 import;`ExplainContext`/`buildExplainPrompt`/`buildAskPrompt`(T2)= T3 呼叫;`AiAssistBlock` props(T3)= T4 六處傳入;`compiled.ok ? compiled.primary : null` 與各 ui.tsx 既有變數一致;data-filter 無 compiled → `null` 已特例處理。
