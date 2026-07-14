# 視覺統一輪 — D2 flourishes 追加 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 追加在同一分支 `feat-visual-unification`(#255)之上,承接已完成的 6 個 task(3 primitive + 15 工具採用)。

**Goal:** 把 D2 mockup 最具識別度的三樣 flourish 套進實際工具:輸出卡的 **tab-strip 表頭** + **gold fragment bar**,Filter Logic 的 **dashed 次級容器**。讓成品明顯像 metadata-studio。

**Architecture:** 擴 `SectionCard` 讓 collapsible 與 tabs **併存**(collapsible+tabs = chevron 前置 + tab-strip);新增小元件 `FragmentBar`(gold 狀態條)。只加在有意義的卡(輸出、Filter Logic);單視圖卡(SAMPLE/FIELDS/AI/DATA)維持 solo slab、不動。純視覺,收合行為保留。

**Mockup:** `scratchpad/…/tasks/2026-07-13-d2-flourishes.html`(before/after,已核可)。

## Global Constraints
- Worktree `feat-visual-unification`(接續 #255);每次 commit 前 `git branch --show-current` 須為此。
- 只動 apps/web;無新 changeset(既有 `web` patch 涵蓋;F4 更新其描述)。
- Commit 英文 conventional,header ≤100,trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 純視覺 + 行為保留:QueryOutputPanel 的收合 + output/canonical 切換必須保留(只是切換移到表頭 tab-strip);既有測試維持綠,斷舊 DOM 者忠實更新。
- **既有 collapsible-only 用法不可壞**:SampleCard(collapsible+title,父控)、form-builder Section(collapsible+title)—— SectionCard 改動後必須維持它們原行為。
- 不開 PR、HOLD。

---

### Task F1: SectionCard collapsible+tabs 併存 + FragmentBar

**Files:** Modify `apps/web/src/components/shared/section-card.tsx` + `section-card.spec.tsx`;Create `apps/web/src/components/shared/fragment-bar.tsx` + `fragment-bar.spec.tsx`。

**Interfaces (Produces):**
- SectionCard 新增 optional `collapseLabel?: string`(collapsible+tabs 模式時 chevron 按鈕的 aria-label,因無 title);行為新增:`collapsible && tabs` → chevron 前置 + tab-strip 表頭。既有簽名其餘不變。
- `FragmentBar({ children }: { children: React.ReactNode })` — gold 狀態條。

- [ ] **Step 1: 更新 section-card.spec 加 collapsible+tabs 案**(failing 先行)

在既有 `section-card.spec.tsx` 加:
```tsx
  it("collapsible + tabs: renders a chevron toggle AND the tab-strip; tabs switch, chevron collapses", () => {
    const onTabChange = vi.fn();
    render(
      <SectionCard
        collapsible
        collapseLabel="Toggle output"
        tabs={[{ id: "out", label: "Compiled SQL" }, { id: "canon", label: "Canonical" }]}
        activeTab="out"
        onTabChange={onTabChange}
      ><p>payload</p></SectionCard>,
    );
    const chevron = screen.getByRole("button", { name: "Toggle output" });
    expect(chevron.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Compiled SQL" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Canonical" }));
    expect(onTabChange).toHaveBeenCalledWith("canon");   // tab click switches, does NOT collapse
    expect(screen.getByText("payload")).toBeTruthy();
    fireEvent.click(chevron);                              // chevron collapses
    expect(chevron.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("payload")).toBeNull();
  });
```
(既有 7 案不動 —— collapsible-only + title 仍走原分支。)

- [ ] **Step 2: 跑確認 fail** — `pnpm -F web exec vitest run src/components/shared/section-card` → 新案 FAIL。

- [ ] **Step 3: 改 SectionCard 表頭邏輯**

把現有 `collapsible ? (<chevron+title header>) : tabStrip ? … : solo` 改成:collapsible 時再分 tabs / title 兩子路:
```tsx
      {hasHeader ? (
        collapsible ? (
          tabs && tabs.length > 0 ? (
            <div className="flex items-stretch border-b bg-muted/30">
              <button
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                aria-label={collapseLabel}
                className="flex items-center px-3 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
              {tabStrip}
              {action ? <div className="ml-auto flex items-center px-4">{action}</div> : null}
            </div>
          ) : (
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
          )
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
```
並在 props 型別 + 解構加 `collapseLabel?: string;`。其餘(state machine、body、passthrough)不變。

- [ ] **Step 4: 跑全 section-card 案 pass** — 8+1 案全綠(既有 collapsible-only 分支未動)。

- [ ] **Step 5: FragmentBar(spec + 實作)**

`fragment-bar.spec.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FragmentBar } from "./fragment-bar";
describe("FragmentBar", () => {
  it("renders its children as a status strip", () => {
    render(<FragmentBar>WHERE · 0 params</FragmentBar>);
    expect(screen.getByText("WHERE · 0 params")).toBeTruthy();
  });
});
```
`fragment-bar.tsx`:
```tsx
export function FragmentBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 font-mono text-[11px] text-primary">
      {children}
    </div>
  );
}
```

- [ ] **Step 6: 全綠 + commit**
```bash
pnpm -F web exec vitest run src/components/shared/section-card src/components/shared/fragment-bar
pnpm -F web check-types && pnpm -F web lint
git add apps/web/src/components/shared/section-card.tsx apps/web/src/components/shared/section-card.spec.tsx apps/web/src/components/shared/fragment-bar.tsx apps/web/src/components/shared/fragment-bar.spec.tsx
git commit -m "feat(web): SectionCard collapsible+tabs compose + FragmentBar (studio flourishes)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task F2: QueryOutputPanel → tab-strip 表頭 + gold fragment bar

**Files:** Modify `apps/web/src/tools/_filter-builder/query-output-panel.tsx` + `query-output-panel.spec.tsx`(共享,5 工具 sql/jsonb/mongo/pg/es 受惠)。

作法:把現在「body 內的 output/canonical Button 對 + panes」改成 SectionCard 的 **collapsible+tabs 表頭**:
```tsx
    <SectionCard
      collapsible
      collapseLabel={labels.output}
      tabs={[{ id: "output", label: labels.output }, { id: "canonical", label: labels.canonical }]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as "output" | "canonical")}
    >
      {tab === "output" ? (
        labels.compileError ? (
          <p className="font-mono text-sm text-fault">{labels.compileError}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <FragmentBar>◆ {labels.primaryLabel}{labels.secondaryLabel && secondary ? ` · ${labels.secondaryLabel}` : ""}</FragmentBar>
            {/* 原 primary pre + CopyButton + secondary pre,原封搬入(去掉原本各自的 primaryLabel/secondaryLabel <span>,已被 FragmentBar 取代) */}
            …
          </div>
        )
      ) : null}
      {tab === "canonical" ? ( … 原 CanonicalEditor … ) : null}
    </SectionCard>
