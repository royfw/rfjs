# table-builder UX 輪(編輯頁籤 + Metadata 匯出 + NL→TableConfig AI)實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/tools/table-builder` 一輪 UX 收整 —— 編輯區改四頁籤(來源/欄位/分頁/Metadata,預覽恆在下方)、engine 新增 `tableConfigToResourceMeta` 反向投影(Metadata 頁籤顯示 + Copy + 下載)、AiPanel 接入 NL→TableConfig generate 與 ask。

**Architecture:** engine(`@rfjs/table-builder`)加一支純函式 `reverse.ts`(`deriveTableConfig` 的反向投影,丟棄 display-only 欄);工具層(apps/web)加 `metadata-panel.tsx` 與 `ai-nl-table.ts` 兩個新模組,`ui.tsx` 版面從三欄 grid 改為 segmented tabs(比照 form-builder 的頁籤視覺),AiPanel 沿用共用元件 `@/components/shared/ai-panel`。**`packages/table-builder-ui` 本輪零改動。**

**Tech Stack:** TypeScript、zod、React 19 + next-intl、Vitest + @testing-library/react、Playwright(e2e)。

## Global Constraints

- 規格:`docs/superpowers/specs/2026-07-09-table-builder-ux-round-design.md`
- 工作目錄(worktree 根):`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-table-ux` — **所有指令在此執行,所有路徑相對於此**
- 紅線:不碰 `packages/form-builder*/**`、`apps/web/src/tools/form-builder/**`、`packages/table-builder-ui/**`
- AI 只住 apps/web 工具層;`@rfjs/*` 套件保持 AI-free
- `@rfjs/table-builder` 是 **dist 套件**(非 transpilePackages):改 engine 後必須 `pnpm -F @rfjs/table-builder build`,否則 web 的測試/dev 看不到新 export
- i18n:en 與 zh-TW 兩份 messages 必須同步增鍵(`apps/web/src/i18n/messages.spec.ts` 檢查 parity);含 `{count}` 的鍵用 `t("key", { count })` 帶值呼叫(ICU 正常路徑),**不可**裸 `t()` 取回再自行替換
- lint 是 `--max-warnings 0`:未用的變數/依賴會直接紅
- Changesets:`@rfjs/table-builder` minor 一份;apps 不寫 changeset
- Commit 規範:conventional、subject 全小寫且 ≤90 字元、結尾 trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- pre-commit hook 會跑 `turbo run lint-staged test --affected`;commit 失敗時先讀 hook 輸出,不可 `--no-verify`

---

### Task 1: engine 反向投影 `tableConfigToResourceMeta`

**Files:**
- Create: `packages/table-builder/src/reverse.ts`
- Create: `packages/table-builder/src/reverse.spec.ts`
- Modify: `packages/table-builder/src/index.ts`(加一行 export)
- Create: `.changeset/table-builder-reverse-meta.md`

**Interfaces:**
- Consumes: `TableConfig`(`./types`)、`DataFieldMeta`/`DataResourceMeta`/`RequestMeta`/`ResponseMeta`/`parseDataResourceMeta`(`@rfjs/data-schema`)、`deriveTableConfig`(round-trip 測試用)
- Produces: `tableConfigToResourceMeta(config: TableConfig, request?: RequestMeta, response?: ResponseMeta): DataResourceMeta` —— Task 2 的 MetadataPanel 從 `@rfjs/table-builder` import 這個名字

- [ ] **Step 1: 寫失敗測試**

