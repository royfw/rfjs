# 視覺統一輪(D2 studio)— 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽出 `ToolEyebrow` / `SectionCard` / `ToolTabs` 三個共用元件(D2 studio 語彙),套進 15 個 showcase 工具,收掉 5 種手刻卡 + 複製的 tab bar,並統一 ToolIntro 的 wrap。

**Architecture:** 三個共用元件放 `apps/web/src/components/shared/`。SectionCard 是唯一區塊卡(solo mono-uppercase slab 表頭 或 tab-strip 底線表頭,+ action slot + `className`/`style` passthrough 讓 filter-builder 家族保留 `fb-rise` 動畫)。純視覺外殼替換,不改任何工具的邏輯/資料流。

**Tech Stack:** Next.js 16、React 19、Tailwind(@rfjs/web-ui token)、next-intl、Vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-07-13-visual-unification-design.md`

## Global Constraints

- Worktree:`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-visual-unification`(branch `feat-visual-unification`)。所有指令在此。**每次 commit 前 `git branch --show-current` 須為 `feat-visual-unification`**。
- 只動 `apps/web`;changeset:`web` patch 一份(Task 6)。
- Commit 英文 conventional commits,header ≤100 字元,trailer:`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- **純視覺替換**:不改工具功能/邏輯/i18n 文案(除新增 eyebrow key);既有測試須維持綠,若測試斷言了舊卡 DOM(class/標題容器)則更新為新結構,但斷言的**行為**不變。
- 範圍 = **15 showcase 工具**(見 tier 表)。**不動** metadata-builder(視覺參照)、table-builder、flow-builder、bpmn-viewer。
- eyebrow i18n:各工具沿用 `<x>Eyebrow` 命名(唯一前綴),en + zh-TW 同步;工具用 `useTranslations("ToolUI")`。ToolUI 是扁平共用 namespace,前綴須唯一。
- vitest filter 用純子字串,勿加字面 `--`。pre-commit hook 跑 turbo lint-staged+test,commit 慢屬正常,不得 `--no-verify`。
- 不開 PR、不 push —— 完成 HOLD,等使用者說「PR」。

## 15 工具 tier + eyebrow 前綴表(權威)

| tier | 工具 id | eyebrow 前綴 | 卡片現況 |
|---|---|---|---|
| ToolShell(6) | data-filter-tester `dft` / jwt-decoder `jwt` / type-converter `tcv` / object-flatten `ofl` / jsonb-query-generator `jqg` / mongo-query-generator `mqg` | `<pfx>Eyebrow` | web-ui `Panel`(ToolShell input/output) |
| filter-builder 家族(6) | data-filter-builder `dfb` / sql-filter-builder `sfb` / jsonb-query-builder `jqb` / mongo-query-builder `mqb` / pg-filter-builder `pfb` / es-query-builder `eqb` | `<pfx>Eyebrow` | 手刻 `fb-rise rounded-lg` + 共享 `_filter-builder/{sample-card,query-output-panel}` |
| filter no-AI(1) | es-client-demo `ecd` | `ecdEyebrow` | ad-hoc `<section>` × N |
| bespoke(1) | decision-table `dct`(已有 `dtEyebrow` —— 沿用,不新增) | (已有) | 土砲 `rounded-md` 卡 |
| canvas(1) | form-builder `fbl` | `fblEyebrow` | `inspector/section.tsx` `Section` + 複製的頂層 tab bar |

> `data-filter-builder/messages.ts` 有 dead `dfbEyebrow`(從未渲染)—— 本輪正好接上(Task 3 渲染它)。

---

### Task 0: Worktree setup(controller 可直跑)

- [ ] `cd` worktree → `pnpm install` → `pnpm build:packages` → `pnpm -F web test 2>&1 | grep -E "Test Files|Tests "`。Expected:install/build 成功;web 基線全綠(記下數字)。

---

### Task 1: 三個共用 primitive

**Files:**
- Create: `apps/web/src/components/shared/tool-eyebrow.tsx` + `tool-eyebrow.spec.tsx`
- Create: `apps/web/src/components/shared/section-card.tsx` + `section-card.spec.tsx`
- Create: `apps/web/src/components/shared/tool-tabs.tsx` + `tool-tabs.spec.tsx`

