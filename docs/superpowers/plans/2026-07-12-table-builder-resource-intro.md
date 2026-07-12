# table-builder 資源為中心(Z)+ ToolIntro — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 table-builder 的資料來源收斂成「一份資源(± 協定)+ 預覽(離線/live)」(spec ②),並新增共用 `<ToolIntro>` 摺疊說明區塊接進 table-builder + metadata-builder(spec ③)。一個 apps/web PR。

**Architecture:** 移除 `sourceMode`/`transport` 兩層 toggle;資源 = `fields`+`rows`+選配 `request`/`response`(undefined = 純靜態);`SourcePanel` 重寫為 `ResourcePanel`(Seed 三選一:匯入 meta.json / 貼 rows / 範例資源 + 離線/live 預覽切換);協定加/移除 = ProtocolPanel 既有 enable switch。離線 fetcher 一律吃資源自己的 `rows`/`fields`(修掉 SAMPLE_ROWS 資料分岔)。`<ToolIntro>` 為新共用元件(V1 摺疊 callout、localStorage 記狀態),S1 只接兩個工具。

**Tech Stack:** Next.js 16 App Router、next-intl(共享 `ToolUI` namespace)、@rfjs/data-schema(`parseDataResourceMeta`/`inferFieldsFromRows`)、@rfjs/data-schema-ui(`ProtocolPanel`)、@rfjs/table-builder(-ui)、Vitest + @testing-library/react。

**Specs:** `docs/superpowers/specs/2026-07-12-table-builder-resource-source-design.md`(②)、`docs/superpowers/specs/2026-07-12-tool-intro-block-design.md`(③)

## Global Constraints

