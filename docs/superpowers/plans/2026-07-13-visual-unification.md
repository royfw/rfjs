# 視覺統一輪(D2 studio)— 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽出 `ToolEyebrow` / `SectionCard`(靜態 + tab + **可摺疊**三態)/ `ToolTabs`,套進 15 個 showcase 工具,收掉手刻卡 + 複製 tab bar,統一 ToolIntro wrap。

**Architecture:** 三個共用元件放 `apps/web/src/components/shared/`。SectionCard 是唯一區塊卡:solo(slab mono-uppercase 表頭)或 tabs(tab-strip 底線表頭),外加**可摺疊模式**(受控 `open`/`onOpenChange` 或非受控 `defaultOpen`;chevron + `border-t` body gate)——對齊 studio 樣式本就含的可摺疊卡(AiPanel)。`action`(右側 slot)、`className`/`style`/`bodyClassName` passthrough(保 filter 家族 `fb-rise` 動畫 + filter-logic 的 `overflow-x-auto`)。純視覺外殼替換,行為(含收合)一律保留。

**Tech Stack:** Next.js 16、React 19、Tailwind(@rfjs/web-ui token)、next-intl、Vitest + @testing-library/react、lucide-react(ChevronDown/ChevronRight)。

**Spec:** `docs/superpowers/specs/2026-07-13-visual-unification-design.md`

## Global Constraints

- Worktree:`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-visual-unification`(branch `feat-visual-unification`)。**每次 commit 前 `git branch --show-current` 須為此**。
- 只動 `apps/web`;changeset:`web` patch 一份(Task 6)。
- Commit 英文 conventional commits,header ≤100 字元,trailer:`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- **純視覺替換 + 行為保留**:不改工具邏輯/資料流/i18n 文案(除新增 eyebrow key);**可摺疊卡的收合行為必須保留**(遷到 SectionCard 的 collapsible 模式,不得默默移除)。既有測試維持綠;斷言舊卡 DOM 者更新為新結構,但斷言的行為不變。
- **ToolTabs 用 plain `<button>`(不加 `role="tab"`)** —— 否則 consumer 的 `getByRole("button", …)` 會失效(form-builder 有 7 處),且半套 tab widget a11y 更差。
- 範圍 = **15 showcase 工具**(tier 表)。**不動** metadata-builder(視覺參照)、table-builder、flow-builder、bpmn-viewer。
- eyebrow i18n:各工具 `<pfx>Eyebrow`(唯一前綴),en + zh-TW **同步**;工具用 `useTranslations("ToolUI")`(扁平共用 namespace)。
- vitest filter 純子字串,勿加字面 `--`。pre-commit hook 跑 turbo lint-staged+test,commit 慢正常,不得 `--no-verify`。
- 不開 PR、不 push —— 完成 HOLD,等使用者說「PR」。

## 15 工具 tier + eyebrow 前綴表(權威)

| tier | 工具 id(前綴) | 卡片現況 |
|---|---|---|
| ToolShell(6) | data-filter-tester `dft` / jwt-decoder `jwt` / type-converter `tcv` / object-flatten `ofl` / jsonb-query-generator `jqg` / mongo-query-generator `mqg` | web-ui `Panel`(靜態) |
| filter-builder 家族(6) | data-filter-builder `dfb` / sql-filter-builder `sfb` / jsonb-query-builder `jqb` / mongo-query-builder `mqb` / pg-filter-builder `pfb` / es-query-builder `eqb` | 靜態 inline `fb-rise` section(Fields / Filter-logic)+ **可摺疊**共享 `SampleCard` / `QueryOutputPanel` + `AiAssistBlock`(=AiPanel) |
| filter no-AI(1) | es-client-demo `ecd` | ad-hoc 靜態 `<section>` + 共享 SampleCard |
| bespoke(1) | decision-table(已有 `dtEyebrow`) | 靜態 `rounded-md` 卡(靠自身 `space-y-2` 撐間距) |
| canvas(1) | form-builder `fbl` | **可摺疊** `Section`(主頁 3 處 + inspector 15+ 處)+ 複製的頂層 tab bar |

> `data-filter-builder/messages.ts` 的 `dfbEyebrow`(en+zh 皆在,現 dead)—— 本輪接上渲染(不刪)。

---

### Task 0: Worktree setup(controller 可直跑)
- [ ] `cd` worktree → `pnpm install` → `pnpm build:packages` → `pnpm -F web test 2>&1 | grep -E "Test Files|Tests "`。Expected:全綠(基線 85 files / 440 tests)。

---

### Task 1: 三個共用 primitive(含可摺疊 SectionCard)

**Files:** Create `apps/web/src/components/shared/{tool-eyebrow,section-card,tool-tabs}.tsx` + 各 `.spec.tsx`。

**Interfaces (Produces):**
- `ToolEyebrow({ children }: { children: React.ReactNode })`
- `SectionTab = { id: string; label: string }`
- `SectionCard(props: { title?: string; tabs?: SectionTab[]; activeTab?: string; onTabChange?: (id: string) => void; action?: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; className?: string; style?: React.CSSProperties; bodyClassName?: string; children: React.ReactNode })`
- `ToolTabs(props: { tabs: SectionTab[]; active: string; onChange: (id: string) => void; ariaLabel?: string })`

- [ ] **Step 1: SectionCard failing spec**

`section-card.spec.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionCard } from "./section-card";