**Interfaces (Produces — 後續 task 依賴):**
- `ToolEyebrow({ children }: { children: React.ReactNode })`
- `SectionTab = { id: string; label: string }`
- `SectionCard(props: { title?: string; tabs?: SectionTab[]; activeTab?: string; onTabChange?: (id: string) => void; action?: React.ReactNode; className?: string; style?: React.CSSProperties; children: React.ReactNode })`
- `ToolTabs(props: { tabs: SectionTab[]; active: string; onChange: (id: string) => void; ariaLabel?: string })`

- [ ] **Step 1: SectionCard failing spec**

`section-card.spec.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionCard } from "./section-card";

describe("SectionCard", () => {
  it("solo mode renders a mono-uppercase title + action + body", () => {
    render(<SectionCard title="Sample JSON" action={<span>raw (2)</span>}><p>body</p></SectionCard>);
    expect(screen.getByRole("heading", { name: "Sample JSON" })).toBeTruthy();
    expect(screen.getByText("raw (2)")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });
  it("tab mode renders a tab per entry, marks the active one, and reports changes", () => {
    const onTabChange = vi.fn();
    render(
      <SectionCard
        tabs={[{ id: "a", label: "Sample" }, { id: "b", label: "Schema" }]}
        activeTab="a"
        onTabChange={onTabChange}
      ><p>body</p></SectionCard>,
    );
    const a = screen.getByRole("button", { name: "Sample" });
    expect(a.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Schema" }));
    expect(onTabChange).toHaveBeenCalledWith("b");
  });
  it("passes through className/style to the section element (animation survives)", () => {
    const { container } = render(<SectionCard title="X" className="fb-rise" style={{ animationDelay: "70ms" }}>y</SectionCard>);
    const section = container.querySelector("section")!;
    expect(section.className).toContain("fb-rise");
    expect(section.getAttribute("style")).toContain("70ms");
  });
});
```

- [ ] **Step 2: 跑確認 fail** — `pnpm -F web exec vitest run src/components/shared/section-card` → FAIL (module not found).

- [ ] **Step 3: 實作 SectionCard**

`section-card.tsx`:
```tsx
"use client";

import * as React from "react";

export type SectionTab = { id: string; label: string };

/**
 * The single studio-style section card (design D2). Either a solo mono-uppercase
 * title on a slab header, or a tab-strip header (underline-active). Supersedes the
 * five hand-rolled card recipes across the tools. `className`/`style` pass through
 * to the <section> so animated/positioned usages (filter-builder `fb-rise`) survive.
 */
export function SectionCard({
  title,
  tabs,
  activeTab,
  onTabChange,
  action,
  className,
  style,
  children,
}: {
  title?: string;
  tabs?: SectionTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-lg border bg-card text-card-foreground${className ? ` ${className}` : ""}`}
      style={style}
    >
      {tabs && tabs.length > 0 ? (
        <div className="flex items-stretch border-b bg-muted/30">
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
          {action ? <div className="ml-auto flex items-center px-4">{action}</div> : null}
        </div>
      ) : title || action ? (
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
          {title ? (
            <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}
```

- [ ] **Step 4: 跑確認 pass** — `pnpm -F web exec vitest run src/components/shared/section-card` → 3 PASS.

- [ ] **Step 5: ToolEyebrow(spec + 實作)**

`tool-eyebrow.spec.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolEyebrow } from "./tool-eyebrow";

describe("ToolEyebrow", () => {
  it("renders its children as a small-caps label", () => {
    render(<ToolEyebrow>SQL FILTER BUILDER</ToolEyebrow>);
    expect(screen.getByText("SQL FILTER BUILDER")).toBeTruthy();
  });
});
```
`tool-eyebrow.tsx`:
```tsx
export function ToolEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</p>
  );
}
```

- [ ] **Step 6: ToolTabs(spec + 實作)**

`tool-tabs.spec.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolTabs } from "./tool-tabs";

