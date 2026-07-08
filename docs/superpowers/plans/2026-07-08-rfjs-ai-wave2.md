# AI Wave 2(AiPanel + 重新套用 + dt/fb 接入)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽出通用 `AiPanel` 外殼(收合/輸入/動作插槽/錯誤/紀錄堆疊),filter 紀錄加「重新套用」,decision-table 與 form-builder 換上同款 AI section(舊 Check 鈕、findings 面板、fb ✨ 列移除)。

**Architecture:** `AiPanel`(`apps/web/src/components/shared/`)持有 UI 狀態與 `AiLogStore`;工具側提供 `AiPanelAction[]`(prompt 組裝 + 驗證閘門 + 套用都在 `run` 裡)。filter 的 `AiAssistBlock` 變薄組合層(對外 props 不變,6 工具接線零改動)。

**Tech Stack:** Next.js 15(apps/web)、next-intl、vitest + @testing-library/react、Playwright e2e、既有 `useAiAssist`/`AiLogStore`。

**Spec:** `docs/superpowers/specs/2026-07-08-rfjs-ai-wave2-design.md`
**Mockup(視覺定稿)**:`docs/superpowers/specs/2026-07-08-rfjs-ai-wave2-mockup.html`

## Global Constraints

- 只動 `apps/web`;`packages/*` 零改動 → 不需 changeset(若動到一律補,private 也要)。
- 驗證閘門不變:filter=`parseNlFilterResponse`→`onCanonicalChange`;fb=`parseNlFormResponse`(內含 `jsonToCards`)→ 與手動 JSON 匯入同 setters;dt=`parseCheckResponse`(zod + 幻覺 ruleId 過濾)。提問/解釋 display-only 純文字(`whitespace-pre-wrap`,不 render HTML/Markdown)。
- **Enter = 第一個 `needsInput: true` 的動作**;Shift+Enter 換行;IME `isComposing` 不觸發;loading 中不重送。
- 錯誤慣例:`role="alert"` `[{kind}] {message}`;parse+detail → `<details><summary>{aiViewRaw}</summary>`;abort 不顯示為錯誤;未設定 → 按鈕 disabled + `aiNotConfigured`。
- 收合偏好沿用全站 key `rfjs.ai.block.open`(常數移至 ai-panel.tsx)。
- i18n:en/zh-TW 鍵集合一致;中央/fragment 不衝突(`tools/index.spec.ts`);被中央取代的 fragment 鍵要**兩語系同步移除**。
- React hook 模組第一行 `"use client"`。
- commit 英文 conventional(subject 全小寫),trailer 前空行,最後一行恰為 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 測試:從 `apps/web/` 跑 `pnpm exec vitest run <path>`(全套:worktree 根 `pnpm --filter web vitest:run`);type `pnpm --filter web check-types`;lint `pnpm --filter web lint`。
- e2e 打 production server(`next build`+`next start --port 3002`),**絕不** `next dev`;殘留 server:`PID=$(ss -ltnp | grep 3002 | grep -oP 'pid=\K[0-9]+')` 後 `kill -9 $PID`。

**既有事實(實作以此為準,已由 controller 查核)**:
- `AiAssistEntry.kind` 目前 `'generate'|'ask'|'explain'`(`apps/web/src/lib/ai/log.ts`,`KINDS` set 驗證)。
- dt:`buildCheckPrompt(tableJson: string, locale: string)`、`parseCheckResponse(raw: string, validRuleIds: string[]): AiFinding[]`(`AiFinding = { kind: 'gap'|'overlap'|'unreachable'|'note'; ruleIds: string[]; message: string }`);`tableToJson(table)`;規則 id = `table.rules.map(r => r.id)`。
- fb:`buildNlFormPrompt(nl: string)`、`parseNlFormResponse(raw: string): string`;套用 = `const {groups: g, cards: c} = jsonToCards(out); setGroups(g); setCards(c);`;`applyJson(text)`(ui.tsx:350)是手動 JSON 匯入的既有函式;`formConfig = useMemo(() => cardsToFormConfig(groups, cards), ...)`(ui.tsx:179)。
- `FieldSchema` 必填 `include: boolean`(spec fixture 要帶 `include: true`)。
- e2e `apps/web/e2e/ai-settings.e2e.ts:12` 用 `getByRole("button", { name: /ai check/i })` — Task 6 更新。

---

### Task 1: entry kind `check` + 中央 i18n 鍵

**Files:**
- Modify: `apps/web/src/lib/ai/log.ts`(kind union + KINDS)
- Modify: `apps/web/src/lib/ai/log.spec.ts`(kind 驗證案例)
- Modify: `apps/web/src/messages/en.json`、`apps/web/src/messages/zh-TW.json`(中央 ToolUI)