```
- 移除 body 內的 output/canonical `<Button>` 對(切換移到表頭 tab-strip);`tab`/`setTab` 保留。
- **移除變成 dead 的 `import { Button } from "@rfjs/web-ui/components/button";`(line 3)**(Button 對拔掉後它無其他用途 → 不移除 lint 會掛 `no-unused-vars`);`import { CopyButton }` 保留(primary pre 的 copy 仍用)。
- import `FragmentBar`。
- `query-output-panel.spec.tsx` 更新:**tab 切換**用 `getByRole("button", { name })` + `aria-selected` 斷(tab-strip 是 plain button;例:點 Canonical → primary pre 消失、CanonicalEditor 出現)。**collapse** 斷言避開同名衝突(表頭同時有 aria-label=collapseLabel 的 chevron 與同標籤的 tab)——用 `screen.getByRole("button", { expanded: true })` 抓 chevron(它是唯一帶 `aria-expanded` 的),點它後斷 primary 文字消失 + `{ expanded: false }`。**勿用 `getByRole("button", { name: labels.output })`**(chevron 與 output tab 同名 → Found multiple elements)。

- [ ] **Step 1:** 改 query-output-panel.tsx(tab-strip + FragmentBar,collapse 保留)。
- [ ] **Step 2:** 更新 spec(tab 切換 + collapse via `{expanded}` selector);跑 `pnpm -F web exec vitest run src/tools/_filter-builder/query-output-panel` 綠。
- [ ] **Step 3:** 跑 5 個消費工具(sql/jsonb/mongo/pg/es -query/-filter-builder)vitest 綠;check-types/lint。
- [ ] **Step 4:** commit `feat(web): tab-strip header + gold fragment bar on the compiled-query output`(+ trailer)。

---

### Task F3: Filter Logic dashed 容器 + generators/decision-table gold bar

**Files:** 6 filter builder 的 ui.tsx(Filter Logic 卡);jsonb-query-generator / mongo-query-generator 的 ui.tsx(輸出);decision-table 的 ui.tsx(求值結果)。

1. **6 filter builder 的 Filter Logic 卡** —— **body-only 編輯,勿重寫整個 SectionCard open-tag**(每張卡的既有 props:`title`/`className="fb-rise"`/`style`,**以及 data-filter-builder 獨有的 `action`** 都要原封保留)。對每張卡只做兩件事:
   - (a) 把 `bodyClassName` 由 `"overflow-x-auto p-5 sm:p-6"` 改為 `"p-4"`;
   - (b) 把既有的 `<FilterTreeEditor …/>` child 包一層 dashed:`<div className="overflow-x-auto rounded-lg border border-dashed border-input p-4"><FilterTreeEditor …/></div>`。
```tsx
    // 一般(5 個):
    <SectionCard title={t("<pfx>FilterLogic")} className="fb-rise" style={{ animationDelay: "…" }} bodyClassName="p-4">
      <div className="overflow-x-auto rounded-lg border border-dashed border-input p-4">
        <FilterTreeEditor … />
      </div>
    </SectionCard>