describe("SectionCard", () => {
  it("solo mode: mono-uppercase title + action + body", () => {
    render(<SectionCard title="Sample JSON" action={<span>raw (2)</span>}><p>body</p></SectionCard>);
    expect(screen.getByRole("heading", { name: "Sample JSON" })).toBeTruthy();
    expect(screen.getByText("raw (2)")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });
  it("tab mode: a tab per entry, active marked, change reported", () => {
    const onTabChange = vi.fn();
    render(<SectionCard tabs={[{ id: "a", label: "Sample" }, { id: "b", label: "Schema" }]} activeTab="a" onTabChange={onTabChange}><p>body</p></SectionCard>);
    expect(screen.getByRole("button", { name: "Sample" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Schema" }));
    expect(onTabChange).toHaveBeenCalledWith("b");
  });
  it("className/style pass through to the section (fb-rise survives)", () => {
    const { container } = render(<SectionCard title="X" className="fb-rise" style={{ animationDelay: "70ms" }}>y</SectionCard>);
    const s = container.querySelector("section")!;
    expect(s.className).toContain("fb-rise");
    expect(s.getAttribute("style")).toContain("70ms");
  });
  it("bodyClassName overrides the default p-4 body", () => {
    const { container } = render(<SectionCard title="X" bodyClassName="overflow-x-auto p-5 sm:p-6">y</SectionCard>);
    // the body div is the last child of the section
    const body = container.querySelector("section > div:last-child")!;
    expect(body.className).toContain("overflow-x-auto");
    expect(body.className).not.toContain("p-4");
  });
  it("collapsible uncontrolled: open by default, toggles, hides body when closed", () => {
    render(<SectionCard title="Out" collapsible><p>payload</p></SectionCard>);
    const toggle = screen.getByRole("button", { name: /out/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("payload")).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("payload")).toBeNull();
  });
  it("collapsible uncontrolled: defaultOpen=false starts closed", () => {
    render(<SectionCard title="Out" collapsible defaultOpen={false}><p>payload</p></SectionCard>);
    expect(screen.queryByText("payload")).toBeNull();
  });
  it("collapsible controlled: reflects open prop + reports onOpenChange, does not self-toggle", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<SectionCard title="S" collapsible open={true} onOpenChange={onOpenChange}><p>payload</p></SectionCard>);
    const toggle = screen.getByRole("button", { name: /^s/i });
    fireEvent.click(toggle);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // still open because parent controls it and hasn't changed the prop
    expect(screen.getByText("payload")).toBeTruthy();
    rerender(<SectionCard title="S" collapsible open={false} onOpenChange={onOpenChange}><p>payload</p></SectionCard>);
    expect(screen.queryByText("payload")).toBeNull();
  });
});
```

- [ ] **Step 2: 跑確認 fail** — `pnpm -F web exec vitest run src/components/shared/section-card` → FAIL。

- [ ] **Step 3: 實作 SectionCard**

`section-card.tsx`:
```tsx
"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type SectionTab = { id: string; label: string };

/**
 * The single studio-style section card (design D2). Header is either a solo
 * mono-uppercase title (slab) or a tab-strip (underline-active). Optionally
 * collapsible (controlled via open/onOpenChange, else uncontrolled via
 * defaultOpen) — the studio look includes collapsible cards (AiPanel). Supersedes
 * the hand-rolled card recipes. `className`/`style` reach the <section> (so
 * `fb-rise` animation survives); `bodyClassName` overrides the default p-4 body
 * (so the filter-logic canvas keeps `overflow-x-auto p-5 sm:p-6`).
 */
export function SectionCard({
  title,
  tabs,
  activeTab,
  onTabChange,
  action,
  collapsible,
  defaultOpen = true,
  open,
  onOpenChange,
  className,
  style,
  bodyClassName,
  children,
}: {
  title?: string;
  tabs?: SectionTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = collapsible ? (isControlled ? open : internalOpen) : true;

  function toggle() {
    onOpenChange?.(!isOpen);
    if (!isControlled) setInternalOpen((v) => !v);
  }

  const titleEl = title ? (
    <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{title}</h2>
  ) : null;

  const tabStrip = tabs && tabs.length > 0 ? (
    <>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTabChange?.(t.id)}
          aria-selected={activeTab === t.id}
          className={`px-4 py-2 text-[13px] font-medium transition-colors ${
            activeTab === t.id
              ? "bg-card font-semibold text-primary shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </>
  ) : null;

  const hasHeader = Boolean(titleEl) || Boolean(tabStrip) || Boolean(action) || collapsible;

  return (
    <section
      className={`overflow-hidden rounded-lg border bg-card text-card-foreground${className ? ` ${className}` : ""}`}
      style={style}
    >
      {hasHeader ? (
        collapsible ? (
          <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={isOpen}
              className="flex flex-1 items-center gap-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              {titleEl}
            </button>
            {action}
          </div>
        ) : tabStrip ? (
          <div className="flex items-stretch border-b bg-muted/30">
            {tabStrip}
            {action ? <div className="ml-auto flex items-center px-4">{action}</div> : null}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
            {titleEl ?? <span />}
            {action}
          </div>
        )
      ) : null}
      {isOpen ? <div className={bodyClassName ?? "p-4"}>{children}</div> : null}
    </section>
  );
}
```

- [ ] **Step 4: 跑確認 pass** — `pnpm -F web exec vitest run src/components/shared/section-card` → all PASS。

- [ ] **Step 5: ToolEyebrow(spec + 實作)**

`tool-eyebrow.spec.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolEyebrow } from "./tool-eyebrow";
describe("ToolEyebrow", () => {
  it("renders children as a small-caps label", () => {
    render(<ToolEyebrow>SQL FILTER BUILDER</ToolEyebrow>);
    expect(screen.getByText("SQL FILTER BUILDER")).toBeTruthy();
  });
});
```
`tool-eyebrow.tsx`:
```tsx
export function ToolEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</p>;
}
```

- [ ] **Step 6: ToolTabs(spec + 實作;plain button,無 role=tab)**

`tool-tabs.spec.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolTabs } from "./tool-tabs";
describe("ToolTabs", () => {
  it("renders a plain button per tab, marks active, reports changes", () => {
    const onChange = vi.fn();
    render(<ToolTabs tabs={[{ id: "a", label: "Canvas" }, { id: "b", label: "Preview" }]} active="a" onChange={onChange} />);
    const a = screen.getByRole("button", { name: "Canvas" });
    expect(a.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
```
`tool-tabs.tsx`:
```tsx
"use client";

import type { SectionTab } from "./section-card";

/** Top-level panel switcher (segmented pill bar). Plain <button>s (role=button) so
 * consumers' getByRole("button", …) tab queries keep working. Dedupes the copied bar. */
export function ToolTabs({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: SectionTab[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div aria-label={ariaLabel} className="inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
            active === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: 全綠 + commit**
```bash
pnpm -F web exec vitest run src/components/shared/section-card src/components/shared/tool-eyebrow src/components/shared/tool-tabs
pnpm -F web check-types && pnpm -F web lint
git add apps/web/src/components/shared/{section-card,tool-eyebrow,tool-tabs}.tsx apps/web/src/components/shared/{section-card,tool-eyebrow,tool-tabs}.spec.tsx
git commit -m "feat(web): shared ToolEyebrow / SectionCard (solo+tab+collapsible) / ToolTabs primitives

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 採用配方(Tasks 2–5 共用)

每工具:
1. `import { SectionCard } from "@/components/shared/section-card";` + `import { ToolEyebrow } from "@/components/shared/tool-eyebrow";`(需頂層 tab 者加 `ToolTabs`)。
2. **eyebrow**:ToolIntro 之前插 `<ToolEyebrow>{t("<pfx>Eyebrow")}</ToolEyebrow>`;`messages.ts` 加 `<pfx>Eyebrow`(en 值=工具名大寫如 "SQL FILTER BUILDER";zh 值=工具中文名如 "SQL 篩選建構器" —— 比照既有 dtEyebrow/tbEyebrow 慣例)。decision-table 已有 `dtEyebrow` → 只把 bare `<p>` 換 `<ToolEyebrow>`。
3. **ToolIntro wrap 統一**(攤平內層,勿刪外層):目標 = 單一 `flex flex-col gap-4` root,eyebrow → ToolIntro → 卡片全 flat sibling。**外層 gap-4 root 是元件 return root,勿刪**(刪會產生相鄰 JSX root = build error)。真正多的是**內層** wrapper:
   - ToolShell tier + decision-table:已是 flat canonical → **wrap 不動**。
   - filter-builder 家族 + es-client-demo:外層 gap-4 內、ToolIntro 之後多包一層 `<div className="flex flex-col gap-5">`(含 `<style>{RISE}</style>` + fb-rise 卡)→ **刪這層 inner div 的開合標籤**,把 `<style>` 及其下卡片提升為外層 gap-4 的 sibling(gap 5→4;`<style>` 為 display:none 不佔 gap,安全)。
   - form-builder:外層 gap-4 內、ToolIntro 之後多包一層 `<div className="flex flex-col gap-4">`(含 tab bar + AiPanel + 畫布)→ 去這層 nesting、內容提升為 sibling(gap 不變)。
4. **靜態卡** → `<SectionCard title="…">`(或 `tabs`);`action` 放右側附屬(如 raw count / copy);動畫/定位 class 經 `className`/`style` 傳入;需要大 padding/overflow 的 body 用 `bodyClassName`。
5. **可摺疊卡** → `<SectionCard collapsible …>`(見各 task 的具體 mapping);受控者傳 `open`/`onOpenChange`,非受控者用 `defaultOpen`。
6. **靠 `space-y-*` 撐內距的卡**:移入 SectionCard 時把 children 包一層 `<div className="space-y-*">`(原值)——`space-y` 傳給 SectionCard 的 `className` 無效(落在 `<section>`,不影響 body 內)。
7. **ui.spec**:斷舊卡 DOM 者更新為新結構;可摺疊卡遷移後,其既有/新增 spec 須涵蓋收合行為(見 Task 3)。

---

### Task 2: ToolShell tier(6 工具)

**Files:** 各 `tools/<id>/{ui.tsx,messages.ts}`(id = data-filter-tester, jwt-decoder, type-converter, object-flatten, jsonb-query-generator, mongo-query-generator)。

作法:這 6 工具把 `<Panel title=…>`(來自 `@rfjs/web-ui/components/panel`)當 ToolShell 的 `input`/`output`。**先 grep 確認無 `interactive` prop 用法**(SectionCard 不支援 `interactive`;經查這 6 工具皆未用,若有需回報);把 `Panel` import 換成 SectionCard、`<Panel title=…>` → `<SectionCard title=…>`(title/action/children 相容;SectionCard 多 slab 表頭 = D2 差異)。ToolShell 本身不動。加 `<pfx>Eyebrow`(於 ToolShell 上方、統一 wrap 內)。wrap 已是 canonical,不動。

- [ ] **Step 1–6:** 逐工具換卡 + 加 eyebrow;跑各工具 vitest + check-types/lint。
- [ ] **Step 7:** commit `feat(web): studio SectionCard + eyebrow for the ToolShell tools`(+ trailer)。

---

### Task 3: filter-builder 家族(6 工具 + 共享子元件)

**Files:** `tools/_filter-builder/sample-card.tsx`、`tools/_filter-builder/query-output-panel.tsx`(共享,改一次 6/5 工具受惠);各 `tools/<id>/ui.tsx` 的兩個 inline `fb-rise` section(Fields + Filter-logic)+ wrap 攤平 + eyebrow;各 `messages.ts` 加 `<pfx>Eyebrow`;`query-output-panel.spec.tsx` 加收合斷言。**`ai-assist-block.tsx` 不動**(它只 render 已一致的 `AiPanel`,再包 SectionCard 會雙層卡框)。

- [ ] **Step 1: SampleCard → collapsible SectionCard**(父控收合)

`sample-card.tsx` 的外層 `<section className="fb-rise rounded-lg border bg-card" style={style}>` + 手刻 toggle button + 條件 body,改成:
```tsx
  return (
    <SectionCard
      title={labels.sample}
      collapsible
      open={open}
      onOpenChange={onToggle}
      action={
        hasError ? (
          <span className="font-mono text-xs text-fault">{labels.invalidSample}</span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{labels.rawCount}</span>
        )
      }
      className="fb-rise"
      style={style}
    >
      {/* 原本 open 分支內的 textarea + upload + error,原封搬入(去掉外層 border-t p-4 div —— SectionCard body 已提供;保留內層 flex-col gap-2) */}
      <div className="flex flex-col gap-2">
        …(原 textarea/upload/error children)…
      </div>
    </SectionCard>
  );
```
(移除手刻 chevron/button/section;`open`/`onToggle` 仍是 props,現由 SectionCard 的 controlled 收合驅動。)sample-card **無既有 spec** → 新增 `sample-card.spec.tsx`:render(open=true)見 textarea;點 title 觸發 `onToggle`;open=false 時 body 隱藏。

- [ ] **Step 2: QueryOutputPanel → collapsible SectionCard**(內部收合;output/canonical 按鈕留 body)

`query-output-panel.tsx` 的外層 `<section>` + 手刻 toggle,改成 `<SectionCard title={labels.output} collapsible>`(內部非受控收合,預設開);把原 `{open ? <div className="…border-t p-4">…}` 內的 output/canonical Button 列 + 兩個 pane 當 children(去掉外層 border-t p-4,保留內層 `flex flex-col gap-3`)。刪除自身的 `open`/`setOpen`(交給 SectionCard);`tab`/`setTab` 保留。
`query-output-panel.spec.tsx` 加一則:render 見 primary 文字 + toggle `aria-expanded="true"`;點 toggle 後 primary 消失、`aria-expanded="false"`。

- [ ] **Step 3: 6 工具的兩個 inline 靜態 section → SectionCard**

各 ui.tsx 的 Fields section(如 sql:109-128,`<section className="fb-rise rounded-lg border bg-card"><div className="border-b px-5 py-3"><span>{title}</span></div><div className="p-4">…</div></section>`)→ `<SectionCard title={t("<pfx>Fields")} className="fb-rise" style={{ animationDelay: "70ms" }}>…</SectionCard>`。
各 ui.tsx 的 **Filter-logic** section(如 sql:142-161,body 是 `<div className="overflow-x-auto p-5 sm:p-6"><FilterTreeEditor/></div>`)→ `<SectionCard title={t("<pfx>FilterLogic")} className="fb-rise" style={{ animationDelay: "…" }} bodyClassName="overflow-x-auto p-5 sm:p-6"><FilterTreeEditor …/></SectionCard>`(**bodyClassName 保住 overflow + 大 padding**)。
同時攤平 wrap(配方 step 3,filter 家族分支)+ 加 `<pfx>Eyebrow`。

- [ ] **Step 4:** 逐工具跑 vitest（`pnpm -F web exec vitest run src/tools/<id>`)+ 共享子元件 spec;全套 check-types/lint。
- [ ] **Step 5:** commit `feat(web): studio SectionCard + eyebrow across the filter-builder family`(+ trailer)。

---

### Task 4: es-client-demo + decision-table

**Files:** `tools/es-client-demo/{ui.tsx,messages.ts}`、`tools/decision-table/ui.tsx`。

- **es-client-demo**:ad-hoc 靜態 `<section className="rounded-lg border bg-card">` 各段 → SectionCard(靜態 `title`);它也用共享 SampleCard(已於 Task 3 遷好,無需再動);加 `ecdEyebrow`(en+zh);wrap 攤平(filter no-AI 分支)。
- **decision-table**:三個靜態卡 single-eval(ui.tsx:358)/ batch-eval(:386)/ JSON(:433)`<div className="space-y-2 rounded-md border p-3">` → `<SectionCard title={t("dt…")}><div className="space-y-2">…children…</div></SectionCard>`(**children 包 `space-y-2` 保內距**);rule table(:263,無 space-y)直接 SectionCard;bare eyebrow `<p>`(:178)→ `<ToolEyebrow>`(dtEyebrow 沿用)。`RuleSheet` slide-over(drawer,非頁面區塊卡)**不動**(其內 `space-y-4` 保留)。wrap 已 canonical,不動。

- [ ] **Step 1–5:** 兩工具改卡 + eyebrow;跑 vitest(decision-table 測試較多,斷言更新)。
- [ ] **Step 6:** check-types/lint;commit `feat(web): studio SectionCard for es-client-demo and decision-table`(+ trailer)。

---

### Task 5: form-builder

**Files:** `tools/form-builder/inspector/section.tsx`(`Section` 改為 SectionCard-backed)、`tools/form-builder/ui.tsx`(頂層 tab bar → ToolTabs;wrap 攤平;+ eyebrow)、`tools/form-builder/messages.ts`(加 `fblEyebrow`)。

- **`Section` → SectionCard-backed thin wrapper**(一改,主頁 3 處 + inspector 15+ 處全受惠、行為不變):
```tsx
"use client";
import * as React from "react";
import { SectionCard } from "@/components/shared/section-card";
export function Section({
  title, defaultOpen = true, badge, children,
}: { title: string; defaultOpen?: boolean; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SectionCard title={title} collapsible defaultOpen={defaultOpen} action={badge}>
      <div className="flex flex-col gap-2">{children}</div>
    </SectionCard>
  );
}
```
(保留 `Section` 的公開 API:title/defaultOpen/badge/children —— 18 處呼叫端零改動;收合行為由 SectionCard collapsible 提供;原本 body 的 `flex flex-col gap-2` 保留。)**確認 form-builder/ui.spec 的收合斷言**(getByRole button /editor|live preview|submission/i + collapse 隱藏)仍綠 —— SectionCard collapsible 的 toggle button 之 accessible name = title,`aria-expanded` 與 body gate 一致,應維持。若斷言查的是舊 `Section` 特定 class,更新為新結構。
- **頂層 tab bar** → `<ToolTabs tabs=… active=… onChange=… />`(ToolTabs plain button → 既有 `getByRole("button", {name:/^preview$/i})` 等 7 處 spec 不動即綠)。
- 加 `fblEyebrow`(en+zh)+ wrap 攤平(form-builder 分支)。drag/drop 畫布、GroupFrame 不動。

- [ ] **Step 1:** 改 `Section` → SectionCard-backed;跑 form-builder 全 spec 確認收合斷言綠。
- [ ] **Step 2:** tab bar → ToolTabs;加 eyebrow;wrap 攤平。跑 form-builder vitest(大檔,注意 reindent 乾淨)。
- [ ] **Step 3:** check-types/lint;commit `feat(web): ToolTabs + studio SectionCard (via Section) + eyebrow for form-builder`(+ trailer)。

---

### Task 6: changeset + 全面驗證 + 截圖(controller 可直跑)

- [ ] **Step 1:** `.changeset/web-visual-unification.md`:
```md
---
"web": patch
---

Unify the 15 showcase tools' shell visual language to the metadata-studio look: extract shared ToolEyebrow / SectionCard (solo + tab + collapsible) / ToolTabs, replace the hand-rolled section-card recipes (static and collapsible) and the duplicated tab bar, roll the eyebrow out to every tool, and flatten the ToolIntro wrap to a single column.
```
commit `chore: changeset for visual-unification round`(+ trailer)。

- [ ] **Step 2:** `pnpm -F web test 2>&1 | grep -E "Test Files|Tests " && pnpm -F web check-types && pnpm -F web lint` — 全綠。

- [ ] **Step 3:** 殘留 grep:`grep -rn "fb-rise rounded-lg\|rounded-md border" apps/web/src/tools`(除 RuleSheet drawer 外應無舊卡 recipe);無 dead/未渲染 eyebrow。

- [ ] **Step 4:** dev server(port 3174)+ bundled chromium 截圖每 tier 代表 + metadata-builder 對照,dark/light:data-filter-tester(ToolShell)、sql-filter-builder(家族,含 Sample/Compiled 收合展開兩態)、es-client-demo、decision-table、form-builder、metadata-builder。截完 kill server。

- [ ] **Step 5:** `git log --oneline main..HEAD && git status` — 6 code/chore commits + 乾淨樹。**HOLD,不開 PR**。

---

## Self-Review(已跑,對照對抗式驗證)
- **Spec coverage**:3 primitive 含 collapsible(T1)、ToolShell(T2)、filter 家族含 SampleCard/QueryOutputPanel collapsible 遷移 + filter-logic bodyClassName + AiAssistBlock 排除(T3)、es-client+decision-table space-y 保留(T4)、form-builder Section→SectionCard-backed + ToolTabs plain button(T5)、eyebrow 全推 + wrap 攤平內層(配方 step 2/3)、changeset+截圖(T6)。✓
- **對抗式驗證 8 findings 全已納入**:SampleCard/QueryOutputPanel collapsible(T1 collapsible + T3);filter-logic overflow(bodyClassName);AiAssistBlock 排除;ToolTabs plain button;form-builder Section 真相(SectionCard-backed,非 force-swap);decision-table space-y;wrap 攤平內層(非刪外層)。✓
- **Placeholder scan**:primitive 全碼;採用以配方 + 逐工具 mapping。✓
- **Type/naming consistency**:SectionCard props(含 collapsible/open/onOpenChange/bodyClassName)、SectionTab、ToolTabs、ToolEyebrow 簽名 T1 定義、後續一致;eyebrow 前綴唯一。✓
- **風險**:T3(共享 collapsible 子元件)最高,先改子元件 + 新增/補收合 spec 再逐工具;各 task 既有測試為迴歸網。