**Interfaces:**
- Produces:`AiAssistEntry.kind: 'generate' | 'ask' | 'explain' | 'check'`;中央鍵 `aiKindCheck`、`aiReapply`。

- [ ] **Step 1: 失敗測試** — `log.spec.ts` 的「過濾形狀不合法的項目」案例改為同時驗證 `check` 合法:

```ts
  it('過濾形狀不合法的項目(缺 id / kind 非法);check 為合法 kind', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([entry(1), { kind: 'ask' }, { id: 'x', kind: 'nope' }, { id: 'c1', kind: 'check', answer: 'ok', at: '2026-07-08T00:00:00.000Z' }]),
    );
    expect(createAiLog(KEY).list().map((e) => e.id)).toEqual(['id-1', 'c1']);
  });
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `pnpm exec vitest run src/lib/ai/log.spec.ts` → FAIL(`check` 被過濾)。
- [ ] **Step 3: 實作** — `log.ts`:kind union 加 `'check'`;`const KINDS = new Set(['generate', 'ask', 'explain', 'check']);`
- [ ] **Step 4: 跑測試確認通過** — 同上指令 → 5 passed。
- [ ] **Step 5: i18n** — en ToolUI(`aiKindExplain` 之後)加:

```json
"aiKindCheck": "Check",
"aiReapply": "Re-apply",
```

zh-TW 對應:

```json
"aiKindCheck": "檢查",
"aiReapply": "重新套用",
```

驗證兩檔 `node -e "JSON.parse(...)"` 均 ok。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/ai/ apps/web/src/messages/
git commit -m "feat(web): add check entry kind and reapply i18n keys"
```

---

### Task 2: `AiPanel` 通用外殼

**Files:**
- Create: `apps/web/src/components/shared/ai-panel.tsx`
- Test: `apps/web/src/components/shared/ai-panel.spec.tsx`

**Interfaces:**
- Consumes:`useAiAssist`(傳入,非自建)、`createAiLog`/`AiAssistEntry`(Task 1 後含 `check`)。
- Produces(Task 3/4/5 依賴,精確簽名):

```tsx
export const AI_BLOCK_OPEN_KEY = "rfjs.ai.block.open";

export interface AiPanelAction {
  key: string;                 // 寫入 entry.kind('generate'|'ask'|'explain'|'check')
  label: string;
  needsInput?: boolean;
  primary?: boolean;
  run: (input: string) => Promise<Omit<AiAssistEntry, "id" | "at"> | null>;
}

export function AiPanel(props: {
  title: string;
  placeholder: string;
  actions: AiPanelAction[];
  logKey: string;
  ai: ReturnType<typeof useAiAssist>;
  onReapply?: (entry: AiAssistEntry) => void;
  appliedSummary?: (entry: AiAssistEntry) => string;  // 有 appliedJson 的項顯示的摘要文字
}): React.JSX.Element;
```

- [ ] **Step 1: 失敗測試** — `ai-panel.spec.tsx`(mock 手法同 `ai-assist-block.spec.tsx`;收合/IME/Shift+Enter/loading/錯誤/持久化案例自該檔**遷移**,斷言不變,僅 render 換成 AiPanel + 兩個測試動作):

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import type { AiAssistEntry } from "@/lib/ai/log";
import { AiPanel, type AiPanelAction } from "./ai-panel";

const mockCancel = vi.fn();
let mockReady = true;
let mockLoading = false;
let mockError: { kind: string; message: string; detail?: string } | null = null;
const fakeAi = () =>
  ({ ready: mockReady, loading: mockLoading, error: mockError, cancel: mockCancel, run: vi.fn() }) as never;

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
    <NextIntlClientProvider locale="en" messages={en as Record<string, unknown>}>
      <AiPanel title="AI assist" placeholder="type here…" actions={actions()} logKey={LOG_KEY} ai={fakeAi()} {...extra} />
    </NextIntlClientProvider>,
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
});