- Worktree:`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-table-builder-resource`(branch `feat-table-builder-resource`,基於 #250 後的 main)。所有指令在此執行。
- 只動 `apps/web`,**無 packages/* 變更**;changeset:`web` patch 一份(Task 5)。
- Commit 英文 conventional commits,trailer:`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- **Z 核心紅線**:離線 fetcher 必須 `makeFakeFetcher(rows, config.columns, fields)`(資源自己的 state)——**不得**照抄現行的 `SAMPLE_ROWS`/`SAMPLE_META.fields` 常數(spec ② 明載的資料分岔陷阱)。
- **預設狀態變更(刻意)**:範例資源含協定 → 預設 source = remote + 離線假 fetcher(async,120ms)。既有同步斷言的測試必須轉 `await waitFor`/`findBy`。
- **i18n {count} 陷阱**:交給元件自行substitution 的 raw 模板(如 `tbPageOf`)用 `t.raw`;由 `t()` 帶 values 的(如新的 `tbFieldsSummary`)直接 `t(key, {count})` 沒問題。en 與 zh-TW 兩個 locale 都要加。
- **vitest filter 陷阱**:filter 用純子字串;不要 `-- <filter>`(pnpm 轉發字面 `--` 會讓 filter 失效)。
- pre-commit hook 跑 `turbo run lint-staged test --affected`,commit 慢是正常;不得 `--no-verify`。
- 不開 PR、不 push —— 完成後 HOLD,由使用者說「PR」。

---

### Task 0: Worktree setup(一次性,controller 可直跑)

- [ ] **Step 1: 安裝 + build + 基線**

```bash
cd /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-table-builder-resource
pnpm install
pnpm build:packages
pnpm -F web test 2>&1 | grep -E "Test Files|Tests "
```

Expected: install/build 成功;web 基線全綠(78 files / 408 tests)。

---

### Task 1: `<ToolIntro>` 共用元件

**Files:**
- Create: `apps/web/src/components/shared/tool-intro.tsx`
- Create: `apps/web/src/components/shared/tool-intro.spec.tsx`

**Interfaces:**
- Consumes: 無(獨立元件;React + localStorage)。
- Produces: `ToolIntro({ storageKey, question, tagline?, concepts, labels, dismissible? })`、`ToolIntroConcept { term, desc }`、`ToolIntroLabels { expand, collapse, dismiss }` —— Task 4 兩個工具照此接。

- [ ] **Step 1: 寫 failing spec**

`apps/web/src/components/shared/tool-intro.spec.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ToolIntro } from "./tool-intro";

const LABELS = { expand: "Expand", collapse: "Collapse", dismiss: "Dismiss" };
const CONCEPTS = [
  { term: "Resource", desc: "A DataResourceMeta." },
  { term: "Protocol", desc: "With = queryable; without = static rows." },
  { term: "Preview", desc: "Offline sample or live endpoint." },
];

function renderIntro() {
  return render(
    <ToolIntro
      storageKey="tool-intro:test"
      question="How does this tool work?"
      tagline="One resource → config → preview"
      concepts={CONCEPTS}
      labels={LABELS}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("ToolIntro", () => {
  it("renders collapsed by default: question visible, concept descriptions hidden", () => {
    renderIntro();
    expect(screen.getByText("How does this tool work?")).toBeTruthy();
    expect(screen.queryByText("A DataResourceMeta.")).toBeNull();
    expect(screen.getByRole("button", { name: /how does this tool work/i }).getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking the header expands the concepts and toggles aria-expanded", () => {
    renderIntro();
    fireEvent.click(screen.getByRole("button", { name: /how does this tool work/i }));
    expect(screen.getByText("A DataResourceMeta.")).toBeTruthy();
    expect(screen.getByText("Resource")).toBeTruthy();
    expect(screen.getByRole("button", { name: /how does this tool work/i }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Collapse")).toBeTruthy();
  });

  it("dismiss hides the block and persists to localStorage", () => {
    renderIntro();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("How does this tool work?")).toBeNull();
    const stored = JSON.parse(localStorage.getItem("tool-intro:test") ?? "{}");
    expect(stored.dismissed).toBe(true);
  });

  it("restores open state from localStorage", async () => {
    localStorage.setItem("tool-intro:test", JSON.stringify({ open: true, dismissed: false }));
    renderIntro();
    expect(await screen.findByText("A DataResourceMeta.")).toBeTruthy();
  });

  it("restores dismissed state from localStorage (renders nothing)", async () => {
    localStorage.setItem("tool-intro:test", JSON.stringify({ open: false, dismissed: true }));
    renderIntro();
    // dismissal applies after the mount-restore effect
    expect(screen.queryByText("How does this tool work?")).toBeNull();
  });

  it("corrupted stored JSON falls back to defaults (collapsed, visible)", () => {
    localStorage.setItem("tool-intro:test", "not-json{");
    renderIntro();
    expect(screen.getByText("How does this tool work?")).toBeTruthy();
    expect(screen.queryByText("A DataResourceMeta.")).toBeNull();
  });

  it("persists open state after toggling (restore-before-persist holds)", () => {
    renderIntro();
    fireEvent.click(screen.getByRole("button", { name: /how does this tool work/i }));
    const stored = JSON.parse(localStorage.getItem("tool-intro:test") ?? "{}");
    expect(stored.open).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

```bash
pnpm -F web exec vitest run src/components/shared/tool-intro
```

Expected: FAIL —— `Cannot find module './tool-intro'`(或等價 resolve 錯誤)。

- [ ] **Step 3: 實作元件**

`apps/web/src/components/shared/tool-intro.tsx`:

```tsx
"use client";

import * as React from "react";

export interface ToolIntroConcept {
  term: string;
  desc: string;
}

export interface ToolIntroLabels {
  expand: string;
  collapse: string;
  dismiss: string;
}

interface StoredState {
  open: boolean;
  dismissed: boolean;
}

/**
 * Collapsible "how does this tool work?" callout (design spec ③, V1): one summary line when
 * collapsed, a small concept grid when expanded, dismissible with the state remembered in
 * localStorage. First shared in-body explanation block in the tool suite -- keep it this light.
 */
export function ToolIntro({
  storageKey,
  question,
  tagline,
  concepts,
  labels,
  dismissible = true,
}: {
  storageKey: string;
  question: string;
  tagline?: string;
  concepts: ToolIntroConcept[];
  labels: ToolIntroLabels;
  dismissible?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const restoredRef = React.useRef(false);

  // Restore-before-persist (metadata-builder's established localStorage pattern): read once on
  // mount, and never write until the read happened -- otherwise the first render's defaults
  // would clobber the stored state.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StoredState>;
        if (typeof stored.open === "boolean") setOpen(stored.open);
        if (typeof stored.dismissed === "boolean") setDismissed(stored.dismissed);
      }
    } catch {
      // corrupted storage -> defaults
    }
    restoredRef.current = true;
  }, [storageKey]);

  React.useEffect(() => {
    if (!restoredRef.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ open, dismissed }));
    } catch {
      // storage unavailable (private mode) -> non-persistent but functional
    }
  }, [storageKey, open, dismissed]);

  if (dismissed) return null;

  return (
    <div className="rounded-md border border-input px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary"
        >
          i
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left text-sm"
        >
          <span className="font-medium">{question}</span>
          {tagline ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">{tagline}</span>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {open ? labels.collapse : labels.expand}
          </span>
        </button>
        {dismissible ? (
          <button
            type="button"
            aria-label={labels.dismiss}
            onClick={() => setDismissed(true)}
            className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2 grid gap-2 border-t border-dashed border-input pt-2 sm:grid-cols-3">
          {concepts.map((c) => (
            <div key={c.term}>
              <p className="text-xs font-semibold text-primary">{c.term}</p>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認 pass + lint/types**

```bash
pnpm -F web exec vitest run src/components/shared/tool-intro
pnpm -F web check-types && pnpm -F web lint
```

Expected: 7/7 PASS;types/lint 乾淨。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/tool-intro.tsx apps/web/src/components/shared/tool-intro.spec.tsx
git commit -m "feat(web): shared ToolIntro collapsible explanation block

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `ResourcePanel` 元件(獨立,未接線)

**Files:**
- Create: `apps/web/src/tools/table-builder/resource-panel.tsx`
- Create: `apps/web/src/tools/table-builder/resource-panel.spec.tsx`

(本 task **不動** ui.tsx/source-panel —— 新舊面板暫時並存,Task 3 才切換並刪舊。)

**Interfaces:**
- Consumes: `parseImport`(`./import`,既有)、`parseDataResourceMeta`(`@rfjs/data-schema`)。
- Produces(Task 3 依賴,簽名必須一字不差):
  - `type SeedMode = "meta" | "rows" | "sample"`
  - `type PreviewMode = "offline" | "live"`
  - `ResourcePanel(props: ResourcePanelProps)`,其中 `ResourcePanelProps = { labels: ResourcePanelLabels; importLabels: ResourcePanelImportLabels; onImportRows: (rows: Record<string, unknown>[]) => void; onImportMeta: (meta: DataResourceMeta) => void; onSampleReset: () => void; defaultRowsText?: string; hasProtocol: boolean; preview: PreviewMode; onPreviewChange: (p: PreviewMode) => void }`
  - `ResourcePanelLabels = { title; seedMeta; seedRows; seedSample; metaPlaceholder; metaHint; metaInvalid; sampleHint; sampleLoad; fieldsSummary; protoHint; previewLabel; previewOffline; previewLive }`(全 string;`fieldsSummary` 由呼叫端先 `t()` 代入 count)
  - `ResourcePanelImportLabels = { paste; upload; load; json; csv }`(同今日 SourcePanelImportLabels)

- [ ] **Step 1: 寫 failing spec**

`apps/web/src/tools/table-builder/resource-panel.spec.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResourcePanel } from "./resource-panel";
import type { ResourcePanelProps } from "./resource-panel";

const LABELS = {
  title: "Data resource",
  seedMeta: "Import meta.json",
  seedRows: "Paste rows",
  seedSample: "Sample resource",
  metaPlaceholder: "Paste a DataResourceMeta…",
  metaHint: "Fields + protocol come from the meta; rows stay.",
  metaInvalid: "Invalid JSON.",
  sampleHint: "Reset to the built-in sample resource.",
  sampleLoad: "Load sample",
  fieldsSummary: "7 fields — edit display in the Columns tab",
  protoHint: "With a protocol the resource is queryable; without it, static rows.",
  previewLabel: "Preview via",
  previewOffline: "Sample data (offline)",
  previewLive: "Call endpoint (live)",
};
const IMPORT_LABELS = { paste: "Paste JSON or CSV…", upload: "Upload", load: "Load", json: "JSON", csv: "CSV" };

const META_JSON = JSON.stringify({
  fields: [{ key: "id", label: "ID", dataType: "string" }],
  request: { endpoint: "/api/x", method: "GET", pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" } },
  response: { rowsPath: "data.items" },
});

function renderPanel(over: Partial<ResourcePanelProps> = {}) {
  const props: ResourcePanelProps = {
    labels: LABELS,
    importLabels: IMPORT_LABELS,
    onImportRows: vi.fn(),
    onImportMeta: vi.fn(),
    onSampleReset: vi.fn(),
    hasProtocol: true,
    preview: "offline",
    onPreviewChange: vi.fn(),
    ...over,
  };
  render(<ResourcePanel {...props} />);
  return props;
}

describe("ResourcePanel seeds", () => {
  it("renders the three seed chips, meta selected by default", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Import meta.json" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Paste rows" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sample resource" })).toBeTruthy();
  });

  it("meta seed: loading a valid DataResourceMeta reports it", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Paste a DataResourceMeta…"), { target: { value: META_JSON } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(props.onImportMeta).toHaveBeenCalledWith(
      expect.objectContaining({ request: expect.objectContaining({ endpoint: "/api/x" }) }),
    );
  });

  it("meta seed: invalid JSON shows the invalid label and reports nothing", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Paste a DataResourceMeta…"), { target: { value: "{oops" } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(screen.getByRole("alert").textContent).toBe("Invalid JSON.");
    expect(props.onImportMeta).not.toHaveBeenCalled();
  });

  it("meta seed: zod-invalid meta surfaces issues[0].message, not the raw JSON blob", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Paste a DataResourceMeta…"), { target: { value: JSON.stringify({ fields: "nope" }) } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    const alert = screen.getByRole("alert").textContent ?? "";
    expect(alert.startsWith("[")).toBe(false);
    expect(alert.length).toBeGreaterThan(0);
    expect(props.onImportMeta).not.toHaveBeenCalled();
  });

  it("rows seed: loading valid pasted JSON reports the parsed rows", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Paste rows" }));
    fireEvent.change(screen.getByPlaceholderText("Paste JSON or CSV…"), { target: { value: '[{"a":1}]' } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(props.onImportRows).toHaveBeenCalledWith([{ a: 1 }]);
  });

  it("rows seed: CSV format chip parses typed rows", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Paste rows" }));
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    fireEvent.change(screen.getByPlaceholderText("Paste JSON or CSV…"), { target: { value: "a,b\n1,x" } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(props.onImportRows).toHaveBeenCalledWith([{ a: 1, b: "x" }]);
  });

  it("rows seed: pre-fills the paste box with defaultRowsText", () => {
    renderPanel({ defaultRowsText: '[{"seed":true}]' });
    fireEvent.click(screen.getByRole("button", { name: "Paste rows" }));
    expect(screen.getByDisplayValue('[{"seed":true}]')).toBeTruthy();
  });

  it("upload stays a label-wrapped file input (no accessible-name collision with Load)", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: "Upload" })).toBeNull();
    expect(screen.getByText("Upload")).toBeTruthy();
  });

  it("sample seed: shows the hint and reports reset on click", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Sample resource" }));
    expect(screen.getByText("Reset to the built-in sample resource.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load sample" }));
    expect(props.onSampleReset).toHaveBeenCalled();
  });
});

describe("ResourcePanel preview toggle", () => {
  it("shows offline/live only when the resource has a protocol, and reports changes", () => {
    const props = renderPanel({ hasProtocol: true, preview: "offline" });
    expect(screen.getByRole("button", { name: "Sample data (offline)" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Call endpoint (live)" }));
    expect(props.onPreviewChange).toHaveBeenCalledWith("live");
  });

  it("without a protocol the preview row is absent and the proto hint shows", () => {
    renderPanel({ hasProtocol: false });
    expect(screen.queryByRole("button", { name: "Call endpoint (live)" })).toBeNull();
    expect(screen.getByText(/With a protocol the resource is queryable/)).toBeTruthy();
  });

  it("renders the fields summary line", () => {
    renderPanel();
    expect(screen.getByText("7 fields — edit display in the Columns tab")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

```bash
pnpm -F web exec vitest run src/tools/table-builder/resource-panel
```

Expected: FAIL —— `Cannot find module './resource-panel'`。

- [ ] **Step 3: 實作元件**

`apps/web/src/tools/table-builder/resource-panel.tsx`:

```tsx
"use client";

import * as React from "react";

import { parseDataResourceMeta } from "@rfjs/data-schema";
import type { DataResourceMeta } from "@rfjs/data-schema";

import { parseImport } from "./import";
import type { ImportFormat } from "./import";

/** Seed = where this resource comes from (design spec ② Z-model). */
export type SeedMode = "meta" | "rows" | "sample";
/** How the always-on preview fetches: simulate the protocol offline vs call the endpoint. */
export type PreviewMode = "offline" | "live";

export interface ResourcePanelLabels {
  title: string;
  seedMeta: string;
  seedRows: string;
  seedSample: string;
  metaPlaceholder: string;
  metaHint: string;
  metaInvalid: string;
  sampleHint: string;
  sampleLoad: string;
  /** Pre-substituted by the caller (t() with {count}). */
  fieldsSummary: string;
  protoHint: string;
  previewLabel: string;
  previewOffline: string;
  previewLive: string;
}

export interface ResourcePanelImportLabels {
  paste: string;
  upload: string;
  load: string;
  json: string;
  csv: string;
}

export interface ResourcePanelProps {
  labels: ResourcePanelLabels;
  importLabels: ResourcePanelImportLabels;
  onImportRows: (rows: Record<string, unknown>[]) => void;
  onImportMeta: (meta: DataResourceMeta) => void;
  onSampleReset: () => void;
  /** Initial paste-box contents for the rows seed (e.g. the sample rows as JSON). */
  defaultRowsText?: string;
  hasProtocol: boolean;
  preview: PreviewMode;
  onPreviewChange: (p: PreviewMode) => void;
}

function segmentClass(active: boolean): string {
  return [
    "rounded-md border px-2 py-1 text-xs",
    active ? "border-primary bg-primary/10 font-medium" : "border-input text-muted-foreground",
  ].join(" ");
}

export function ResourcePanel({
  labels,
  importLabels,
  onImportRows,
  onImportMeta,
  onSampleReset,
  defaultRowsText,
  hasProtocol,
  preview,
  onPreviewChange,
}: ResourcePanelProps) {
  const [seed, setSeed] = React.useState<SeedMode>("meta");
  const [format, setFormat] = React.useState<ImportFormat>("json");
  const [metaText, setMetaText] = React.useState("");
  const [rowsText, setRowsText] = React.useState(defaultRowsText ?? "");
  const [error, setError] = React.useState<string | null>(null);

  function switchSeed(next: SeedMode) {
    setSeed(next);
    setError(null);
  }

  function runMetaLoad(nextText: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(nextText);
    } catch {
      setError(labels.metaInvalid);
      return;
    }
    try {
      const meta = parseDataResourceMeta(parsed);
      setError(null);
      onImportMeta(meta);
    } catch (err) {
      // zod v4 err.message is a JSON issues array (first line "[") -- surface issues[0].message
      // instead (metadata-builder import-panel's established handling).
      const issues = (err as { issues?: { message?: string }[] }).issues;
      setError(issues?.[0]?.message ?? labels.metaInvalid);
    }
  }

  function runRowsLoad(nextText: string, nextFormat: ImportFormat) {
    const result = parseImport(nextText, nextFormat);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onImportRows(result.rows);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      if (seed === "meta") {
        setMetaText(content);
        runMetaLoad(content);
        return;
      }
      const nextFormat: ImportFormat = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
      setFormat(nextFormat);
      setRowsText(content);
      runRowsLoad(content, nextFormat);
    };
    reader.readAsText(file);
  }

  const accept = seed === "meta" ? ".json" : ".json,.csv";

  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-semibold">{labels.title}</p>
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {(
            [
              { id: "meta", label: labels.seedMeta },
              { id: "rows", label: labels.seedRows },
              { id: "sample", label: labels.seedSample },
            ] as { id: SeedMode; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={seed === item.id}
              className={segmentClass(seed === item.id)}
              onClick={() => switchSeed(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {seed === "meta" ? (
          <div className="flex flex-col gap-2 border-t pt-2">
            <textarea
              value={metaText}
              onChange={(e) => setMetaText(e.target.value)}
              placeholder={labels.metaPlaceholder}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-1.5 py-1 text-xs"
            />
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs text-muted-foreground">
                {importLabels.upload}
                <input type="file" accept={accept} className="hidden" onChange={handleFileChange} />
              </label>
              <button
                type="button"
                className="rounded-md border border-primary px-2 py-1 text-xs font-medium"
                onClick={() => runMetaLoad(metaText)}
              >
                {importLabels.load}
              </button>
              <span className="text-xs text-muted-foreground">{labels.metaHint}</span>
            </div>
          </div>
        ) : null}

        {seed === "rows" ? (
          <div className="flex flex-col gap-2 border-t pt-2">
            <div className="flex gap-1">
              <button type="button" className={segmentClass(format === "json")} onClick={() => setFormat("json")}>
                {importLabels.json}
              </button>
              <button type="button" className={segmentClass(format === "csv")} onClick={() => setFormat("csv")}>
                {importLabels.csv}
              </button>
            </div>
            <textarea
              value={rowsText}
              onChange={(e) => setRowsText(e.target.value)}
              placeholder={importLabels.paste}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-1.5 py-1 text-xs"
            />
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs text-muted-foreground">
                {importLabels.upload}
                <input type="file" accept={accept} className="hidden" onChange={handleFileChange} />
              </label>
              <button
                type="button"
                className="rounded-md border border-primary px-2 py-1 text-xs font-medium"
                onClick={() => runRowsLoad(rowsText, format)}
              >
                {importLabels.load}
              </button>
            </div>
          </div>
        ) : null}

        {seed === "sample" ? (
          <div className="flex items-center gap-2 border-t pt-2">
            <button
              type="button"
              className="rounded-md border border-primary px-2 py-1 text-xs font-medium"
              onClick={onSampleReset}
            >
              {labels.sampleLoad}
            </button>
            <span className="text-xs text-muted-foreground">{labels.sampleHint}</span>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-1 border-t pt-2">
          <span className="text-xs text-muted-foreground">{labels.fieldsSummary}</span>
          <span className="text-xs text-muted-foreground">{labels.protoHint}</span>
          {hasProtocol ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{labels.previewLabel}</span>
              <button
                type="button"
                aria-pressed={preview === "offline"}
                className={segmentClass(preview === "offline")}
                onClick={() => onPreviewChange("offline")}
              >
                {labels.previewOffline}
              </button>
              <button
                type="button"
                aria-pressed={preview === "live"}
                className={segmentClass(preview === "live")}
                onClick={() => onPreviewChange("live")}
              >
                {labels.previewLive}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認 pass + types/lint**

```bash
pnpm -F web exec vitest run src/tools/table-builder/resource-panel
pnpm -F web check-types && pnpm -F web lint
```

Expected: 12/12 PASS;types/lint 乾淨(舊 SourcePanel 仍在、未受影響)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/table-builder/resource-panel.tsx apps/web/src/tools/table-builder/resource-panel.spec.tsx
git commit -m "feat(web): table-builder ResourcePanel — seed chips (meta/rows/sample) + offline-live preview toggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: ui.tsx 換 Z 模型 + i18n + 刪 SourcePanel + ui.spec 更新

**Files:**
- Modify: `apps/web/src/tools/table-builder/ui.tsx`
- Modify: `apps/web/src/tools/table-builder/messages.ts`
- Modify: `apps/web/src/tools/table-builder/sample.ts`(刪 `SourceMode` 型別與其 doc comment)
- Modify: `apps/web/src/tools/table-builder/ui.spec.tsx`
- Delete: `apps/web/src/tools/table-builder/source-panel.tsx`、`apps/web/src/tools/table-builder/source-panel.spec.tsx`

**Interfaces:**
- Consumes: Task 2 的 `ResourcePanel`/`PreviewMode`(簽名見 Task 2)、既有 `ProtocolPanel`(`@rfjs/data-schema-ui`,`showEnableToggle` 預設 true = 協定加/移除開關)、`makeFakeFetcher(rows, columns, fields)`、`makeHttpFetcher(request)`、`deriveTableConfig`、`inferFieldsFromRows`、`parseDataResourceMeta`(panel 內)。
- Produces: 工具新狀態模型(後續 Task 4 只在 eyebrow 後插 `<ToolIntro>`,不再動這些)。

- [ ] **Step 1: 更新 ui.spec(failing 先行)**

對 `apps/web/src/tools/table-builder/ui.spec.tsx` 做以下**精確**修改(其餘測試不動):

1a. 「renders SAMPLE_CONFIG's pageSize rows by default (static source)」整個替換為(預設變 remote+離線,async):

```tsx
  it("renders SAMPLE_CONFIG's pageSize rows by default (sample resource, offline preview)", async () => {
    renderTool();

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(1 + SAMPLE_CONFIG.pagination.pageSize);
    });
  });
```

1b. 「switching the data source to remote still renders rows」整個替換為(協定關閉 → 靜態):

```tsx
  it("toggling the protocol off falls back to static rows (still renders)", async () => {
    renderTool();
    // default = sample resource with protocol -> the declare-protocol switch is ON
    fireEvent.click(await screen.findByRole("switch", { name: "declare protocol" }));

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(1 + SAMPLE_CONFIG.pagination.pageSize);
    });
    // without a protocol there is no offline/live preview toggle
    expect(screen.queryByRole("button", { name: /call endpoint/i })).toBeNull();
  });
```

1c. 「editing page size … immediately changes the rendered row count」的最後兩行斷言改 async:

```tsx
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(1 + 3);
    });
```

(函式簽名同步改 `it("editing page size in the pagination panel immediately changes the rendered row count", async () => {` —— `await` 在非 async callback 內是 SyntaxError,會弄壞整檔。)

1d. 「tabs swap the editor panel…」中兩處 `"Data source"` 改為 `"Data resource"`;`{ name: "Columns" }` 不變;末行 row 斷言改:

```tsx
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));
```

(函式簽名同步改 `async () => {`。)

1e. 「metadata tab shows the reverse-projected …」整個替換為(預設含協定;關協定後不含):

```tsx
  it("metadata tab carries the protocol by default and drops it when the protocol is off", async () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Metadata" }));
    const pre = screen.getByTestId("metadata-json");
    expect(pre.textContent).toContain('"fields"');
    expect(pre.textContent).toContain('"request"');

    // turn the protocol off (switch lives on the Resource tab)
    fireEvent.click(screen.getByRole("button", { name: "Resource" }));
    fireEvent.click(screen.getByRole("switch", { name: "declare protocol" }));
    fireEvent.click(screen.getByRole("button", { name: "Metadata" }));
    expect(screen.getByTestId("metadata-json").textContent).not.toContain('"request"');
  });
```

1f. 「fetcher mode: filter section…」移除 `fireEvent.click(... { name: 'Remote' })` 那行(預設已是 remote),其餘不動。

1g. 「remote mode renders the protocol editor…」整個替換為:

```tsx
  it("renders the protocol editor with an editable endpoint by default", async () => {
    renderTool();
    expect(await screen.findByDisplayValue("/api/query/sample")).toBeTruthy();
  });
```

1h. 新增兩個測試(放在 describe("TableBuilderTool") 內):

```tsx
  it("importing rows seeds a protocol-less resource (offline preview queries the imported rows)", async () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Paste rows" }));
    fireEvent.change(screen.getByPlaceholderText("Paste JSON or CSV…"), {
      target: { value: '[{"name":"Imported Row"}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Imported Row");
    // rows import clears the protocol -> switch off, no preview toggle
    expect((screen.getByRole("switch", { name: "declare protocol" }) as HTMLInputElement).getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("button", { name: /call endpoint/i })).toBeNull();
  });

  it("offline preview shows the offline/live toggle when the protocol is on", async () => {
    renderTool();
    expect(await screen.findByRole("button", { name: "Sample data (offline)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Call endpoint (live)" })).toBeTruthy();
  });

  it("importing a meta.json seeds fields + protocol end-to-end", async () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Import meta.json" }));
    fireEvent.change(screen.getByPlaceholderText("Paste a DataResourceMeta (meta.json)…"), {
      target: {
        value: JSON.stringify({
          fields: [{ key: "name", label: "Name", dataType: "string" }],
          request: {
            endpoint: "/api/query/imported",
            method: "GET",
            pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
          },
          response: { rowsPath: "data.items" },
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    // protocol carried in: endpoint editable in the ProtocolPanel, switch stays on
    expect(await screen.findByDisplayValue("/api/query/imported")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "declare protocol" }).getAttribute("aria-checked")).toBe("true");
  });
```

- [ ] **Step 2: 跑 ui.spec 確認 fail**

```bash
pnpm -F web exec vitest run src/tools/table-builder/ui
```

Expected: FAIL(新斷言找不到 Resource tab/switch/seed chips —— 舊 UI 還在)。

- [ ] **Step 3: messages.ts 改 key**

en 的 `ToolUI` 區塊:**刪除** `tbSourcePanelTitle`、`tbSourceStatic`、`tbSourceFetcher`、`tbTransport`、`tbTransportMemory`、`tbTransportHttp`、`tbTabSource`;**新增**:

```ts
      tbTabResource: "Resource",
      tbResourceTitle: "Data resource",
      tbSeedImportMeta: "Import meta.json",
      tbSeedPasteRows: "Paste rows",
      tbSeedSample: "Sample resource",
      tbSeedMetaPlaceholder: "Paste a DataResourceMeta (meta.json)…",
      tbSeedMetaHint: "Fields + protocol come from the meta; rows stay.",
      tbSeedMetaInvalid: "Invalid JSON.",
      tbSeedSampleHint: "Reset to the built-in sample resource.",
      tbSeedSampleLoad: "Load sample",
      tbFieldsSummary: "{count} fields — edit display in the Columns tab",
      tbProtoHint: "With a protocol the resource is queryable; without it, it's static rows.",
      tbPreviewData: "Preview via",
      tbPreviewOffline: "Sample data (offline)",
      tbPreviewLive: "Call endpoint (live)",
```

zh-TW 的 `ToolUI` 區塊同樣刪那 7 個 key,新增:

```ts
      tbTabResource: "資源",
      tbResourceTitle: "資料資源",
      tbSeedImportMeta: "匯入 meta.json",
      tbSeedPasteRows: "貼上 rows",
      tbSeedSample: "範例資源",
      tbSeedMetaPlaceholder: "貼上 DataResourceMeta(meta.json)…",
      tbSeedMetaHint: "帶入 fields 與協定;rows 維持現狀。",
      tbSeedMetaInvalid: "JSON 格式錯誤。",
      tbSeedSampleHint: "重設為內建的範例資源。",
      tbSeedSampleLoad: "載入範例",
      tbFieldsSummary: "共 {count} 個欄位 —— 顯示設定在「欄位」分頁",
      tbProtoHint: "有協定 = 可查詢資源;無協定 = 純靜態 rows。",
      tbPreviewData: "預覽取數",
      tbPreviewOffline: "範本資料(離線)",
      tbPreviewLive: "呼叫端點(live)",
```

- [ ] **Step 4: sample.ts 刪 SourceMode**

刪除 `sample.ts` 的 `export type SourceMode = "rows" | "remote";` 及其上方 `/** Editor source-panel state … */` doc comment(其餘不動)。

- [ ] **Step 5: ui.tsx 換 Z 模型**

對 `ui.tsx` 做以下精確修改:

5a. imports:

```tsx
// 刪:
import { SAMPLE_CONFIG, SAMPLE_META, SAMPLE_ROWS } from "./sample";
import type { SourceMode } from "./sample";
import { makeFakeFetcher } from "./fake-fetcher";
import { SourcePanel } from "./source-panel";
// 增(SAMPLE_* import 保留原行,去掉 SourceMode 型別行;SourcePanel 換 ResourcePanel):
import { SAMPLE_CONFIG, SAMPLE_META, SAMPLE_ROWS } from "./sample";
import { makeFakeFetcher } from "./fake-fetcher";
import { ResourcePanel } from "./resource-panel";
import type { PreviewMode } from "./resource-panel";
```

並在 `@rfjs/data-schema` 型別 import 行加 `DataFieldMeta` 與 `DataResourceMeta`:

```tsx
import type { DataFieldMeta, DataResourceMeta, RequestMeta, ResponseMeta } from "@rfjs/data-schema";
```

5b. state(替換 `sourceMode`/`transport`/`request`/`response` 四行):

```tsx
  const [request, setRequest] = React.useState<RequestMeta | undefined>(SAMPLE_META.request);
  const [response, setResponse] = React.useState<ResponseMeta | undefined>(SAMPLE_META.response);
  const [fields, setFields] = React.useState<DataFieldMeta[]>(SAMPLE_META.fields);
  const [preview, setPreview] = React.useState<PreviewMode>("offline");
```

(`rows`/`dataVersion` 不動。)並在 state 之後加:

```tsx
  const hasProtocol = request !== undefined && response !== undefined;
```

5c. `sourcePanelLabels` memo 整個替換為:

```tsx
  const resourcePanelLabels = React.useMemo(
    () => ({
      title: t("tbResourceTitle"),
      seedMeta: t("tbSeedImportMeta"),
      seedRows: t("tbSeedPasteRows"),
      seedSample: t("tbSeedSample"),
      metaPlaceholder: t("tbSeedMetaPlaceholder"),
      metaHint: t("tbSeedMetaHint"),
      metaInvalid: t("tbSeedMetaInvalid"),
      sampleHint: t("tbSeedSampleHint"),
      sampleLoad: t("tbSeedSampleLoad"),
      fieldsSummary: t("tbFieldsSummary", { count: fields.length }),
      protoHint: t("tbProtoHint"),
      previewLabel: t("tbPreviewData"),
      previewOffline: t("tbPreviewOffline"),
      previewLive: t("tbPreviewLive"),
    }),
    [t, fields.length],
  );
```

5d. `source` memo 整個替換為(**Z 紅線:吃資源自己的 rows/fields**):

```tsx
  // One data truth (design spec ② Z-model): the offline fetcher simulates the protocol over the
  // RESOURCE's own rows/fields -- never the SAMPLE_* constants (the pre-Z divergence trap where
  // imported rows and the in-memory preview queried different data).
  const source: TableSource = React.useMemo(() => {
    if (!request || !response) return { kind: "rows", rows };
    return {
      kind: "remote",
      request,
      response,
      fields,
      fetch:
        preview === "live"
          ? makeHttpFetcher(request)
          : makeFakeFetcher(rows, config.columns, fields),
    };
  }, [request, response, preview, config.columns, rows, fields]);
```

5e. `metaRequest`/`metaResponse` 兩行替換為直接傳遞:

```tsx
  // Metadata tab carries whatever protocol the resource declares (undefined = none).
  const metaRequest: RequestMeta | undefined = request;
  const metaResponse: ResponseMeta | undefined = response;
```

5f. `handleImport` 替換 + 新增兩個 handler:

```tsx
  function handleImportRows(nextRows: Record<string, unknown>[]) {
    const nextFields = inferFieldsFromRows(nextRows);
    setFields(nextFields);
    setConfig(deriveTableConfig({ fields: nextFields }));
    setRows(nextRows);
    // pasted rows seed a NEW protocol-less resource (design spec ②) -- re-add via the switch
    setRequest(undefined);
    setResponse(undefined);
    setPreview("offline");
    setDataVersion((v) => v + 1);
  }

  function handleImportMeta(meta: DataResourceMeta) {
    setFields(meta.fields);
    setRequest(meta.request);
    setResponse(meta.response);
    setConfig(deriveTableConfig(meta));
    setPreview("offline");
    setDataVersion((v) => v + 1);
  }

  function handleSampleReset() {
    setFields(SAMPLE_META.fields);
    setRows(SAMPLE_ROWS);
    setRequest(SAMPLE_META.request);
    setResponse(SAMPLE_META.response);
    setConfig(SAMPLE_CONFIG);
    setPreview("offline");
    setDataVersion((v) => v + 1);
  }
```

5g. tabs 陣列的 `{ id: "source", label: t("tbTabSource") }` 改為 `{ id: "source", label: t("tbTabResource") }`(EditorTab 型別的 `"source"` id 不用改 —— 只是顯示文字)。

5h. source tab 的 JSX 整個替換為:

```tsx
      {tab === "source" ? (
        <>
          <ResourcePanel
            labels={resourcePanelLabels}
            importLabels={importLabels}
            onImportRows={handleImportRows}
            onImportMeta={handleImportMeta}
            onSampleReset={handleSampleReset}
            defaultRowsText={SAMPLE_JSON}
            hasProtocol={hasProtocol}
            preview={preview}
            onPreviewChange={setPreview}
          />
          <ProtocolPanel
            request={request}
            response={response}
            onChange={(n) => {
              setRequest(n.request);
              setResponse(n.response);
            }}
            labels={protocolLabels}
          />
        </>
      ) : null}
```

(注意:`showEnableToggle` 拿掉 → 預設 true,switch 即「加上/移除協定」;onChange 直接設值,允許 undefined。)

5i. ConfigTable `key` 改為:

```tsx
          key={`${hasProtocol ? "remote" : "rows"}:${config.pagination.pageSize}:${dataVersion}`}
```

(**`preview` 刻意不進 key** —— `source` memo(5d)的 deps 已含 `preview`,offline↔live 切換會改變 `source` identity,`useConfigTable` 的 fetch effect 自動 refetch **而不 remount**,保住使用者的 filter tree/已套用篩選/頁碼/每頁筆數 —— 與今日 memory↔http 切換的行為對齊(spec ②「誠實改名」)。只有協定加/移除(hasProtocol)與重新匯入(dataVersion)才 remount。)

- [ ] **Step 6: 刪舊面板**

刪除 `apps/web/src/tools/table-builder/source-panel.tsx` 與 `source-panel.spec.tsx`。

- [ ] **Step 7: 全綠驗證**

```bash
pnpm -F web exec vitest run src/tools/table-builder
pnpm -F web check-types && pnpm -F web lint && pnpm -F web test 2>&1 | grep -E "Test Files|Tests "
grep -rn "SourceMode\|tbTransport\|tbSourceStatic\|tbSourceFetcher\|source-panel" apps/web/src ; echo "leftover exit=$?"
```

Expected: table-builder 測試全 PASS;web 全套綠;grep 無輸出、exit=1。

- [ ] **Step 8: Commit**

```bash
git add -A apps/web/src/tools/table-builder
git commit -m "feat(web): table-builder resource-centric source — one resource (± protocol), offline/live preview

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: ToolIntro 接線(table-builder + metadata-builder)+ 文案

**Files:**
- Modify: `apps/web/src/tools/table-builder/ui.tsx`(eyebrow 後插 ToolIntro)
- Modify: `apps/web/src/tools/table-builder/messages.ts`(intro 文案 + 控制 label)
- Modify: `apps/web/src/tools/metadata-builder/ui.tsx`(eyebrow 後插 ToolIntro)
- Modify: `apps/web/src/tools/metadata-builder/messages.ts`(intro 文案;控制 label 重用 tb 的)
- Modify: `apps/web/src/tools/table-builder/ui.spec.tsx`、`apps/web/src/tools/metadata-builder/ui.spec.tsx`(各加一個接線測試)

**Interfaces:**
- Consumes: Task 1 的 `ToolIntro`/`ToolIntroLabels`。跨工具 key 重用前例:tb 已重用 `mb*`(protocolLabels),故 metadata-builder 重用 `tbIntroQuestion`/`tbIntroExpand`/`tbIntroCollapse`/`tbIntroDismiss` 合法(同一 `ToolUI` namespace)。
- Produces: 無後續依賴。

- [ ] **Step 1: 兩個 ui.spec 各加 failing 測試**

**斷言原則:展開驗證必須鎖定「只在展開後的 concepts grid 出現、且全頁唯一」的字串** —— tagline 收合時就可見(斷它 = 空洞測試);「meta.json」在 metadata-builder 的 code panel tab/下載鈕/tagline 多處出現(`getByText(/meta\.json/i)` 會 Found multiple elements 直接炸)。

`table-builder/ui.spec.tsx`(describe("TableBuilderTool") 內):

```tsx
  it("renders the collapsible ToolIntro and expands to the concepts", () => {
    renderTool();
    const header = screen.getByRole("button", { name: /how does this tool work/i });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/A DataResourceMeta\. Seed it/)).toBeNull();
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/A DataResourceMeta\. Seed it/)).toBeTruthy();
  });
```

`metadata-builder/ui.spec.tsx`(主 describe 內;沿用該檔既有 render helper 與 imports):

```tsx
  it("renders the collapsible ToolIntro and expands to the concepts", () => {
    renderTool();
    const header = screen.getByRole("button", { name: /how does this tool work/i });
    expect(screen.queryByText("Field kinds, data types, enum domains, filterability.")).toBeNull();
    fireEvent.click(header);
    expect(screen.getByText("Field kinds, data types, enum domains, filterability.")).toBeTruthy();
  });
```

(若該檔 render helper 名稱不同,沿用其既有名稱;若尚未 import `fireEvent`,補上。)

- [ ] **Step 2: 跑兩檔確認新測試 fail**

```bash
pnpm -F web exec vitest run src/tools/table-builder/ui src/tools/metadata-builder/ui
```

Expected: 兩個新測試 FAIL(找不到 intro header),其餘 PASS。

- [ ] **Step 3: messages 文案**

`table-builder/messages.ts` en `ToolUI` 加:

```ts
      tbIntroQuestion: "How does this tool work?",
      tbIntroExpand: "Expand",
      tbIntroCollapse: "Collapse",
      tbIntroDismiss: "Dismiss",
      tbIntroTagline: "One resource (± protocol) → table config → preview",
      tbIntroC1t: "① Resource",
      tbIntroC1d: "A DataResourceMeta. Seed it by importing meta.json, pasting rows, or the sample.",
      tbIntroC2t: "② Protocol",
      tbIntroC2d: "With a protocol the resource is queryable (endpoint); without it, static rows.",
      tbIntroC3t: "③ Preview",
      tbIntroC3d: "Offline simulates the protocol over the sample rows; live calls the endpoint.",
```

zh-TW 加:

```ts
      tbIntroQuestion: "這個工具怎麼運作?",
      tbIntroExpand: "展開",
      tbIntroCollapse: "收合",
      tbIntroDismiss: "關閉",
      tbIntroTagline: "一份資源(± 協定)→ 表格設定 → 預覽",
      tbIntroC1t: "① 資源",
      tbIntroC1d: "一份 DataResourceMeta。來源:匯入 meta.json、貼上 rows,或範例資源。",
      tbIntroC2t: "② 協定",
      tbIntroC2d: "有協定 = 可查詢(打 endpoint);無協定 = 純靜態 rows。",
      tbIntroC3t: "③ 預覽",
      tbIntroC3d: "離線 = 對範本資料模擬協定;live = 真打端點取數。",
```

`metadata-builder/messages.ts` en `ToolUI` 加(question/控制 label 重用 tb 的,不重複定義):

```ts
      mbIntroTagline: "Author a resource's metadata → hand off meta.json",
      mbIntroC1t: "① Fields",
      mbIntroC1d: "Field kinds, data types, enum domains, filterability.",
      mbIntroC2t: "② Protocol",
      mbIntroC2d: "The request/response contract — try it against a live endpoint.",
      mbIntroC3t: "③ Hand-off",
      mbIntroC3d: "Export meta.json for any consumer (e.g. the Table Builder).",
```

zh-TW 加:

```ts
      mbIntroTagline: "編一份資源 metadata → 交付 meta.json",
      mbIntroC1t: "① 欄位",
      mbIntroC1d: "欄位種類、資料型別、enum 選項、可否篩選。",
      mbIntroC2t: "② 協定",
      mbIntroC2d: "request/response 契約 —— 可對真端點試打。",
      mbIntroC3t: "③ 交付",
      mbIntroC3d: "匯出 meta.json 給任何 consumer(例如表格建構器)。",
```

- [ ] **Step 4: 兩個 ui.tsx 接線**

`table-builder/ui.tsx`:import 加 `import { ToolIntro } from "@/components/shared/tool-intro";`,eyebrow `<p>` 之後插:

```tsx
      <ToolIntro
        storageKey="tool-intro:table-builder"
        question={t("tbIntroQuestion")}
        tagline={t("tbIntroTagline")}
        concepts={[
          { term: t("tbIntroC1t"), desc: t("tbIntroC1d") },
          { term: t("tbIntroC2t"), desc: t("tbIntroC2d") },
          { term: t("tbIntroC3t"), desc: t("tbIntroC3d") },
        ]}
        labels={{ expand: t("tbIntroExpand"), collapse: t("tbIntroCollapse"), dismiss: t("tbIntroDismiss") }}
      />
```

`metadata-builder/ui.tsx`:同樣 import,eyebrow `<p>` 之後插(question/控制 label 用 tb key):

```tsx
      <ToolIntro
        storageKey="tool-intro:metadata-builder"
        question={t("tbIntroQuestion")}
        tagline={t("mbIntroTagline")}
        concepts={[
          { term: t("mbIntroC1t"), desc: t("mbIntroC1d") },
          { term: t("mbIntroC2t"), desc: t("mbIntroC2d") },
          { term: t("mbIntroC3t"), desc: t("mbIntroC3d") },
        ]}
        labels={{ expand: t("tbIntroExpand"), collapse: t("tbIntroCollapse"), dismiss: t("tbIntroDismiss") }}
      />
```

- [ ] **Step 5: 全綠驗證**

```bash
pnpm -F web exec vitest run src/tools/table-builder src/tools/metadata-builder src/components/shared/tool-intro
pnpm -F web check-types && pnpm -F web lint && pnpm -F web test 2>&1 | grep -E "Test Files|Tests "
```

Expected: 全 PASS(metadata-builder 既有測試不受影響)。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tools/table-builder apps/web/src/tools/metadata-builder
git commit -m "feat(web): wire ToolIntro explainer into table-builder and metadata-builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: changeset + 全面驗證 + 截圖(controller 可直跑)

**Files:**
- Create: `.changeset/web-resource-centric-source.md`

- [ ] **Step 1: changeset**

`.changeset/web-resource-centric-source.md`:

```md
---
"web": patch
---

table-builder: resource-centric data source — one resource (± protocol) seeded by meta.json import / pasted rows / the sample; an offline-vs-live preview toggle replaces the memory/HTTP transport row, and the offline preview now queries the resource's own rows (fixes the imported-rows vs in-memory divergence). Adds a collapsible ToolIntro explainer to table-builder and metadata-builder.
```

```bash
git add .changeset/web-resource-centric-source.md
git commit -m "chore: changeset for table-builder resource-centric source + ToolIntro

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: 全面驗證**

```bash
pnpm -F web test 2>&1 | grep -E "Test Files|Tests " && pnpm -F web check-types && pnpm -F web lint
```

Expected: 全綠。

- [ ] **Step 3: dev server + 截圖**

```bash
lsof -ti :3171 | xargs -r kill
cd /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-table-builder-resource
pnpm --dir apps/web exec next dev --port 3171 &
```

playwright-core 截圖(bundled chromium `/home/royfw/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,CJS:`import pw from '…/playwright-core/index.js'; const { chromium } = pw;`),對照 Z mockup(`scratchpad/2026-07-12-table-builder-resource-centric-Z.html`)與 ③ mockup V1。完整矩陣(補齊 spec ②/③ 驗收):

1. table-builder 預設(Resource 分頁:seed chips + 協定 switch ON + ProtocolPanel + 離線/live + 預覽表)—— sample seed。
2. 點「Call endpoint (live)」→ `page.waitForResponse('**/api/query/sample*')` 等預覽重繪 → 截圖(**spec ② 的 live 真打驗收**;表格 rows 需與 route 回應一致)。
3. Import meta.json seed:點該 chip、貼入含 fields+request 的 meta、Load → 截圖(fields 摘要更新 + 協定 switch ON + endpoint 帶入值)。
4. 貼 rows 匯入後(協定 switch OFF、無 live 選項、預覽顯示匯入資料)。
5. ToolIntro 展開態(table-builder)。
6. metadata-builder 收合態(既有面板無回歸)。
7. metadata-builder ToolIntro 展開態。
8. dark/light 各一:以 `document.documentElement.classList` 切換(或既有主題切換鈕)重截 5 與 7 的另一色系(補齊 spec ③ 的 dark/light 驗收)。

Expected: 與 mockup 形狀一致;截完 kill dev server。

- [ ] **Step 4: 分支總結**

```bash
git log --oneline main..HEAD && git status
```

Expected: 5 個 commits(T1–T5)+ 乾淨 working tree。**HOLD —— 不開 PR**。

---

## Self-Review(已跑)

- **Spec ② coverage**:模型收斂(T3 5b/5d)、Seed 三選一含 meta 匯入(T2+T3 5f)、無協定=靜態/協定開關(T3 5h,ProtocolPanel switch)、離線/live 命名(T2 preview 列)、SAMPLE_ROWS 分岔修正(T3 5d 紅線註解)、i18n(T3 Step 3)、概念說明走 ToolIntro(T4)、Metadata 分頁傳遞(T3 5e)。✓
- **Spec ③ coverage**:V1 摺疊 callout(T1)、localStorage 開合+dismiss(T1)、S1 兩工具接線(T4)、i18n 文案(T4 Step 3)、無 packages 變更、`web` patch changeset(T5)。✓
- **Placeholder scan**:無 TBD/TODO;所有程式碼步驟含完整程式碼或精確 diff。✓
- **Type consistency**:`PreviewMode`/`ResourcePanelProps`/`onImportMeta(meta: DataResourceMeta)` 在 T2 定義、T3 一致消費;`handleImportRows`/`handleImportMeta`/`handleSampleReset` 名稱在 T3 內一致;`ToolIntroLabels` T1↔T4 一致。✓
- **已知取捨**:預設狀態改為 remote+離線(async)是 Z 的刻意語意;ProtocolPanel 重新開啟協定時重置為 DEFAULT_REQUEST(面板既有行為,兩工具一致)。**spec ② 原訂「+ 加上協定」按鈕 + `showEnableToggle={false}` 已改為 ProtocolPanel 既有 enable switch(同能力、零新 UI/i18n;spec ② 已同步修訂)——由對抗式驗證抓出的 spec↔plan 分歧,以修訂 spec 收斂。**