`packages/table-builder/src/reverse.spec.ts`(測試風格對齊 `derive.spec.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { parseDataResourceMeta } from '@rfjs/data-schema';
import type { RequestMeta, ResponseMeta } from '@rfjs/data-schema';
import { deriveTableConfig } from './derive';
import { tableConfigToResourceMeta } from './reverse';
import type { TableConfig } from './types';

const REQUEST: RequestMeta = {
  endpoint: '/api/items',
  pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
};
const RESPONSE: ResponseMeta = { rowsPath: 'data.items', totalPath: 'data.total' };

describe('tableConfigToResourceMeta', () => {
  it('maps columns to fields, dropping display-only keys (visible/pin/align)', () => {
    const config: TableConfig = {
      columns: [
        {
          key: 'name',
          label: { en: 'Name' },
          dataType: 'string',
          sortable: true,
          filterable: true,
          visible: false,
          pin: 'left',
          align: 'center',
        },
        { key: 'price', label: 'Price', dataType: 'numeric', format: 'currency', options: [{ value: 1, label: 'One' }] },
      ],
      pagination: { pageSize: 10 },
    };

    const meta = tableConfigToResourceMeta(config);

    expect(meta).toEqual({
      fields: [
        { key: 'name', label: { en: 'Name' }, dataType: 'string', sortable: true, filterable: true },
        { key: 'price', label: 'Price', dataType: 'numeric', format: 'currency', options: [{ value: 1, label: 'One' }] },
      ],
    }); // toEqual 同時釘住:optional 欄缺省不寫、無 request/response 鍵
  });

  it('passes request/response through when provided, omits them when not', () => {
    const config: TableConfig = {
      columns: [{ key: 'id', label: 'ID', dataType: 'numeric' }],
      pagination: { pageSize: 10 },
    };

    const withProtocol = tableConfigToResourceMeta(config, REQUEST, RESPONSE);
    expect(withProtocol.request).toEqual(REQUEST);
    expect(withProtocol.response).toEqual(RESPONSE);

    const bare = tableConfigToResourceMeta(config);
    expect('request' in bare).toBe(false);
    expect('response' in bare).toBe(false);
  });

  it('copies label and options so mutating the meta does not touch the config', () => {
    const config: TableConfig = {
      columns: [
        {
          key: 'status',
          label: { en: 'Status' },
          dataType: 'string',
          options: [{ value: 'active', label: { en: 'Active' } }],
        },
      ],
      pagination: { pageSize: 10 },
    };

    const meta = tableConfigToResourceMeta(config);

    expect(meta.fields[0]!.label).not.toBe(config.columns[0]!.label);
    expect(meta.fields[0]!.options).not.toBe(config.columns[0]!.options);
    expect(meta.fields[0]!.options?.[0]).not.toBe(config.columns[0]!.options?.[0]);
    (meta.fields[0]!.label as Record<string, string>).en = 'CHANGED';
    expect((config.columns[0]!.label as Record<string, string>).en).toBe('Status');
  });

  it('round-trips derive: tableConfigToResourceMeta(deriveTableConfig(meta)).fields equals meta.fields', () => {
    const fields = [
      { key: 'name', label: { en: 'Name' }, dataType: 'string' as const, sortable: true, filterable: true },
      { key: 'price', label: 'Price', dataType: 'numeric' as const, format: 'currency' as const },
    ];

    const roundTripped = tableConfigToResourceMeta(deriveTableConfig({ fields }));

    expect(roundTripped.fields).toEqual(fields);
  });

  it('produces output that passes parseDataResourceMeta', () => {
    const config: TableConfig = {
      columns: [{ key: 'id', label: 'ID', dataType: 'numeric' }],
      pagination: { pageSize: 10 },
    };

    expect(() => parseDataResourceMeta(tableConfigToResourceMeta(config, REQUEST, RESPONSE))).not.toThrow();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/table-builder exec vitest run src/reverse.spec.ts`
Expected: FAIL —— `Cannot find module './reverse'`(或同義的解析錯誤)

- [ ] **Step 3: 最小實作**

`packages/table-builder/src/reverse.ts`:

```ts
import type { DataFieldMeta, DataResourceMeta, RequestMeta, ResponseMeta } from '@rfjs/data-schema';
import type { TableConfig } from './types';

// Reverse projection of `deriveTableConfig` (design spec 2026-07-09 §1): columns map back to a
// pure data description; display-only keys (visible/pin/align) are dropped. Like `derive`,
// label/options are copied so the returned meta never shares references with the config.
export function tableConfigToResourceMeta(
  config: TableConfig,
  request?: RequestMeta,
  response?: ResponseMeta,
): DataResourceMeta {
  const fields: DataFieldMeta[] = config.columns.map((column) => {
    const field: DataFieldMeta = {
      key: column.key,
      label: typeof column.label === 'object' ? { ...column.label } : column.label,
      dataType: column.dataType,
    };
    if (column.format !== undefined) field.format = column.format;
    if (column.options !== undefined) {
      field.options = column.options.map((o) => ({
        ...o,
        ...(typeof o.label === 'object' ? { label: { ...o.label } } : {}),
      }));
    }
    if (column.sortable !== undefined) field.sortable = column.sortable;
    if (column.filterable !== undefined) field.filterable = column.filterable;
    return field;
  });

  const meta: DataResourceMeta = { fields };
  if (request !== undefined) meta.request = request;
  if (response !== undefined) meta.response = response;
  return meta;
}
```

`packages/table-builder/src/index.ts` 在 `export * from './derive';` 之後加:

```ts
export * from './reverse';
```

- [ ] **Step 4: 跑測試確認通過 + 全套件測試 + rebuild**

Run: `pnpm -F @rfjs/table-builder exec vitest run src/reverse.spec.ts`
Expected: PASS(5 tests)

Run: `pnpm -F @rfjs/table-builder vitest:run && pnpm -F @rfjs/table-builder build`
Expected: 全數 PASS;build 成功(**web 端後續 task 依賴這個 dist**)

- [ ] **Step 5: changeset**

`.changeset/table-builder-reverse-meta.md`:

```md
---
"@rfjs/table-builder": minor
---

add `tableConfigToResourceMeta(config, request?, response?)` — reverse projection from a TableConfig back to a DataResourceMeta (display-only column keys dropped), so the inferred/edited data description becomes a referenceable artifact
```

- [ ] **Step 6: Commit**

```bash
git add packages/table-builder/src/reverse.ts packages/table-builder/src/reverse.spec.ts packages/table-builder/src/index.ts .changeset/table-builder-reverse-meta.md
git commit -m "feat(table-builder): add tableConfigToResourceMeta reverse projection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 工具端 `MetadataPanel`(JSON 檢視 + Copy + 下載)

**Files:**
- Create: `apps/web/src/tools/table-builder/metadata-panel.tsx`
- Create: `apps/web/src/tools/table-builder/metadata-panel.spec.tsx`

**Interfaces:**
- Consumes: `tableConfigToResourceMeta`、`TableConfig`(`@rfjs/table-builder`,Task 1 已 build);`RequestMeta`/`ResponseMeta`(`@rfjs/data-schema`);`Button`(`@rfjs/web-ui/components/button`)
- Produces: `MetadataPanel({ config, request?, response?, labels }: MetadataPanelProps)` 與 `MetadataPanelLabels { hint; copy; copied; download }` —— Task 3 的 ui.tsx 掛在 Metadata 頁籤下

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/table-builder/metadata-panel.spec.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TableConfig } from "@rfjs/table-builder";
import type { RequestMeta } from "@rfjs/data-schema";

import { MetadataPanel } from "./metadata-panel";

const LABELS = { hint: "hint text", copy: "Copy", copied: "Copied", download: "Download meta.json" };
const CONFIG: TableConfig = {
  columns: [{ key: "price", label: "Price", dataType: "numeric", pin: "left" }],
  pagination: { pageSize: 5 },
};
const REQUEST: RequestMeta = {
  endpoint: "/api/items",
  pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
};

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
  // jsdom has no createObjectURL; stub the pair the download anchor uses.
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("MetadataPanel", () => {
  it("renders the projected meta JSON (fields present, display-only pin dropped)", () => {
    render(<MetadataPanel config={CONFIG} labels={LABELS} />);

    const pre = screen.getByTestId("metadata-json");
    expect(pre.textContent).toContain('"fields"');
    expect(pre.textContent).toContain('"price"');
    expect(pre.textContent).not.toContain('"pin"');
    expect(pre.textContent).not.toContain('"request"');
  });

  it("includes request when provided", () => {
    render(<MetadataPanel config={CONFIG} request={REQUEST} labels={LABELS} />);
    expect(screen.getByTestId("metadata-json").textContent).toContain('"endpoint"');
  });

  it("copy writes the JSON to the clipboard and flips the button label", async () => {
    render(<MetadataPanel config={CONFIG} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"fields"'));
  });

  it("download builds a json blob url and clicks an anchor", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<MetadataPanel config={CONFIG} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "Download meta.json" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    click.mockRestore();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/table-builder/metadata-panel.spec.tsx`
Expected: FAIL —— `Cannot find module './metadata-panel'`(或同義)

- [ ] **Step 3: 實作**

`apps/web/src/tools/table-builder/metadata-panel.tsx`(下載模式比照 `flow-builder/bpmn-view.tsx:36-43`):

```tsx
"use client";

import * as React from "react";

import { tableConfigToResourceMeta } from "@rfjs/table-builder";
import type { TableConfig } from "@rfjs/table-builder";
import type { RequestMeta, ResponseMeta } from "@rfjs/data-schema";
import { Button } from "@rfjs/web-ui/components/button";

export interface MetadataPanelLabels {
  hint: string;
  copy: string;
  copied: string;
  download: string;
}

export interface MetadataPanelProps {
  config: TableConfig;
  request?: RequestMeta;
  response?: ResponseMeta;
  labels: MetadataPanelLabels;
}

// Metadata tab (design spec §2.2): a live, read-only reverse projection of the current config.
// The Columns panel IS the editing surface for this data — no second editor here.
export function MetadataPanel({ config, request, response, labels }: MetadataPanelProps) {
  const [copied, setCopied] = React.useState(false);

  const json = React.useMemo(
    () => JSON.stringify(tableConfigToResourceMeta(config, request, response), null, 2),
    [config, request, response],
  );

  // Any edit that changes the projection invalidates the "Copied" confirmation.
  React.useEffect(() => setCopied(false), [json]);

  const onCopy = async () => {
    // Clipboard can be unavailable/denied (spec §4): swallow the rejection so the button
    // simply stays on its "copy" label instead of surfacing an unhandled rejection.
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const onDownload = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "meta.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">{labels.hint}</p>
        <Button size="sm" variant="outline" onClick={() => void onCopy()}>
          {copied ? labels.copied : labels.copy}
        </Button>
        <Button size="sm" variant="outline" onClick={onDownload}>
          {labels.download}
        </Button>
      </div>
      <pre data-testid="metadata-json" className="max-h-80 overflow-auto rounded-md bg-muted/30 p-3 font-mono text-xs">
        {json}
      </pre>
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web exec vitest run src/tools/table-builder/metadata-panel.spec.tsx`
Expected: PASS(4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/table-builder/metadata-panel.tsx apps/web/src/tools/table-builder/metadata-panel.spec.tsx
git commit -m "feat(web): add table-builder metadata panel with copy and download

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: ui.tsx 版面改頁籤 + Metadata 整合 + 既有測試連動

**Files:**
- Modify: `apps/web/src/tools/table-builder/ui.tsx`(版面區塊 `ui.tsx:157-198` + 新增 tab state/labels)
- Modify: `apps/web/src/tools/table-builder/messages.ts`(en/zh-TW 各加 8 鍵)
- Modify: `apps/web/src/tools/table-builder/ui.spec.tsx`(1 條既有測試加切頁籤;新增 2 條)
- Modify: `apps/web/e2e/table-builder.e2e.ts`(既有第 2 條改 selector + 切頁籤;新增 1 條)

**Interfaces:**
- Consumes: `MetadataPanel`/`MetadataPanelLabels`(Task 2);既有 `SourcePanel`/`ColumnsPanel`/`PaginationPanel` props 不變
- Produces: 版面結構 —— eyebrow → 頁籤列(button,`aria-selected`)→ 當前面板 → 預覽(`<ConfigTable>` 恆在)。Task 5 會在 eyebrow 與頁籤列之間插入 `<AiPanel>`。

- [ ] **Step 1: messages 增鍵**

`apps/web/src/tools/table-builder/messages.ts` — `en.ToolUI` 內(`tbFilterElemMatch` 之後)加:

```ts
      tbTabSource: "Source",
      tbTabColumns: "Columns",
      tbTabPagination: "Pagination",
      tbTabMetadata: "Metadata",
      tbMetaHint:
        "The data description (DataResourceMeta) projected from the current table config — referenceable by other tools (form scaffolds, api filters).",
      tbMetaCopy: "Copy",
      tbMetaCopied: "Copied",
      tbMetaDownload: "Download meta.json",
```

`"zh-TW".ToolUI` 內對應加:

```ts
      tbTabSource: "來源",
      tbTabColumns: "欄位",
      tbTabPagination: "分頁",
      tbTabMetadata: "Metadata",
      tbMetaHint: "此為目前表格配置對應的資料描述(DataResourceMeta),可供其他工具(form 骨架、api filter)參照。",
      tbMetaCopy: "複製",
      tbMetaCopied: "已複製",
      tbMetaDownload: "下載 meta.json",
```

- [ ] **Step 2: 寫失敗測試(ui.spec.tsx)**

`apps/web/src/tools/table-builder/ui.spec.tsx` —— 既有「editing page size…」測試開頭加一行切頁籤(頁籤未實作前這行會失敗,即為紅燈):

```tsx
  it("editing page size in the pagination panel immediately changes the rendered row count", () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Pagination" }));
    const pageSizeInput = screen.getByLabelText("Default page size") as HTMLInputElement;
    fireEvent.change(pageSizeInput, { target: { value: "3" } });

    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(1 + 3);
  });
```

檔尾新增兩條:

```tsx
  // B-layout (design spec §2.1): the editor panels are tabs; the preview table must stay
  // mounted below regardless of the active tab (the live edit→preview loop is the point).
  it("tabs swap the editor panel while the preview table stays visible", () => {
    renderTool();

    // default tab = Source
    expect(screen.getByText("Data source")).toBeTruthy();
    expect(screen.queryByLabelText("Default page size")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    expect(screen.queryByText("Data source")).toBeNull();
    expect(screen.getByText("Columns", { selector: "p" })).toBeTruthy();
    // preview still rendered
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("metadata tab shows the reverse-projected DataResourceMeta JSON", () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Metadata" }));

    const pre = screen.getByTestId("metadata-json");
    expect(pre.textContent).toContain('"fields"');
    // static rows mode carries no request protocol
    expect(pre.textContent).not.toContain('"request"');
  });
```

注意:`screen.getByText("Columns", { selector: "p" })` 假設 ColumnsPanel 的標題是 `<p>`;實作 Step 4 時先 `grep -n "labels.title" apps/web/src/tools/table-builder/columns-panel.tsx` 確認標題元素,若不是 `<p>` 就把 selector 換成實際元素(以實際 DOM 為準,不是改成寬鬆匹配)。

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/table-builder/ui.spec.tsx`
Expected: FAIL —— 3 條(改的 1 + 新的 2)找不到頁籤按鈕 `{ name: "Pagination" }` 等

- [ ] **Step 4: 實作版面**

`apps/web/src/tools/table-builder/ui.tsx`:

(a) import 區加:

```tsx
import type { ResponseMeta } from "@rfjs/data-schema";
import { MetadataPanel } from "./metadata-panel";
import type { MetadataPanelLabels } from "./metadata-panel";
```

(`RequestMeta` 既有 import 保留。)

(b) state 區(`ui.tsx:31-34` 一帶)加:

```tsx
  type EditorTab = "source" | "columns" | "pagination" | "metadata";
  const [tab, setTab] = React.useState<EditorTab>("source");
```

(c) labels 區加(其他 labels memo 之後):

```tsx
  const metadataPanelLabels: MetadataPanelLabels = React.useMemo(
    () => ({
      hint: t("tbMetaHint"),
      copy: t("tbMetaCopy"),
      copied: t("tbMetaCopied"),
      download: t("tbMetaDownload"),
    }),
    [t],
  );
```

(d) `source` memo 之後加(fetcher 模式的協定投影;plain 值,不需 memo —— MetadataPanel 內部只重算一次 stringify,成本可忽略):

```tsx
  // Metadata tab inputs (design spec §2.2): rows mode is a pure fields description; fetcher
  // mode carries the currently selected strategy's request protocol + the sample response map.
  const metaRequest: RequestMeta | undefined =
    sourceMode === "rows" ? undefined : { ...SAMPLE_META.request!, pagination: samplePaginationMeta(sourceMode) };
  const metaResponse: ResponseMeta | undefined = sourceMode === "rows" ? undefined : SAMPLE_META.response;
```

(e) 版面:把 `ui.tsx:161-178` 的 `<div className="grid gap-4 md:grid-cols-3">…</div>` 整塊換成(segmented tabs 視覺複製自 `form-builder/ui.tsx:399-413`):

```tsx
      {/* B-layout (design spec §2.1): editor panels are tabs, full width each; the ConfigTable
          preview below stays mounted no matter which tab is active. Panels are conditionally
          rendered — all editor state lives in this component or panel props, except the source
          panel's paste text (internal state, resets to defaultText on tab switch; accepted v1). */}
      <div className="inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1">
        {(
          [
            { id: "source", label: t("tbTabSource") },
            { id: "columns", label: t("tbTabColumns") },
            { id: "pagination", label: t("tbTabPagination") },
            { id: "metadata", label: t("tbTabMetadata") },
          ] as { id: EditorTab; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-selected={tab === item.id}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === item.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "source" ? (
        <SourcePanel
          mode={sourceMode}
          onModeChange={setSourceMode}
          labels={sourcePanelLabels}
          onImport={handleImport}
          importLabels={importLabels}
          defaultText={SAMPLE_JSON}
        />
      ) : null}
      {tab === "columns" ? (
        <ColumnsPanel columns={config.columns} onChange={handleColumnsChange} labels={columnsPanelLabels} />
      ) : null}
      {tab === "pagination" ? (
        <PaginationPanel
          pagination={config.pagination}
          emptyText={config.emptyText}
          onPaginationChange={handlePaginationChange}
          onEmptyTextChange={handleEmptyTextChange}
          labels={paginationPanelLabels}
        />
      ) : null}
      {tab === "metadata" ? (
        <MetadataPanel config={config} request={metaRequest} response={metaResponse} labels={metadataPanelLabels} />
      ) : null}
```

預覽區塊(`rounded-md border p-3` + `<ConfigTable>`)原樣保留在其後。同步把檔頭 `ui.tsx:20-22` 的版面註解改述為「頁籤化編輯區 + 恆在預覽」。

- [ ] **Step 5: 跑 ui.spec 確認全綠**

Run: `pnpm -F web exec vitest run src/tools/table-builder/ui.spec.tsx`
Expected: PASS(既有 5 條 + 新 2 條 = 7 tests;其中「Fake fetcher」「filter section」兩條不需改 —— Source 是預設頁籤、篩選鈕在恆在的預覽區)

- [ ] **Step 6: e2e 連動**

`apps/web/e2e/table-builder.e2e.ts` —— 第 2 條測試兩處修改:

(i) `page.getByRole("textbox").first()`(e2e:22)改成 placeholder 定位(Task 5 會在頁面頂部加 AiPanel 的 textarea,`.first()` 之後會抓錯):

```ts
  await page.getByPlaceholder("Paste JSON or CSV…").fill('[{"id":1,"price":10},{"id":2,"price":90}]');
```

(ii) `Filter price` checkbox 在 Columns 頁籤下,勾選前先切頁籤(e2e:31 之前):

```ts
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await page.getByRole("checkbox", { name: "Filter price" }).check();
```

檔尾新增:

```ts
test("metadata tab shows the reverse-projected meta json", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Metadata", exact: true }).click();

  const pre = page.getByTestId("metadata-json");
  await expect(pre).toContainText('"fields"');
  await expect(pre).toContainText('"price"');
});
```

(e2e 實跑留在 Task 6;此步只改檔。)

- [ ] **Step 7: lint + typecheck + Commit**

Run: `pnpm -F web lint && pnpm -F web check-types`
Expected: 皆綠(留意未用 import)

```bash
git add apps/web/src/tools/table-builder/ui.tsx apps/web/src/tools/table-builder/messages.ts apps/web/src/tools/table-builder/ui.spec.tsx apps/web/e2e/table-builder.e2e.ts
git commit -m "feat(web): table-builder editor panels become tabs with a metadata view

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `ai-nl-table.ts` —— prompt builder + 驗證閘

**Files:**
- Create: `apps/web/src/tools/table-builder/ai-nl-table.ts`
- Create: `apps/web/src/tools/table-builder/ai-nl-table.spec.ts`

**Interfaces:**
- Consumes: `parseTableConfig`、`TableConfig`(`@rfjs/table-builder`)
- Produces(Task 5 佈線用,形狀比照 `form-builder/ai-nl-form.ts` + `ai-explain-form.ts`):
  - `buildNlTablePrompt(nl: string, config: TableConfig): { system: string; user: string }`
  - `buildTableAskPrompt(ctx: { configJson: string; locale: string }, question: string): { system: string; user: string }`
  - `parseNlTableResponse(raw: string): string`(驗證閘 —— 失敗 throw;回傳 zod 正規化後的 JSON 字串)

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/table-builder/ai-nl-table.spec.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { TableConfig } from "@rfjs/table-builder";

import { buildNlTablePrompt, buildTableAskPrompt, parseNlTableResponse } from "./ai-nl-table";

const CONFIG: TableConfig = {
  columns: [{ key: "price", label: "Price", dataType: "numeric" }],
  pagination: { pageSize: 5 },
};
const VALID_JSON = JSON.stringify(CONFIG);

describe("buildNlTablePrompt", () => {
  it("embeds the current config and the key-preservation rule; user is the raw nl", () => {
    const p = buildNlTablePrompt("hide the price column", CONFIG);
    expect(p.system).toContain('"price"'); // current config embedded
    expect(p.system).toContain("never add or remove"); // key-set rule
    expect(p.system).toContain("JSON"); // json-only instruction
    expect(p.user).toBe("hide the price column");
  });
});

describe("buildTableAskPrompt", () => {
  it("embeds config json and locale in system; user is the question", () => {
    const p = buildTableAskPrompt({ configJson: VALID_JSON, locale: "zh-TW" }, "這個表格顯示什麼?");
    expect(p.system).toContain(VALID_JSON);
    expect(p.system).toContain("zh-TW");
    expect(p.user).toBe("這個表格顯示什麼?");
  });
});

describe("parseNlTableResponse", () => {
  it("accepts a valid TableConfig and returns normalized json", () => {
    const out = parseNlTableResponse(VALID_JSON);
    expect(JSON.parse(out)).toEqual(CONFIG);
  });

  it("strips a markdown code fence before parsing", () => {
    const out = parseNlTableResponse("```json\n" + VALID_JSON + "\n```");
    expect(JSON.parse(out)).toEqual(CONFIG);
  });

  it("throws on malformed json", () => {
    expect(() => parseNlTableResponse("not json {")).toThrow();
  });

  it("throws on schema-invalid config (pageSize must be a positive int)", () => {
    const bad = JSON.stringify({ columns: CONFIG.columns, pagination: { pageSize: 0 } });
    expect(() => parseNlTableResponse(bad)).toThrow();
  });

  it("throws on incompatible format for the dataType", () => {
    const bad = JSON.stringify({
      columns: [{ key: "price", label: "Price", dataType: "string", format: "currency" }],
      pagination: { pageSize: 5 },
    });
    expect(() => parseNlTableResponse(bad)).toThrow();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/table-builder/ai-nl-table.spec.ts`
Expected: FAIL —— `Cannot find module './ai-nl-table'`(或同義)

- [ ] **Step 3: 實作**

`apps/web/src/tools/table-builder/ai-nl-table.ts`:

```ts
import { parseTableConfig } from "@rfjs/table-builder";
import type { TableConfig } from "@rfjs/table-builder";

/**
 * NL→TableConfig (design spec §2.3). Unlike form-builder's generate (which creates fields from
 * nothing), table columns map to real data fields — so the prompt embeds the CURRENT config and
 * pins the column key set: the model may only adjust display properties, order, and visibility.
 */
export function buildNlTablePrompt(nl: string, config: TableConfig): { system: string; user: string } {
  const system = [
    "You edit a table display config (TableConfig) as JSON ONLY, shape:",
    '{"columns":[{"key":"<field key>","label":"<string or {locale: string}>","dataType":"string|numeric|date|boolean",',
    '"format":"integer|decimal|percent|currency|date|datetime|time"?,"options":[{"value":...,"label":...}]?,',
    '"sortable":bool?,"filterable":bool?,"visible":bool?,"pin":"left"|"right"?,"align":"left"|"center"|"right"?}],',
    '"pagination":{"pageSize":<positive int>,"pageSizeOptions":[<int>]?},',
    '"defaultSort":{"key":"...","direction":"asc"|"desc"}?,"emptyText":"..."?}',
    "format compatibility: integer/decimal/percent/currency require dataType numeric; date/datetime/time require dataType date; string/boolean take no format.",
    "Current config:",
    JSON.stringify(config, null, 2),
    "Apply the user's request to this config and return the FULL modified TableConfig JSON (not a patch).",
    "Column keys map to data fields: never add or remove a key. Reorder columns or set visible:false to hide instead.",
    "Output the JSON object only.",
  ].join("\n");
  return { system, user: nl };
}

/** Ask about the current table config (mirrors form-builder's ai-explain-form shape). */
export function buildTableAskPrompt(
  ctx: { configJson: string; locale: string },
  question: string,
): { system: string; user: string } {
  const system = [
    "You are an assistant for a table display designer (TableConfig JSON: columns with formats, sorting, filtering, pagination).",
    "Current table config (JSON):",
    ctx.configJson,
    `Answer in the "${ctx.locale}" language, in plain text (no Markdown), concisely.`,
  ].join("\n");
  return { system, user: question };
}

/** Validation gate: strip an optional code fence, JSON.parse, then run the real zod parser — throws on invalid. */
export function parseNlTableResponse(raw: string): string {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  const config = parseTableConfig(JSON.parse(text));
  return JSON.stringify(config, null, 2);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web exec vitest run src/tools/table-builder/ai-nl-table.spec.ts`
Expected: PASS(8 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/table-builder/ai-nl-table.ts apps/web/src/tools/table-builder/ai-nl-table.spec.ts
git commit -m "feat(web): add nl-to-table-config prompt builders and validation gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: ui.tsx 接上 AiPanel(generate + ask)

**Files:**
- Modify: `apps/web/src/tools/table-builder/ui.tsx`(AiPanel 插在 eyebrow 與頁籤列之間)
- Modify: `apps/web/src/tools/table-builder/messages.ts`(en/zh-TW 各加 3 鍵)
- Modify: `apps/web/src/tools/table-builder/ui.spec.tsx`(vi.mock + renderTool 換 assembleMessages + 新增 AI describe)

**Interfaces:**
- Consumes: `AiPanel`(`@/components/shared/ai-panel`)、`useAiAssist`(`@/lib/ai/use-ai-assist`)、`useLocale`(next-intl)、Task 4 的三個函式、`parseTableConfig`(`@rfjs/table-builder`)
- Produces: 完整頁面 —— AiPanel 佈線比照 `form-builder/ui.tsx:415-457`(generate 用 `ai.run(..., parseNlTableResponse)`,ask 用 `ai.runStream`);`logKey="rfjs.ai.log.table-builder"`

- [ ] **Step 1: messages 增鍵**

`en.ToolUI`(`tbMetaDownload` 之後):

```ts
      tbAiPlaceholder: "Describe a table change or ask a question…",
      tbAiGenerate: "Generate config",
      tbAiApplied: "Applied ({count} columns)",
```

`"zh-TW".ToolUI`:

```ts
      tbAiPlaceholder: "描述表格調整或提出問題…",
      tbAiGenerate: "產生表格設定",
      tbAiApplied: "已套用({count} 個欄位)",
```

(`tbAiApplied` 走 `t("tbAiApplied", { count })` 正常 ICU 呼叫 —— 這不是 t.raw 的模板情境。)

- [ ] **Step 2: 寫失敗測試(ui.spec.tsx)**

檔頭(既有 import 之前,mock 必須先於被測模組的 import;模式複製自 `form-builder/ui.spec.tsx:28-50`):

```tsx
import { beforeEach, vi } from "vitest";

const mockRun = vi.fn();
const mockCancel = vi.fn();

vi.mock("@/lib/ai/use-ai-assist", () => ({
  useAiAssist: () => ({
    ready: true,
    loading: false,
    error: null,
    cancel: mockCancel,
    run: mockRun,
    runStream: mockRun,
    streamText: "",
    streamReasoning: "",
  }),
}));
```

renderTool 換用完整 messages(AiPanel 內部用共用鍵 `aiBlockTitle`/`aiAsk`/`aiAnswers` 等,只給 `messages.en` 會缺鍵):

```tsx
import { assembleMessages } from "@/i18n/messages";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
      <TableBuilderTool />
    </NextIntlClientProvider>,
  );
}
```

並加:

```tsx
beforeEach(() => {
  localStorage.clear();
  mockRun.mockReset();
});
```

檔尾新增 describe:

```tsx
describe("TableBuilderTool AI panel", () => {
  it("generate applies the returned TableConfig to the live preview", async () => {
    // `ai.run` resolves with the ALREADY-VALIDATED normalized json (the real hook applies
    // parseNlTableResponse internally); the tool then parses + setConfig()s it.
    const generated = {
      columns: [{ key: "id", label: "Renamed Column", dataType: "numeric" }],
      pagination: { pageSize: 5 },
    };
    mockRun.mockResolvedValue(JSON.stringify(generated, null, 2));
    renderTool();

    fireEvent.change(screen.getByPlaceholderText("Describe a table change or ask a question…"), {
      target: { value: "rename id" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate config" }));

    // preview header reflects the applied config
    await screen.findByText("Renamed Column");
    // applied summary shows the column count
    await screen.findByText("Applied (1 columns)");
  });

  it("ask records a plain answer entry", async () => {
    mockRun.mockResolvedValue("It lists products with prices.");
    renderTool();

    fireEvent.change(screen.getByPlaceholderText("Describe a table change or ask a question…"), {
      target: { value: "what does this table show?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await screen.findByText("It lists products with prices.");
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/table-builder/ui.spec.tsx`
Expected: 新 describe 2 條 FAIL(找不到 placeholder/按鈕);既有 7 條仍 PASS(renderTool 換 assembleMessages 不影響 —— 它是超集)

- [ ] **Step 4: 實作佈線**

`apps/web/src/tools/table-builder/ui.tsx`:

(a) import 區加:

```tsx
import { useLocale } from "next-intl";
import { parseTableConfig } from "@rfjs/table-builder";
import { AiPanel } from "@/components/shared/ai-panel";
import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { buildNlTablePrompt, buildTableAskPrompt, parseNlTableResponse } from "./ai-nl-table";
```

(`useTranslations` 的 import 行改成 `import { useLocale, useTranslations } from "next-intl";`。)

(b) component 頂部(`const t = …` 之後)加:

```tsx
  const locale = useLocale();
  const ai = useAiAssist();
```

(c) handlers 區加(generate 與 reapply 共用;reapply 讀的是 localStorage 舊紀錄,可能是舊 schema —— 失敗就靜默不動 config,AiPanel 沒有 reapply 錯誤顯示面):

```tsx
  function applyGeneratedConfig(json: string) {
    try {
      setConfig(parseTableConfig(JSON.parse(json)));
    } catch {
      // stale/foreign log entry — leave the current config untouched
    }
  }
```

(d) JSX:eyebrow `<p>`(`ui.tsx:159`)之後、頁籤列之前插入:

```tsx
      <AiPanel
        title={t("aiBlockTitle")}
        placeholder={t("tbAiPlaceholder")}
        logKey="rfjs.ai.log.table-builder"
        ai={ai}
        onReapply={(e) => applyGeneratedConfig(e.appliedJson ?? "")}
        appliedSummary={(e) => {
          let n = 0;
          try {
            const parsed = JSON.parse(e.appliedJson ?? "") as { columns?: unknown[] };
            n = Array.isArray(parsed.columns) ? parsed.columns.length : 0;
          } catch {
            n = 0;
          }
          return t("tbAiApplied", { count: n });
        }}
        actions={[
          {
            key: "generate",
            label: t("tbAiGenerate"),
            needsInput: true,
            primary: true,
            run: async (input) => {
              const out = await ai.run({ ...buildNlTablePrompt(input, config), json: true }, parseNlTableResponse);
              if (out === null) return null;
              applyGeneratedConfig(out);
              return { kind: "generate", prompt: input, appliedJson: out };
            },
          },
          {
            key: "ask",
            label: t("aiAsk"),
            needsInput: true,
            run: async (input) => {
              const out = await ai.runStream(
                buildTableAskPrompt({ configJson: JSON.stringify(config, null, 2), locale }, input),
                (raw) => raw.trim(),
              );
              return out === null ? null : { kind: "ask", prompt: input, answer: out };
            },
          },
        ]}
      />
```

- [ ] **Step 5: 跑測試 + lint + typecheck**

Run: `pnpm -F web exec vitest run src/tools/table-builder/`
Expected: 全 PASS(ui 9 + metadata-panel 4 + ai-nl-table 8 + 其餘既有面板 spec)

Run: `pnpm -F web lint && pnpm -F web check-types`
Expected: 皆綠

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tools/table-builder/ui.tsx apps/web/src/tools/table-builder/messages.ts apps/web/src/tools/table-builder/ui.spec.tsx
git commit -m "feat(web): wire ai panel into table-builder for generate and ask

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 全量驗證 + e2e + 截圖 + HOLD PR

**Files:**
- 無新程式;產出截圖(session scratchpad)與 PR

**Interfaces:**
- Consumes: Tasks 1–5 全部
- Produces: 綠的全量檢查、e2e、四頁籤 + AI 區塊的 light/dark 截圖、HOLD PR(不 merge)

- [ ] **Step 1: 全量檢查**

Run(worktree 根):`pnpm lint && pnpm typecheck && pnpm test`
Expected: 全綠

- [ ] **Step 2: build + e2e**

Run: `pnpm -F @rfjs/table-builder build && pnpm build:packages && pnpm -F web build`
Expected: build 成功

Run: `E2E_PORT=3013 pnpm -F web test:e2e e2e/table-builder.e2e.ts`
Expected: 3 條全 PASS(原 2 條含頁籤連動修改 + 新 metadata 條)

- [ ] **Step 3: 真渲染截圖(light + dark)**

以 production build 起服(`E2E_PORT` 同上或 `next start` 指定 port),用 Playwright 腳本(參考 session scratchpad 既有 `shot-tif.mjs` 模式)拍:

1. 預設頁(Source 頁籤 + AI 區塊 + 預覽)
2. Columns 頁籤
3. Pagination 頁籤
4. Metadata 頁籤(JSON + Copy/Download 鈕)

light + dark 各一輪(dark 切換:`localStorage.setItem("theme", "dark")` 後 reload)。逐張人工檢視:頁籤 active 態、預覽恆在、Metadata JSON 有 `"fields"`、AI 區塊顯示降級提示(未設定連線)或輸入列。**截圖存 scratchpad,回報時附絕對路徑。**

- [ ] **Step 4: push + HOLD PR**

```bash
git push -u origin feat-table-ux
gh pr create --title "feat: table-builder editor tabs, metadata export, and nl-to-config ai" --body "$(cat <<'EOF'
## Summary
- editor panels (source / columns / pagination) become segmented tabs with the live ConfigTable preview always visible below
- new Metadata tab: `tableConfigToResourceMeta` (new `@rfjs/table-builder` reverse projection, minor changeset) rendered live with copy + download meta.json
- AiPanel wired for NL→TableConfig generate (parseTableConfig validation gate, column key set pinned) and ask

**HOLD: do not merge** — pending user review.

Spec: docs/superpowers/specs/2026-07-09-table-builder-ux-round-design.md
Plan: docs/superpowers/plans/2026-07-10-table-builder-ux-round.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR 建立,回報 PR 連結 + 截圖絕對路徑,等使用者 review/merge。