```
(`overflow-x-auto` 移到 dashed 容器,tree 仍可橫向捲動、不裁切。)
   - **data-filter-builder 例外(唯一帶 action 的)**:其 Filter Logic 卡有 `action={<span…>{live.count} / {fb.rows.length} {t("dfbStatLabel")}</span>}`(即時 match 統計,ui.tsx:144-156)—— **原封保留該 `action`**,只做上述 (a)(b)。無 spec 覆蓋此 stat(ui.spec 只斷 DataPanel 的「raw N · matched N」),故 F4 截圖須含 data-filter-builder、目視確認 stat 還在。

2. **jsonb-query-generator / mongo-query-generator 的輸出**:在其輸出卡(產生的查詢字串)的 pre 之前加 `<FragmentBar>◆ {t("<新 key>")}</FragmentBar>`。**需新增專屬 i18n key**(不重用既有 label —— 重用會與該工具已渲染的標籤重複;也不硬編英文):各工具 `messages.ts` 的 `ToolUI` 加(en + zh,唯一前綴):`jqgFragment` = "JSONB WHERE" / "JSONB WHERE";`mqgFragment` = "Mongo query" / "Mongo 查詢"。

3. **decision-table 求值結果**:single-eval / batch-eval 的結果區頂各加 `<FragmentBar>◆ {t("<新 key>")}</FragmentBar>`。**新增專屬 key**(與既有 `dtMatched` 等不重複):`messages.ts` 加 `dctFragmentMatched` = "Matched rule" / "命中規則"(single-eval)、`dctFragmentBatch` = "Batch results" / "批次結果"(batch-eval),en + zh。

- [ ] **Step 1:** 6 filter builder Filter Logic → dashed 容器;跑各工具 vitest(斷言若查 tree 容器 class 則更新)。
- [ ] **Step 2:** 先在 3 個工具的 `messages.ts` 加上述 FragmentBar 專屬 key(en + zh,兩 locale key 集相等);再於 2 generators + decision-table 輸出加 `<FragmentBar>`;跑其 vitest。
- [ ] **Step 3:** check-types/lint;commit `feat(web): dashed filter-logic canvas + gold fragment bars on generator/eval outputs`(+ trailer)。

---

### Task F4: changeset 更新 + 全面驗證 + 截圖對照(controller 可直跑)

- [ ] **Step 1:** 更新 `.changeset/web-visual-unification.md` 描述,追加一句涵蓋 flourishes(tab-strip output header / gold fragment bar / dashed filter-logic)。commit `chore: note D2 flourishes in changeset`(+ trailer)。
- [ ] **Step 2:** `pnpm -F web test 2>&1 | grep -E "Test Files|Tests " && pnpm -F web check-types && pnpm -F web lint` — 全綠。
- [ ] **Step 3:** dev server(3174)+ bundled chromium 截圖對照 flourishes mockup:sql-filter-builder(輸出 tab-strip + gold + Filter Logic dashed 展開)、jsonb-query-generator(gold)、decision-table(求值 gold),dark/light。截完 kill。與 `d2-flourishes-dark.png` 對照確認像 mockup。
- [ ] **Step 4:** `git log --oneline main..HEAD && git status` — flourishes 為 4 個新 commit 疊在既有 6 之上。**HOLD**。

---

## Self-Review(已跑)
- **Spec coverage(flourishes)**:tab-strip 表頭(F1 compose + F2 QueryOutputPanel)、gold fragment bar(F1 FragmentBar + F2 輸出 + F3 generators/decision-table)、dashed 次級(F3 Filter Logic)。單視圖卡不動。✓
- **既有不壞**:SectionCard 既有 7 案 + collapsible-only(SampleCard/Section)分支未動,只在 `collapsible && tabs` 加新子路。✓
- **行為保留**:QueryOutputPanel 收合 + output/canonical 切換保留(移到表頭);spec 用 `{expanded}`/`aria-selected` 精確查避免同名 button 衝突。✓
- **Placeholder**:F1 全碼;F2/F3 recipe + 明確檔案/位置。✓