describe("AiPanel — 動作與輸入", () => {
  it("needsInput 動作在空輸入時 disabled;免輸入動作可按", () => {
    renderPanel();
    expect((screen.getByRole("button", { name: /^ask it$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^explain it$/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("run 回 entry → 落地堆疊並寫 localStorage、輸入清空;回 null → 不落地", async () => {
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

  it("Enter 觸發第一個 needsInput 動作;isComposing / Shift+Enter / loading 不觸發", async () => {
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

  it("loading:顯示取消並可呼叫 cancel;動作 disabled", () => {
    mockLoading = true;
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(mockCancel).toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /^explain it$/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("未設定:動作 disabled + 引導文案", () => {
    mockReady = false;
    renderPanel();
    expect(screen.getByText(/set up an ai connection/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^explain it$/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("parse 錯誤:alert 顯示 [parse] 且附原始輸出摺疊", () => {
    mockError = { kind: "parse", message: "bad", detail: '{"raw":1}' };
    renderPanel();
    expect(screen.getByRole("alert").textContent).toMatch(/\[parse\] bad/);
    expect(screen.getByText(/view raw output/i)).toBeTruthy();
    expect(screen.getByText('{"raw":1}')).toBeTruthy();
  });
});

describe("AiPanel — 收合 / 持久化 / 重新套用", () => {
  it("收合:點標題隱藏內容並存偏好;偏好 0 時掛載即收合", async () => {
    renderPanel();
    const toggle = screen.getByRole("button", { name: /ai assist/i });
    fireEvent.click(toggle);
    expect(screen.queryByPlaceholderText("type here…")).toBeNull();
    expect(localStorage.getItem("rfjs.ai.block.open")).toBe("0");
  });

  it("掛載還原堆疊(最新在上);清除清空 localStorage", async () => {
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

  it("onReapply + appliedJson 才顯示重新套用,點擊帶正確 entry;appliedSummary 呈現", async () => {
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
    expect(btns).toHaveLength(1); // explain 項沒有
    fireEvent.click(btns[0]!);
    expect(onReapply).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }));
  });

  it("未給 onReapply:有 appliedJson 也不顯示按鈕", async () => {
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

- [ ] **Step 2: 跑測試確認失敗** — Run: `pnpm exec vitest run src/components/shared/ai-panel.spec.tsx` → FAIL(模組不存在)。
- [ ] **Step 3: 實作** — `ai-panel.tsx`(自 `ai-assist-block.tsx` 移植外殼,動作插槽化):

```tsx
"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, ClipboardCheck, FileText, HelpCircle, Sparkles, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@rfjs/web-ui/components/button";
import { Textarea } from "@rfjs/web-ui/components/textarea";

import type { useAiAssist } from "@/lib/ai/use-ai-assist";
import { createAiLog, type AiAssistEntry } from "@/lib/ai/log";

export const AI_BLOCK_OPEN_KEY = "rfjs.ai.block.open";

const KIND_ICON = { generate: Zap, ask: HelpCircle, explain: FileText, check: ClipboardCheck } as const;

export interface AiPanelAction {
  key: string;
  label: string;
  needsInput?: boolean;
  primary?: boolean;
  run: (input: string) => Promise<Omit<AiAssistEntry, "id" | "at"> | null>;
}

export function AiPanel({
  title,
  placeholder,
  actions,
  logKey,
  ai,
  onReapply,
  appliedSummary,
}: {
  title: string;
  placeholder: string;
  actions: AiPanelAction[];
  logKey: string;
  ai: ReturnType<typeof useAiAssist>;
  onReapply?: (entry: AiAssistEntry) => void;
  appliedSummary?: (entry: AiAssistEntry) => string;
}) {
  const t = useTranslations("ToolUI");
  const [nl, setNl] = React.useState("");
  const log = React.useMemo(() => createAiLog(logKey), [logKey]);
  const [entries, setEntries] = React.useState<AiAssistEntry[]>([]);
  const [open, setOpen] = React.useState(true);

  // 掛載時還原(SSR/hydration 安全:localStorage 只在 client 讀)。
  React.useEffect(() => {
    setEntries(log.list());
    setOpen(window.localStorage.getItem(AI_BLOCK_OPEN_KEY) !== "0");
  }, [log]);

  const onToggle = () => {
    setOpen((prev) => {
      window.localStorage.setItem(AI_BLOCK_OPEN_KEY, prev ? "0" : "1");
      return !prev;
    });
  };

  const exec = async (action: AiPanelAction) => {
    if (action.needsInput && !nl.trim()) return;
    const partial = await action.run(nl);
    if (partial !== null) {
      const entry: AiAssistEntry = { ...partial, id: crypto.randomUUID(), at: new Date().toISOString() };
      setEntries(log.append(entry));
      if (action.needsInput) setNl("");
    }
  };

  const enterAction = actions.find((a) => a.needsInput);
  const inputActions = actions.filter((a) => a.needsInput);
  const freeActions = actions.filter((a) => !a.needsInput);
  const busyOrOff = !ai.ready || ai.loading;
  const kindLabel: Record<string, string> = {
    generate: t("aiKindGenerate"),
    ask: t("aiKindAsk"),
    explain: t("aiKindExplain"),
    check: t("aiKindCheck"),
  };

  const renderAction = (a: AiPanelAction) => (
    <Button
      key={a.key}
      size="sm"
      variant={a.primary ? "default" : "outline"}
      onClick={() => void exec(a)}
      disabled={busyOrOff || (a.needsInput ? !nl.trim() : false)}
    >
      {a.label}
    </Button>
  );

  return (
    <section className="flex flex-col rounded-lg border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-2 px-5 py-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <Sparkles className="size-4" />
        <span className="font-mono text-xs uppercase tracking-wide">{title}</span>
      </button>

      {open ? (
        <div className="flex flex-col gap-2 border-t p-4">
          <div className="flex flex-wrap items-start gap-2">
            <Textarea
              rows={1}
              value={nl}
              placeholder={placeholder}
              disabled={!ai.ready}
              onChange={(e) => setNl(e.target.value)}
              onKeyDown={(e) => {
                // Enter=第一個 needsInput 動作;Shift+Enter 換行;IME/loading 防護。
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !ai.loading && enterAction) {
                  e.preventDefault();
                  void exec(enterAction);
                }
              }}
              className="max-h-28 min-h-9 min-w-48 flex-1 resize-none py-1.5"
            />
            {inputActions.map(renderAction)}
            {inputActions.length > 0 && freeActions.length > 0 ? (
              <span className="h-5 w-px bg-border" aria-hidden />
            ) : null}
            {freeActions.map(renderAction)}
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
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t("aiAnswers")}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {t("aiAdvisory")}
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      log.clear();
                      setEntries([]);
                    }}
                  >
                    {t("aiClear")}
                  </Button>
                </span>
              </div>
              <ul className="flex max-h-64 flex-col overflow-y-auto">
                {[...entries].reverse().map((e) => {
                  const Icon = KIND_ICON[e.kind as keyof typeof KIND_ICON] ?? Sparkles;
                  return (
                    <li key={e.id} className="flex gap-2.5 border-b px-3 py-2 text-sm last:border-b-0">
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">
                          <span className="mr-1.5 rounded border bg-muted/40 px-1 py-px font-mono text-[10px]">
                            {kindLabel[e.kind] ?? e.kind}
                          </span>
                          {e.prompt}
                        </span>
                        {e.appliedJson && appliedSummary ? (
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">{appliedSummary(e)}</span>
                            {onReapply ? (
                              <Button size="xs" variant="outline" onClick={() => onReapply(e)}>
                                {t("aiReapply")}
                              </Button>
                            ) : null}
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
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: 跑測試確認通過** — `pnpm exec vitest run src/components/shared/ai-panel.spec.tsx` → 10 passed。
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/ai-panel.tsx apps/web/src/components/shared/ai-panel.spec.tsx
git commit -m "feat(web): add reusable ai panel shell with pluggable actions"
```

---

### Task 3: filter `AiAssistBlock` 改組合 AiPanel + 重新套用

**Files:**
- Modify: `apps/web/src/tools/_filter-builder/ai-assist-block.tsx`(重寫為薄組合層)
- Modify: `apps/web/src/tools/_filter-builder/ai-assist-block.spec.tsx`(外殼案例已遷移至 ai-panel.spec → 移除;保留/改寫 filter 特有案例)

**Interfaces:**
- Consumes:Task 2 `AiPanel`/`AiPanelAction`;既有 `buildNlFilterPrompt`/`parseNlFilterResponse`/`buildAskPrompt`/`buildExplainPrompt`/`ExplainContext`。
- Produces:對外 props **完全不變**(6 工具 ui.tsx 零改動):`{ schema, canonicalJson, compiled, engineId, onApply, logKey, sampleRows? }`。

- [ ] **Step 1: 改寫測試**(收合/IME/持久化/清除案例刪除 —— 已在 ai-panel.spec;保留並改寫這些 filter 特有案例,mock 手法不變):
  - generate 成功:`onApply` 收到 parse 後結果、堆疊 generate 項、寫 localStorage、`mockRun` 的 system 含 canonicalJson 與樣本(既有斷言保留)。
  - generate 失敗(run 回 null):`onApply` 不呼叫、不落地。
  - ask/explain:display-only(既有斷言保留;ask 非 JSON 模式)。
  - **新增:重新套用** — 預置 localStorage 一筆 `{ kind: "generate", prompt: "p", appliedJson: '{"logic":"and","filters":[]}' }` → 點「Re-apply」→ `onApply` 收到該 JSON。
  - **新增:已套用摘要** — generate 項顯示 `applied (0 conditions)`(`aiApplied` + `countConditions`)。
- [ ] **Step 2: 跑測試確認失敗** — `pnpm exec vitest run src/tools/_filter-builder/ai-assist-block.spec.tsx`(重新套用案例 FAIL)。
- [ ] **Step 3: 實作** — `ai-assist-block.tsx` 重寫(`countConditions` 留此檔;`AI_BLOCK_OPEN_KEY` 匯出移除 —— 改由 ai-panel 匯出,先 `grep -rn AI_BLOCK_OPEN_KEY apps/web/src` 確認無其他 import):

```tsx
"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import type { FieldSchema } from "@rfjs/filter-builder";

import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { AiPanel, type AiPanelAction } from "@/components/shared/ai-panel";
import { buildNlFilterPrompt, parseNlFilterResponse } from "./ai-nl-filter";
import { buildAskPrompt, buildExplainPrompt, type ExplainContext } from "./ai-explain";

/** 簡單葉數:遞迴數 filters 內非 group 的條件(「已套用(N 個條件)」用)。 */
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
  sampleRows,
}: {
  schema: FieldSchema[];
  canonicalJson: string;
  compiled: string | null;
  engineId: string;
  onApply: (canonicalJson: string) => void;
  logKey: string;
  sampleRows?: unknown[];
}) {
  const t = useTranslations("ToolUI");
  const locale = useLocale();
  const ai = useAiAssist();
  const ctx: ExplainContext = { canonicalJson, schema, compiled, engineId, locale, sampleRows };

  const actions: AiPanelAction[] = [
    {
      key: "generate",
      label: t("aiGenerate"),
      needsInput: true,
      primary: true,
      run: async (input) => {
        const prompt = buildNlFilterPrompt(input, schema, canonicalJson, sampleRows);
        const out = await ai.run({ ...prompt, json: true }, parseNlFilterResponse);
        if (out === null) return null;
        onApply(out);
        return { kind: "generate", prompt: input, appliedJson: out };
      },
    },
    {
      key: "ask",
      label: t("aiAsk"),
      needsInput: true,
      run: async (input) => {
        const out = await ai.run(buildAskPrompt(ctx, input), (raw) => raw.trim());
        return out === null ? null : { kind: "ask", prompt: input, answer: out };
      },
    },
    {
      key: "explain",
      label: t("aiExplain"),
      run: async () => {
        const out = await ai.run(buildExplainPrompt(ctx), (raw) => raw.trim());
        return out === null ? null : { kind: "explain", answer: out };
      },
    },
  ];

  return (
    <AiPanel
      title={t("aiBlockTitle")}
      placeholder={t("aiBlockPlaceholder")}
      actions={actions}
      logKey={logKey}
      ai={ai}
      onReapply={(e) => onApply(e.appliedJson ?? "")}
      appliedSummary={(e) => t("aiApplied", { count: countConditions(e.appliedJson ?? "") })}
    />
  );
}
```

- [ ] **Step 4: 全域驗證** — `pnpm exec vitest run src/tools/` + `pnpm --filter web check-types` + `pnpm --filter web lint` 全綠(6 工具接線零改動,型別即證)。
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/_filter-builder/
git commit -m "feat(web): rebuild filter ai block on the shared panel with reapply"
```

---

### Task 4: decision-table 接入 AiPanel

**Files:**
- Create: `apps/web/src/tools/decision-table/ai-explain-table.ts` + `ai-explain-table.spec.ts`
- Modify: `apps/web/src/tools/decision-table/ui.tsx`、`messages.ts`、`ui.spec.tsx`

**Interfaces:**
- Consumes:`AiPanel`(Task 2)、既有 `buildCheckPrompt(tableJson, locale)`/`parseCheckResponse(raw, validRuleIds)`/`tableToJson`。
- Produces:`buildTableExplainPrompt(ctx)`/`buildTableAskPrompt(ctx, q)`,`ctx = { tableJson: string; locale: string }`。

- [ ] **Step 1: 失敗測試(prompt 模組)** — `ai-explain-table.spec.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildTableAskPrompt, buildTableExplainPrompt } from "./ai-explain-table";

const CTX = { tableJson: '{"rules":[{"id":"r1"}]}', locale: "zh-TW" };

describe("table explain/ask prompts", () => {
  it("system 含表格 JSON、locale、純文字指示;explain user 提到 explain", () => {
    const p = buildTableExplainPrompt(CTX);
    expect(p.system).toContain(CTX.tableJson);
    expect(p.system).toContain("zh-TW");
    expect(p.system.toLowerCase()).toContain("plain text");
    expect(p.user).toMatch(/explain/i);
  });
  it("ask 的 user 為問題原文", () => {
    const p = buildTableAskPrompt(CTX, "r1 什麼時候命中?");
    expect(p.user).toBe("r1 什麼時候命中?");
    expect(p.system).toContain(CTX.tableJson);
  });
});
```

- [ ] **Step 2: 確認失敗後實作** — `ai-explain-table.ts`:

```ts
export interface TableExplainContext {
  tableJson: string;
  locale: string;
}

function buildSystem(ctx: TableExplainContext): string {
  return [
    "You are an assistant for a decision-table editor (rules evaluated top-down; conditions are nested filter trees).",
    "Current table (JSON):",
    ctx.tableJson,
    `Answer in the "${ctx.locale}" language, in plain text (no Markdown), concisely.`,
  ].join("\n");
}

export function buildTableExplainPrompt(ctx: TableExplainContext): { system: string; user: string } {
  return { system: buildSystem(ctx), user: "Explain what this decision table does, rule by rule, briefly." };
}

export function buildTableAskPrompt(ctx: TableExplainContext, question: string): { system: string; user: string } {
  return { system: buildSystem(ctx), user: question };
}
```

跑 `pnpm exec vitest run src/tools/decision-table/ai-explain-table.spec.ts` → 2 passed。

- [ ] **Step 3: ui.tsx 接線 + 移除舊件** —
  (a) 規則卡片 `<div>`(含 Rules header 那個容器)**之前**插入:

```tsx
      <AiPanel
        title={t("aiBlockTitle")}
        placeholder={t("dtAiPlaceholder")}
        logKey="rfjs.ai.log.decision-table"
        ai={ai}
        actions={[
          {
            key: "check",
            label: t("dtAiCheck"),
            primary: true,
            run: async () => {
              const prompt = buildCheckPrompt(tableToJson(table), locale);
              const validIds = table.rules.map((r) => r.id);
              const findings = await ai.run({ ...prompt, json: true }, (raw) => parseCheckResponse(raw, validIds));
              if (findings === null) return null;
              const text =
                findings.length === 0
                  ? t("dtAiNoFindings")
                  : findings
                      .map((f) => `[${f.kind}]${f.ruleIds.length > 0 ? ` (${f.ruleIds.join(", ")})` : ""} ${f.message}`)
                      .join("\n");
              return { kind: "check", answer: text };
            },
          },
          {
            key: "ask",
            label: t("aiAsk"),
            needsInput: true,
            run: async (input) => {
              const out = await ai.run(buildTableAskPrompt({ tableJson: tableToJson(table), locale }, input), (raw) => raw.trim());
              return out === null ? null : { kind: "ask", prompt: input, answer: out };
            },
          },
          {
            key: "explain",
            label: t("dtAiExplain"),
            run: async () => {
              const out = await ai.run(buildTableExplainPrompt({ tableJson: tableToJson(table), locale }), (raw) => raw.trim());
              return out === null ? null : { kind: "explain", answer: out };
            },
          },
        ]}
      />
```

  import:`AiPanel` 自 `@/components/shared/ai-panel`;`buildTableAskPrompt`/`buildTableExplainPrompt` 自 `./ai-explain-table`。
  (b) **移除**:Rules header 的 AI Check `<Button>` 與 `dtAiNotConfigured` span(ui.tsx:170-178 區段)、`onAiCheck` 函式(133)、`findings` state(81)、卡片內 `ai.error` 區塊與 `dt-ai-findings` 面板(整段)。`AiFinding` import 若因此未使用一併移除;`useAiAssist` 保留(panel 用)。
  (c) 動作順序注意:`check` 免輸入但要當第一顆(primary);`ask` 是唯一 `needsInput` → Enter 觸發 ask(符合 Global Constraints)。

- [ ] **Step 4: i18n(messages.ts,en/zh-TW 同步)** —
  - 改:`dtAiCheck` → en `"Check table"` / zh `"檢查表格"`。
  - 加:`dtAiPlaceholder`(en `"Describe or ask a question…"` / zh `"描述或提出問題…"`)、`dtAiExplain`(en `"Explain this table"` / zh `"解釋這張表"`)。
  - 刪:`dtAiChecking`、`dtAiFindings`、`dtAiDisclaimer`、`dtAiNotConfigured`、`dtAiViewRaw`(中央取代)。`dtAiNoFindings` 保留(check 空結果文案)。
- [ ] **Step 5: ui.spec.tsx 更新** — 舊「AI Check 按鈕在 Rules header」「findings 面板」相關斷言改為:panel 存在(placeholder 可見)、check 動作成功 → 堆疊出現 `[gap]` 行(mock `useAiAssist` 回 findings JSON…沿用該檔既有 mock 手法;若該檔目前無 AI 案例則新增最小一例)、Rules header 不再有 Check 鈕。既有非 AI 案例不動。
- [ ] **Step 6: 驗證** — `pnpm exec vitest run src/tools/decision-table/` + `check-types` + `lint` 全綠;`pnpm exec vitest run src/tools/index.spec.ts`(鍵集合/衝突)綠。
- [ ] **Step 7: Commit**

```bash
git add apps/web/src/tools/decision-table/
git commit -m "feat(web): move decision-table ai onto the shared panel with ask and explain"
```

---

### Task 5: form-builder 接入 AiPanel

**Files:**
- Create: `apps/web/src/tools/form-builder/ai-explain-form.ts` + `ai-explain-form.spec.ts`
- Modify: `apps/web/src/tools/form-builder/ui.tsx`、`messages.ts`、`ui.spec.tsx`

**Interfaces:**
- Consumes:`AiPanel`、既有 `buildNlFormPrompt`/`parseNlFormResponse`/`jsonToCards`/`applyJson`(ui.tsx:350)/`formConfig`(useMemo)。
- Produces:`buildFormExplainPrompt(ctx)`/`buildFormAskPrompt(ctx, q)`,`ctx = { configJson: string; locale: string }`。

- [ ] **Step 1: 失敗測試(prompt 模組)** — `ai-explain-form.spec.ts`(形狀同 Task 4 Step 1,斷言 configJson/locale/plain text/問題原文;fixture `configJson = '{"version":1,"fields":[]}'`)。
- [ ] **Step 2: 確認失敗後實作** — `ai-explain-form.ts`:

```ts
export interface FormExplainContext {
  configJson: string;
  locale: string;
}

function buildSystem(ctx: FormExplainContext): string {
  return [
    "You are an assistant for a form designer (FormConfig JSON: sections/fields with components and validation).",
    "Current form config (JSON):",
    ctx.configJson,
    `Answer in the "${ctx.locale}" language, in plain text (no Markdown), concisely.`,
  ].join("\n");
}

export function buildFormExplainPrompt(ctx: FormExplainContext): { system: string; user: string } {
  return { system: buildSystem(ctx), user: "Explain what this form collects and any validation rules, briefly." };
}

export function buildFormAskPrompt(ctx: FormExplainContext, question: string): { system: string; user: string } {
  return { system: buildSystem(ctx), user: question };
}
```

- [ ] **Step 3: ui.tsx 接線 + 移除舊件** —
  (a) tabs 列與內容之間、舊 ✨ 列(ui.tsx:424-460 區段,含 `aiNl` state、`onAiGenerate`)**整段刪除**,原位置放:

```tsx
      <AiPanel
        title={t("aiBlockTitle")}
        placeholder={t("fbAiPlaceholder")}
        logKey="rfjs.ai.log.form-builder"
        ai={ai}
        onReapply={(e) => applyJson(e.appliedJson ?? "")}
        appliedSummary={(e) => {
          let n = 0;
          try {
            const parsed = JSON.parse(e.appliedJson ?? "") as { fields?: unknown[] };
            n = Array.isArray(parsed.fields) ? parsed.fields.length : 0;
          } catch {
            n = 0;
          }
          return t("fbAiApplied", { count: n });
        }}
        actions={[
          {
            key: "generate",
            label: t("fbAiGenerate"),
            needsInput: true,
            primary: true,
            run: async (input) => {
              const out = await ai.run({ ...buildNlFormPrompt(input), json: true }, parseNlFormResponse);
              if (out === null) return null;
              const { groups: g, cards: c } = jsonToCards(out);
              setGroups(g);
              setCards(c);
              return { kind: "generate", prompt: input, appliedJson: out };
            },
          },
          {
            key: "ask",
            label: t("aiAsk"),
            needsInput: true,
            run: async (input) => {
              const out = await ai.run(
                buildFormAskPrompt({ configJson: JSON.stringify(formConfig, null, 2), locale }, input),
                (raw) => raw.trim(),
              );
              return out === null ? null : { kind: "ask", prompt: input, answer: out };
            },
          },
          {
            key: "explain",
            label: t("fbAiExplain"),
            run: async () => {
              const out = await ai.run(
                buildFormExplainPrompt({ configJson: JSON.stringify(formConfig, null, 2), locale }),
                (raw) => raw.trim(),
              );
              return out === null ? null : { kind: "explain", answer: out };
            },
          },
        ]}
      />
```

  `locale` 若 ui.tsx 尚未取用則加 `const locale = useLocale();`(import 自 next-intl)。重新套用經 `applyJson`(= 手動 JSON 匯入同閘門,invalid 會走其既有錯誤處理)。
  (b) 注意 Enter → 第一個 needsInput = generate(與 Wave 1 行為一致)。
- [ ] **Step 4: i18n(messages.ts,en/zh-TW 同步)** —
  - 改:`fbAiPlaceholder` → en `"Describe a form or ask a question…"` / zh `"描述表單或提出問題…"`;`fbAiGenerate` → en `"Generate form"` / zh `"產生表單"`。
  - 加:`fbAiExplain`(en `"Explain form"` / zh `"解釋表單"`)、`fbAiApplied`(en `"Applied ({count} fields)"` / zh `"已套用({count} 個欄位)"`)。
  - 刪:`fbAiCancel`、`fbAiNotConfigured`、`fbAiViewRaw`(中央取代)。
- [ ] **Step 5: ui.spec.tsx 更新** — 舊 ✨ 列相關斷言(若有)改 panel;既有 AI generate 測試(如有)遷移為 panel 動作;非 AI 案例不動。
- [ ] **Step 6: 驗證** — `pnpm exec vitest run src/tools/form-builder/ src/tools/index.spec.ts` + `check-types` + `lint` 全綠。
- [ ] **Step 7: Commit**

```bash
git add apps/web/src/tools/form-builder/
git commit -m "feat(web): move form-builder ai onto the shared panel with ask, explain and reapply"
```

---

### Task 6: e2e 更新 + 完整 gates + 截圖

**Files:**
- Modify: `apps/web/e2e/ai-settings.e2e.ts`(dt 按鈕選擇器)
- Create/Modify: `apps/web/e2e/filter-ai-block.e2e.ts`(如受影響)或新增 dt/fb panel 煙霧

**Interfaces:** Consumes Task 3/4/5 完成後的頁面。

- [ ] **Step 1: e2e 更新** —
  - `ai-settings.e2e.ts:12` 的 `/ai check/i` → `/check table/i`(按鈕已在 panel 內,預設展開仍可見;`toBeDisabled` 斷言不變)。
  - 新增煙霧(同檔或新檔,不打真 AI):
    - dt:`/en/tools/decision-table` → `getByPlaceholder(/describe or ask/i)` 可見、`getByRole("button", { name: /explain this table/i })` disabled(未設定)。
    - fb:`/en/tools/form-builder` → `getByPlaceholder(/describe a form/i)` 可見、`getByRole("button", { name: /generate form/i })` disabled。
- [ ] **Step 2: 完整 gates(依序全綠,結果進報告)** —

```bash
pnpm --filter web vitest:run
pnpm --filter web check-types
pnpm --filter web lint
pnpm --filter web build
pnpm --filter workbench build
# e2e:apps/web 下
pnpm exec next start --port 3002 &   # build 已完成
pnpm exec playwright test
PID=$(ss -ltnp | grep 3002 | grep -oP 'pid=\K[0-9]+'); kill -9 $PID
```

- [ ] **Step 3: 截圖對 mockup** — production server 下截 dt 與 fb 頁(light/dark 各一),對照 `2026-07-08-rfjs-ai-wave2-mockup.html`:panel 位置、動作按鈕組(主色/outline/分隔線)、check 紀錄項格式、fb 產生項的「已套用 + 重新套用」。不符 → 修 → 重截。
- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/
git commit -m "test(web): e2e coverage for the shared ai panel on dt and fb"
```

---

## Self-Review(已跑)

1. **Spec 覆蓋**:①外殼(T2)、②重新套用 filter/fb(T3/T5,`onReapply`+閘門)、③dt 接入+移除(T4)、④fb 接入+移除(T5)、kind `check`+i18n(T1)、e2e/gates/截圖(T6)。無缺口。
2. **Placeholder 掃描**:無 TBD;T4/T5 的 ui.spec 更新以「既有 mock 手法」為錨並給出必要斷言方向與最小案例要求 —— 具體案例碼由既有檔案遷移(檔案在 repo 內,implementer 讀得到)。
3. **型別一致**:`AiPanelAction.run` 回 `Omit<AiAssistEntry,"id"|"at"> | null`(T2 定義,T3/4/5 全部照用);`appliedSummary`/`onReapply` 簽名一致;dt `parseCheckResponse(raw, validIds)` 兩參數與現碼一致;fb `applyJson(text)` 與現碼一致;`FieldSchema` fixture 不出現(T3 測試沿用既有 fixture,已含 `include: true`)。