describe("ToolTabs", () => {
  it("renders a button per tab, marks active, reports changes", () => {
    const onChange = vi.fn();
    render(<ToolTabs tabs={[{ id: "a", label: "Canvas" }, { id: "b", label: "Preview" }]} active="a" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Canvas" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
```
`tool-tabs.tsx`:
```tsx
"use client";

import type { SectionTab } from "./section-card";

/** Top-level panel switcher (segmented pill bar). Dedupes the copy-pasted tab bar. */
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
    <div role="tablist" aria-label={ariaLabel} className="inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
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
git commit -m "feat(web): shared ToolEyebrow / SectionCard / ToolTabs primitives (studio look)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 採用配方(Tasks 2–5 共用)

每工具:
1. `import { SectionCard } from "@/components/shared/section-card";` + `import { ToolEyebrow } from "@/components/shared/tool-eyebrow";`(需要頂層 tab 者再加 `ToolTabs`)。
2. **eyebrow**:在 ToolIntro 之前插 `<ToolEyebrow>{t("<pfx>Eyebrow")}</ToolEyebrow>`;`messages.ts` 加 `<pfx>Eyebrow`(en+zh,值 = 工具名大寫,如 en "SQL FILTER BUILDER" / zh "SQL 篩選建構器")。decision-table 已有 `dtEyebrow` → 只把 bare `<p>` 換成 `<ToolEyebrow>`。
3. **ToolIntro wrap 統一**:確保 root 是單一 `<div className="flex flex-col gap-4">`,ToolIntro 為其直接 child(移除 #254 多包的外層 div,若有)。
4. **卡片**:每個手刻區塊卡 → `<SectionCard title="…">`(單標題)或 `tabs`(多視圖);既有動畫/定位 class(`fb-rise` + `style={{animationDelay}}`)透過 `className`/`style` 傳入 SectionCard。
5. **ui.spec**:若既有測試斷舊卡 DOM,更新為新結構(SectionCard 的 `<h2>` 標題 / `<section>`);若工具有 eyebrow 接線可加一則 `getByText(工具名大寫)`。

---

### Task 2: ToolShell tier(6 工具)

**Files:** 各 `tools/<id>/{ui.tsx,messages.ts}`(+ `ui.spec.tsx` 若需),`tools/<id>` = data-filter-tester, jwt-decoder, type-converter, object-flatten, jsonb-query-generator, mongo-query-generator。

作法:這 6 個工具的 `ui.tsx` 目前把 `<Panel title=…>` 當 `ToolShell` 的 `input`/`output`。把 `import { Panel } from "@rfjs/web-ui/components/panel"` 換成 SectionCard,`<Panel title=…>` → `<SectionCard title=…>`(API 相容:title/action/children;SectionCard 多了 slab 表頭 = D2 差異)。ToolShell 本身不動。加 eyebrow(於 ToolShell 上方,在統一 wrap 內)。

- [ ] **Step 1–6:** 逐工具:換 Panel→SectionCard、加 `<pfx>Eyebrow`(en+zh)、確認 wrap。跑各工具 vitest + 全套 check-types/lint。
- [ ] **Step 7:** commit `feat(web): studio SectionCard + eyebrow for the ToolShell tools`(+ trailer)。

---

### Task 3: filter-builder 家族(6 工具 + 共享子元件)

**Files:** `tools/_filter-builder/sample-card.tsx`、`tools/_filter-builder/query-output-panel.tsx`(共享,改一次 6 工具受惠);各 `tools/<id>/ui.tsx` 的 inline `<section className="fb-rise …">`;各 `messages.ts` 加 `<pfx>Eyebrow`;`data-filter-builder/messages.ts` 的 dead `dfbEyebrow` 保留並接上渲染。

作法:把 `sample-card.tsx` / `query-output-panel.tsx` / 各 ui.tsx 的 inline `<section className="fb-rise rounded-lg border bg-card"><div className="border-b px-5 py-3"><span className="font-mono …">{title}</span></div><div className="p-4">…</div></section>` 全部換成 `<SectionCard title={title} className="fb-rise" style={{ animationDelay: "…" }}>…</SectionCard>`(動畫透過 passthrough 保留;`px-5`→SectionCard 統一的 `px-4`)。`AiAssistBlock`(`_filter-builder/ai-assist-block.tsx`)若也是手刻卡殼,同樣換 SectionCard。各工具加 eyebrow。

- [ ] **Step 1:** 先改共享子元件(sample-card / query-output-panel / ai-assist-block)→ SectionCard;跑其既有 spec(`*.spec.tsx`)確認綠(斷言更新為新 DOM 若需)。
- [ ] **Step 2–6:** 逐工具改 inline section + 加 eyebrow(6 個);跑各工具 vitest。
- [ ] **Step 7:** 全套 check-types/lint;commit `feat(web): studio SectionCard + eyebrow across the filter-builder family`(+ trailer)。

---

### Task 4: es-client-demo + decision-table

**Files:** `tools/es-client-demo/{ui.tsx,messages.ts}`、`tools/decision-table/ui.tsx`(dtEyebrow 已在)。

- es-client-demo:把 ad-hoc `<section className="rounded-lg border bg-card">…` 各段換 SectionCard；加 `ecdEyebrow`(en+zh);統一 wrap。
- decision-table:土砲 `rounded-md border` 卡 → SectionCard;bare eyebrow `<p>` → `<ToolEyebrow>`(dtEyebrow 沿用);`RuleSheet` slide-over 內的卡若非主區塊可留(它是 drawer,非頁面區塊卡 —— 實作判斷,主頁面區塊優先)。

- [ ] **Step 1–5:** 兩工具改卡 + eyebrow;跑 vitest（decision-table 測試較多,注意斷言更新）。
- [ ] **Step 6:** check-types/lint;commit `feat(web): studio SectionCard for es-client-demo and decision-table`(+ trailer)。

---

### Task 5: form-builder

**Files:** `tools/form-builder/ui.tsx`(頂層 tab bar → ToolTabs;`Section` 使用處 → SectionCard 若為頁面區塊)、`tools/form-builder/inspector/section.tsx`、`tools/form-builder/messages.ts`(加 `fblEyebrow`)。

- 頂層複製的 tab bar(`inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1` + buttons)→ `<ToolTabs tabs=… active=… onChange=… />`。
- 加 `fblEyebrow`(en+zh)+ 統一 wrap。
- `Section`(inspector 摺疊區塊):**保留其摺疊行為**;若要對齊 D2,將其外殼字體對齊 SectionCard 語彙(可選;form-builder inspector 是 canvas 專屬,主頁面區塊卡優先套 SectionCard)。drag/drop 畫布不動。

- [ ] **Step 1–5:** tab bar → ToolTabs、加 eyebrow、主頁面卡 → SectionCard;跑 form-builder vitest(大檔,注意 reindent 乾淨、tab 斷言)。
- [ ] **Step 6:** check-types/lint;commit `feat(web): ToolTabs + studio SectionCard + eyebrow for form-builder`(+ trailer)。

---

### Task 6: changeset + 全面驗證 + 截圖(controller 可直跑)

- [ ] **Step 1:** `.changeset/web-visual-unification.md`:
```md
---
"web": patch
---

Unify the 15 showcase tools' shell visual language to the metadata-studio look: extract shared ToolEyebrow / SectionCard / ToolTabs, replace the five hand-rolled section-card recipes and the duplicated tab bar, roll the eyebrow out to every tool, and normalize the ToolIntro wrap.
```
commit `chore: changeset for visual-unification round`(+ trailer)。

- [ ] **Step 2:** `pnpm -F web test 2>&1 | grep -E "Test Files|Tests " && pnpm -F web check-types && pnpm -F web lint` — 全綠。

- [ ] **Step 3:** 殘留 grep:確認已改工具無舊手刻卡 recipe(`grep -rn "fb-rise rounded-lg\|rounded-md border\"" apps/web/src/tools` 依實際 pattern),無 dead eyebrow 未渲染。

- [ ] **Step 4:** dev server(port 3174)+ bundled chromium 截圖每 tier 代表 + metadata-builder 對照,dark/light:data-filter-tester(ToolShell)、sql-filter-builder(家族)、es-client-demo、decision-table、form-builder、metadata-builder。截完 kill server。

- [ ] **Step 5:** `git log --oneline main..HEAD && git status` — 6 code/chore commits + 乾淨樹。**HOLD,不開 PR**。

---

## Self-Review(已跑)
- **Spec coverage**:3 primitive(T1)、ToolShell tier(T2)、filter-builder 家族(T3)、es-client-demo+decision-table(T4)、form-builder+ToolTabs(T5)、eyebrow 全推(各 task)、ToolIntro wrap 統一(配方 step 3)、changeset+截圖(T6)。✓
- **Placeholder scan**:primitive 全碼;採用以「配方 + 逐工具檔/前綴」表達(比照 ToolIntro rollout);RISE 動畫經 `className`/`style` passthrough 明確保留。✓
- **Type/naming consistency**:`SectionCard` props、`SectionTab`、`ToolTabs`、`ToolEyebrow` 簽名 T1 定義、T2–T5 一致消費;eyebrow 前綴表唯一;ToolUI 扁平 namespace 前綴唯一。✓
- **風險**:T3(家族共享子元件 + 動畫)最高風險,已隔離成獨立 task、先改子元件再逐工具、passthrough 保動畫;各 task 既有測試為迴歸網。
