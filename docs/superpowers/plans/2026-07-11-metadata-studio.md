# Metadata Studio 視覺輪實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/tools/metadata-builder` 改造成 C 案 Studio 分割檢視 —— 左欄位清單+inspector、右永亮可收合程式碼面板(meta/schema/試篩),含選中欄位片段高亮、RWD 直疊與收合持久化。**功能與資料模型零改變。**

**Architecture:** `fields-panel.tsx` 重構為 `field-list.tsx`(緊湊清單)+ `field-inspector.tsx`(單欄位編輯)+ 薄組合層;`derived-preview.tsx` 重構為 `code-panel.tsx`(頁籤+片段模式+JSON 著色+收合鈕)。選取狀態(`selectedId`)與收合狀態(`codeOpen`,localStorage)由 `ui.tsx` 持有。`model.ts`/protocol/import 面板功能零改動。

**Tech Stack:** TypeScript、React 19 + next-intl、Tailwind(`lg:` 斷點)、Vitest + @testing-library/react、Playwright。

## Global Constraints

- 規格:`docs/superpowers/specs/2026-07-11-metadata-studio-design.md`;視覺依據:`docs/mockups/2026-07-11-metadata-builder-visual-directions.html` 的 **C 段**(Studio)
- 工作目錄:`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-metadata-studio` — 所有指令在此執行
- **不變式**:`model.ts`、`protocol-panel.tsx`、`import-panel.tsx` 與其 spec **零改動**;localStorage meta 行為、匯入/匯出、zod 閘全部不動;紅線目錄照舊(`src/tools/table-builder/**`、`app/api/**`、engine 套件、workbench、form-builder 系)
- **既定決策**(spec 開放點在此定案):① 預設**無選取**(meta 頁籤顯示整份 JSON;僅「+ 欄位」自動選取新列;移除選中列清空選取;匯入後**不**自動選取)② kind pill 色:column=`text-cyan-*`、jsonb=`text-violet-*`、未指定=虛線灰(比照 mockup C)③ 收合初值:localStorage `rfjs.metadata-builder.code-open` 無值時用 `matchMedia("(min-width:1024px)").matches`(桌機開、窄幅關),使用者切過就以儲存值為準
- 既有測試**語義全數保留**(斷言強度不得降),選擇器隨新互動流改寫;`model.spec`/`protocol-panel.spec`/`import-panel.spec` 不得改
- i18n en/zh-TW 同步(ui.spec 的 fragment parity 測試會抓);被淘汰的鍵兩語系同步刪
- lint `--max-warnings 0`;**零 changeset**(僅動 apps/web)
- Commit:conventional、小寫 ≤90 字元、trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;pre-commit 失敗先讀輸出修好,不可 --no-verify
- 環境噪音:`@rfjs/db` lint 與 `@rfjs/form-builder` typecheck 在 main 上就壞,忽略

---

### Task 1: `field-list.tsx` + `field-inspector.tsx` + `fields-panel.tsx` 組合層重構

**Files:**
- Create: `apps/web/src/tools/metadata-builder/field-list.tsx`
- Create: `apps/web/src/tools/metadata-builder/field-inspector.tsx`
- Modify: `apps/web/src/tools/metadata-builder/fields-panel.tsx`(整檔重寫為組合層,export 名與 labels 介面擴充)
- Test: `apps/web/src/tools/metadata-builder/fields-panel.spec.tsx`(整檔重寫 —— 既有 5 條語義保留 + 新 3 條)

**Interfaces:**
- Consumes: `FieldRow`/`OptionRow`/`formatOptionsFor`(`./model`,零改動)
- Produces(Task 3 依賴):

```ts
export interface FieldsPanelLabels {
  // 既有 16 鍵全保留(key/labelEn/labelZh/dataType/format/formatNone/sortable/filterable/
  // kind/kindNone/options/addField/addOption/remove/dupKey/blankKey)+ 新增:
  inspectorTitle: string;   // "INSPECTOR" eyebrow 前綴
  inspectorEmpty: string;   // 無選取空狀態
  fieldSummary: string;     // 彙總條模板,含 {n}/{f} 佔位(呼叫端 t() 帶值後傳入成品字串)
}
export function FieldsPanel({ rows, onChange, selectedId, onSelect, labels }: {
  rows: FieldRow[];
  onChange: (rows: FieldRow[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  labels: FieldsPanelLabels;
})
```

- 內部:`FieldList({ rows, selectedId, onSelect, onRemove, onAdd, dupKeys, labels })` 與 `FieldInspector({ row, onPatch, onPatchDataType, labels })`(row 為 `FieldRow | null`)。**行為搬遷不改寫**:`patch`/`patchDataType`(format 清除)/`removeField`(清選取)/`addField`(自動選取新列)/option 增刪改 —— 全部沿用現有實作邏輯,只換掛載位置
- **DOM 契約**(測試依賴):清單列為 `role="option"` + `aria-selected`,容器 `role="listbox"` + `aria-label={labels.key}`… 改為容器 `aria-label="fields"`?—— **定案:容器 `<div role="listbox" aria-label={labels.inspectorTitle}>` 不妥;直接用 `<button role="option" aria-selected>` 列 + 外層 `role="listbox"` 無名**。列的可及名 = key 文字(空 key 列 = `labels.blankKey`)。inspector 內所有輸入沿用現有 aria-label(`labels.key`/`labels.labelEn`/…,`getByLabelText` 可及);dataType/format/kind 改 **segmented buttons**(`aria-pressed`,可及名 = 選項字面值,format 的「無」= `labels.formatNone` —— 與 kind 的 `labels.kindNone` 同字 "—" 會撞名,**兩組 segmented 各包 `role="group"` + `aria-label={labels.format}`/`{labels.kind}`**,測試以 `within(getByRole("group", { name: "format" }))` 定位)

- [ ] **Step 1: 重寫測試(先紅)**

`apps/web/src/tools/metadata-builder/fields-panel.spec.tsx` 整檔替換:

```tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as React from "react";

import { FieldsPanel } from "./fields-panel";
import type { FieldRow } from "./model";

const LABELS = {
  key: "key", labelEn: "Label (en)", labelZh: "Label (zh-TW)", dataType: "type", format: "format",
  formatNone: "—", sortable: "sortable", filterable: "filterable", kind: "kind", kindNone: "—",
  options: "options", addField: "+ field", addOption: "+ option", remove: "remove",
  dupKey: "duplicate key", blankKey: "key required",
  inspectorTitle: "INSPECTOR", inspectorEmpty: "select or add a field", fieldSummary: "3 fields",
};

function row(partial: Partial<FieldRow>): FieldRow {
  return {
    id: partial.key ?? "r", key: "k", labelEn: "K", labelZh: "", dataType: "string",
    sortable: false, filterable: false, options: [], ...partial,
  };
}

/** 受控 harness:管理 rows 與 selection,模擬 ui.tsx 的持有方式。 */
function Harness({ initial, onChangeSpy }: { initial: FieldRow[]; onChangeSpy?: (rows: FieldRow[]) => void }) {
  const [rows, setRows] = React.useState(initial);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  return (
    <FieldsPanel
      rows={rows}
      onChange={(next) => {
        setRows(next);
        onChangeSpy?.(next);
      }}
      selectedId={selectedId}
      onSelect={setSelectedId}
      labels={LABELS}
    />
  );
}

describe("FieldsPanel (studio)", () => {
  it("shows the empty inspector state until a row is selected, then highlights it", () => {
    render(<Harness initial={[row({ key: "price", id: "r1" })]} />);

    expect(screen.getByText("select or add a field")).toBeTruthy();

    const item = screen.getByRole("option", { name: /price/ });
    fireEvent.click(item);
    expect(item.getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText("select or add a field")).toBeNull();
  });

  it("edits the selected row's key through the inspector and reports full rows", () => {
    const spy = vi.fn();
    render(<Harness initial={[row({ key: "price", id: "r1" })]} onChangeSpy={spy} />);

    fireEvent.click(screen.getByRole("option", { name: /price/ }));
    fireEvent.change(screen.getByLabelText("key"), { target: { value: "cost" } });

    expect(spy.mock.calls[0]![0][0]).toMatchObject({ id: "r1", key: "cost" });
  });

  it("changing dataType via the segmented control clears an incompatible format", () => {
    const spy = vi.fn();
    render(<Harness initial={[row({ key: "price", dataType: "numeric", format: "currency" })]} onChangeSpy={spy} />);

    fireEvent.click(screen.getByRole("option", { name: /price/ }));
    const group = screen.getByRole("group", { name: "type" });
    fireEvent.click(within(group).getByRole("button", { name: "string" }));

    expect(spy.mock.calls[0]![0][0]).toMatchObject({ dataType: "string", format: undefined });
  });

  it("adds a field (auto-selecting it) and removes it (clearing selection)", () => {
    const spy = vi.fn();
    render(<Harness initial={[row({ key: "a", id: "r1" })]} onChangeSpy={spy} />);

    fireEvent.click(screen.getByRole("button", { name: "+ field" }));
    expect(spy.mock.calls[0]![0]).toHaveLength(2);
    // 新列自動選取 → inspector 顯示(空 key 的列可及名 = blankKey 文案)
    expect(screen.queryByText("select or add a field")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "remove" })[1]!);
    expect(spy.mock.calls.at(-1)![0]).toHaveLength(1);
    expect(screen.getByText("select or add a field")).toBeTruthy(); // 移除選中列 → 清選取
  });

  it("edits an enum option pair inside the inspector", () => {
    const spy = vi.fn();
    render(
      <Harness
        initial={[row({ key: "status", options: [{ id: "o1", value: "draft", labelEn: "Draft", labelZh: "" }] })]}
        onChangeSpy={spy}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: /status/ }));
    const box = screen.getByTestId("options-editor");
    fireEvent.change(within(box).getByDisplayValue("draft"), { target: { value: "d1" } });

    expect(spy.mock.calls[0]![0][0].options[0]).toMatchObject({ value: "d1" });
  });

  it("marks duplicate and blank keys on the list", () => {
    render(<Harness initial={[row({ key: "a", id: "r1" }), row({ key: "a", id: "r2" }), row({ key: "", id: "r3" })]} />);

    expect(screen.getAllByText("duplicate key")).toHaveLength(2);
    expect(screen.getByText("key required")).toBeTruthy();
  });

  it("renders kind pills and flag badges on list rows", () => {
    render(
      <Harness
        initial={[
          row({ key: "price", id: "r1", kind: "column", filterable: true }),
          row({ key: "author.name", id: "r2", kind: "jsonb" }),
          row({ key: "plain", id: "r3" }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("option");
    expect(within(rows[0]!).getByText("column")).toBeTruthy();
    expect(within(rows[0]!).getByText("filterable")).toBeTruthy();
    expect(within(rows[1]!).getByText("jsonb")).toBeTruthy();
    expect(within(rows[2]!).queryByText("column")).toBeNull();
  });

  it("keeps sortable/filterable checkboxes editable in the inspector", () => {
    const spy = vi.fn();
    render(<Harness initial={[row({ key: "a", id: "r1" })]} onChangeSpy={spy} />);

    fireEvent.click(screen.getByRole("option", { name: /a/ }));
    fireEvent.click(screen.getByLabelText("sortable"));

    expect(spy.mock.calls[0]![0][0]).toMatchObject({ sortable: true });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/fields-panel.spec.tsx`
Expected: 全 FAIL(現行 FieldsPanel 無 selectedId/onSelect props → TS 轉譯仍跑,`getByRole("option")` 找不到;整個 describe 紅)

- [ ] **Step 3: 實作**

(a) `field-list.tsx` —— `FieldList({ rows, selectedId, onSelect, onRemove, onAdd, dupKeys, labels })`:

- 容器 `<div role="listbox" className="flex flex-col">`;每列 `<div role="option" aria-selected={r.id===selectedId} onClick={() => onSelect(r.id)} className={…選中金色底 bg-primary/10 outline…}>`:行號(mono 淡色)、key(mono font-semibold;空 key 顯示 `labels.blankKey` 淡紅斜體)、dataType 淡色 mono、kind pill(column: `bg-cyan-500/10 text-cyan-600 dark:text-cyan-400`;jsonb: `bg-violet-500/10 text-violet-600 dark:text-violet-400`;無 kind 不顯示 pill)、旗標徽章(sortable/filterable 為 true 才渲染,`bg-primary/10 text-primary` 小徽章,文字即 labels.sortable/filterable)、enum 徽章(`options.length > 0` 時顯示 `enum·N`)、列尾 remove 鈕(`aria-label={labels.remove}`,`opacity-0 group-hover:opacity-100`)
- 列上驗證:key 空 → 紅點 + `labels.blankKey` 小字;dup → `labels.dupKey` 小字(沿用現有 dupKeys 判定,由組合層算好傳入)
- 底部:「+ 欄位」鈕 + 彙總條(`labels.fieldSummary` 成品字串,淡色小字)

(b) `field-inspector.tsx` —— `FieldInspector({ row, onPatch, onPatchDataType, labels })`:

- `row === null` → `<p className="text-xs text-muted-foreground">{labels.inspectorEmpty}</p>`
- 有選取:eyebrow `{labels.inspectorTitle} · {row.key}`(mono);編輯列(`grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 items-center`):
  - label en/zh:兩個 `<input>`(aria-label 沿用 `labels.labelEn`/`labels.labelZh`)
  - key:`<input aria-label={labels.key}>`(mono)
  - dataType:`<div role="group" aria-label={labels.dataType}>` 內 segmented buttons(`aria-pressed`,點擊呼叫 `onPatchDataType(value)`)
  - format:`role="group" aria-label={labels.format}`,第一顆 = `labels.formatNone`(清除),其餘 `formatOptionsFor(row.dataType)`;dataType 無 format 選項時整組不渲染
  - kind:`role="group" aria-label={labels.kind}`,`labels.kindNone` + column/jsonb
  - flags:兩個 checkbox(aria-label 沿用)
  - options 子編輯器:直接展開在 inspector 底部(`data-testid="options-editor"` 保留;value/labelEn/labelZh 輸入的 aria-label 沿用現有 `${labels.options} ${row.key} …` 格式;`+ option`/remove 沿用)—— **不再需要開合鈕**(inspector 一次只看一欄)
- segmented 容器 `flex flex-wrap gap-1`(RWD 防擠)

(c) `fields-panel.tsx` 重寫為組合層:

```tsx
"use client";

import * as React from "react";

import { formatOptionsFor, type FieldRow } from "./model";
import { FieldList } from "./field-list";
import { FieldInspector } from "./field-inspector";

export interface FieldsPanelLabels { /* 既有 16 鍵 + inspectorTitle/inspectorEmpty/fieldSummary */ }

export function FieldsPanel({ rows, onChange, selectedId, onSelect, labels }: { /* 如 Interfaces */ }) {
  const dupKeys = React.useMemo(() => { /* 沿用現有實作(fields-panel.tsx:32-36 原邏輯) */ }, [rows]);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  function patch(partial: Partial<FieldRow>) {
    if (!selected) return;
    onChange(rows.map((r) => (r.id === selected.id ? { ...r, ...partial } : r)));
  }
  function patchDataType(dataType: FieldRow["dataType"]) {
    if (!selected) return;
    const format = selected.format !== undefined && formatOptionsFor(dataType).includes(selected.format) ? selected.format : undefined;
    patch({ dataType, format });
  }
  function addField() {
    const id = crypto.randomUUID();
    onChange([...rows, { id, key: "", labelEn: "", labelZh: "", dataType: "string", sortable: false, filterable: false, options: [] }]);
    onSelect(id); // 新增自動選取(既定決策①)
  }
  function removeField(id: string) {
    if (id === selectedId) onSelect(null);
    onChange(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <FieldList rows={rows} selectedId={selectedId} onSelect={onSelect} onRemove={removeField} onAdd={addField} dupKeys={dupKeys} labels={labels} />
      <div className="border-t border-dashed border-input pt-3">
        <FieldInspector row={selected} onPatch={patch} onPatchDataType={patchDataType} labels={labels} />
      </div>
    </div>
  );
}
```

(option 增刪改的 handler 同樣從舊檔搬進 inspector 的 onPatch 呼叫:`onPatch({ options: … })`,邏輯不變。)

- [ ] **Step 4: 跑測試確認通過 + lint/typecheck**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/fields-panel.spec.tsx && pnpm -F web lint && pnpm -F web check-types`
Expected: 8/8 PASS;lint/typecheck 綠。**注意**:此刻 `ui.tsx` 還在用舊 props → check-types 會紅!**本 task 需同步把 ui.tsx 的 `<FieldsPanel>` 呼叫補上臨時 props**(`selectedId={null} onSelect={() => {}}` + labels 補三鍵用字面量)讓分支保持綠 —— Task 3 會正式接線。ui.spec 既有「editing a field key」測試此刻會紅(key 輸入移進 inspector 且無選取)——**同 task 內先改該測試為「點選 price 列 → 編輯」流**(Task 3 不再動它):

```tsx
  it("editing a field key reflects into the preview json", () => {
    renderTool();

    fireEvent.click(screen.getByRole("option", { name: /price/ }));
    fireEvent.change(screen.getByLabelText("key"), { target: { value: "cost" } });

    expect(screen.getByTestId("meta-json").textContent).toContain('"key": "cost"');
    expect(screen.getByTestId("meta-json").textContent).not.toContain('"key": "price"');
  });
```

(此測試在本 task 用臨時 props 時仍紅 —— 因 selectedId 恆 null。**改法**:臨時 props 用本地 useState 而非寫死 null:`const [selectedId, setSelectedId] = React.useState<string | null>(null)` 放進 ui.tsx —— 這本來就是 Task 3 的最終形,提前放入,Task 3 只補 code panel 佈線。)localStorage 兩條測試同步改為「先點列再編輯」。

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/`
Expected: 全 PASS(ui.spec 的 fragment/收合相關新測試還不存在;既有 7 條在調整後全綠)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/metadata-builder/field-list.tsx apps/web/src/tools/metadata-builder/field-inspector.tsx apps/web/src/tools/metadata-builder/fields-panel.tsx apps/web/src/tools/metadata-builder/fields-panel.spec.tsx apps/web/src/tools/metadata-builder/ui.tsx apps/web/src/tools/metadata-builder/ui.spec.tsx apps/web/src/tools/metadata-builder/messages.ts
git commit -m "refactor(web): metadata-builder fields become list plus inspector

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(messages.ts 在本 task 加 `mbInspectorTitle`/`mbInspectorEmpty`/`mbFieldSummary` 三鍵,en/zh-TW 同步:en "INSPECTOR"/"select or add a field"/"{n} fields · {f} filterable";zh-TW "檢視器"/"選擇或新增一個欄位"/"{n} 欄 · {f} 可篩";`mbFieldSummary` 由 ui.tsx 以 `t("mbFieldSummary", { n, f })` 帶值。)

---

### Task 2: `code-panel.tsx` —— 頁籤 + 片段模式 + JSON 著色 + 收合鈕

**Files:**
- Create: `apps/web/src/tools/metadata-builder/code-panel.tsx`
- Delete: `apps/web/src/tools/metadata-builder/derived-preview.tsx` + `derived-preview.spec.tsx`(語義併入新 spec)
- Test: `apps/web/src/tools/metadata-builder/code-panel.spec.tsx`(新;涵蓋舊 derived-preview 4 條語義 + 新片段/收合語義)

**Interfaces:**
- Consumes: `fieldsToFilterSchema`/`emptyGroup`/`FilterTreeEditor`/`parseDataResourceMeta`(同舊 derived-preview);`Button`
- Produces(Task 3 依賴):

```ts
export interface CodePanelLabels {
  metaTitle: string; schemaTitle: string; tryTitle: string;   // 頁籤名(沿用既有三鍵)
  emptySchema: string; copy: string; copied: string; download: string; reset: string;
  collapse: string; expand: string; showAll: string;          // 新鍵
}
export function CodePanel({ meta, selectedFieldKey, onReset, onCollapse, labels, treeLabels }: {
  meta: DataResourceMeta;
  selectedFieldKey: string | null;   // 片段模式的目標(Task 3 由 selectedId 對應的 row.key 算出)
  onReset: () => void;
  onCollapse: () => void;            // 收合鈕;收合後的展開條由 ui.tsx 渲染
  labels: CodePanelLabels;
  treeLabels: FilterTreeLabels;
})
```

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/metadata-builder/code-panel.spec.tsx`(clipboard/URL mock 佈局照舊 derived-preview.spec):

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CodePanel } from "./code-panel";
import { DEFAULT_META } from "./model";

const LABELS = {
  metaTitle: "meta.json", schemaTitle: "schema", tryTitle: "try filter",
  emptySchema: "declare a field as filterable and pick its kind (column/jsonb) to try filtering here",
  copy: "Copy", copied: "Copied", download: "Download meta.json", reset: "Reset",
  collapse: "collapse code panel", expand: "expand code panel", showAll: "show all",
};
const TREE_LABELS = {
  logic: { and: "AND", or: "OR", nor: "NOR", not: "NOT" },
  addCondition: "+ condition", addGroup: "+ group", removeGroup: "remove group", removeCondition: "remove",
  elemMatch: "elemmatch",
};

const writeText = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof CodePanel>> = {}) {
  const props = {
    meta: DEFAULT_META,
    selectedFieldKey: null as string | null,
    onReset: vi.fn(),
    onCollapse: vi.fn(),
    labels: LABELS,
    treeLabels: TREE_LABELS,
    ...overrides,
  };
  return { ...render(<CodePanel {...props} />), props };
}

describe("CodePanel tabs", () => {
  it("defaults to the meta tab with the full normalized json; schema and try tabs swap content", () => {
    renderPanel();

    const metaJson = screen.getByTestId("meta-json");
    expect(metaJson.textContent).toContain('"fields"');
    expect(metaJson.textContent).toContain('"request"');

    fireEvent.click(screen.getByRole("button", { name: "schema" }));
    expect(screen.queryByTestId("meta-json")).toBeNull();
    expect(screen.getByTestId("schema-json").textContent).toContain('"author.name"');
    expect(screen.getByTestId("schema-json").textContent).not.toContain('"createdAt"');

    fireEvent.click(screen.getByRole("button", { name: "try filter" }));
    expect(screen.getByRole("button", { name: "+ condition" })).toBeTruthy();
  });

  it("shows the empty-schema hint on the try tab when nothing is filterable", () => {
    renderPanel({ meta: { fields: [{ key: "a", label: "A", dataType: "string" }] } });

    fireEvent.click(screen.getByRole("button", { name: "try filter" }));
    expect(screen.getByText(LABELS.emptySchema)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ condition" })).toBeNull();
  });
});

describe("CodePanel fragment mode", () => {
  it("shows only the selected field's json with a show-all escape", () => {
    renderPanel({ selectedFieldKey: "price" });

    const metaJson = screen.getByTestId("meta-json");
    expect(metaJson.textContent).toContain('"key": "price"');
    expect(metaJson.textContent).not.toContain('"key": "title"');
    expect(metaJson.textContent).not.toContain('"request"');

    fireEvent.click(screen.getByRole("button", { name: "show all" }));
    expect(screen.getByTestId("meta-json").textContent).toContain('"key": "title"');
  });

  it("falls back to the full json when the selected key is not in the meta", () => {
    renderPanel({ selectedFieldKey: "ghost" });
    expect(screen.getByTestId("meta-json").textContent).toContain('"request"');
  });

  it("coloring never alters the text content", () => {
    renderPanel();
    const txt = screen.getByTestId("meta-json").textContent!;
    expect(JSON.parse(txt)).toBeTruthy(); // 著色只包 span,textContent 仍是合法 JSON
  });
});

describe("CodePanel actions", () => {
  it("copy flips to copied (full json even in fragment mode); download and reset work", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { props } = renderPanel({ selectedFieldKey: "price" });

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"request"')); // Copy 一律整份

    fireEvent.click(screen.getByRole("button", { name: "Download meta.json" }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(props.onReset).toHaveBeenCalled();
    click.mockRestore();
  });

  it("collapse button reports through onCollapse", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "collapse code panel" }));
    expect(props.onCollapse).toHaveBeenCalled();
  });
});
```

(檔頭補 `import * as React from "react";` 供 `React.ComponentProps` 型別使用。)

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/code-panel.spec.tsx`
Expected: FAIL —— `Cannot find module './code-panel'`

- [ ] **Step 3: 實作**

`code-panel.tsx` 要點(視覺照 mockup C 段右欄):

- 內部 state:`tab: 'meta'|'schema'|'try'`(useState,預設 'meta')、`showAll: boolean`(useState false;`selectedFieldKey` 變更時 reset false —— useEffect)、`copied`、`tree`(沿用舊 derived-preview)
- 計算:`jsonResult`(整份,沿用舊 try/catch);**片段**:`fragment = selectedFieldKey && !showAll ? stringifySelected() : undefined`,其中 `stringifySelected()` 在 parse 成功的正規化 meta 裡 `fields.find(f => f.key === selectedFieldKey)`,找不到回 undefined(→ 顯示整份;測試 4);顯示 `fragment ?? jsonResult.json`
- **著色**:純函式 `colorJson(json: string): React.ReactNode[]` —— 以 regex 逐 token 包 span:key(`"…":`)`text-sky-600 dark:text-sky-400`、字串值 `text-emerald-600 dark:text-emerald-400`、number/bool `text-amber-600 dark:text-amber-400`、標點原色淡化;**textContent 必須等於原字串**(不插入/刪除任何字元)。放同檔模組層,`<pre data-testid="meta-json">{colorJson(display)}</pre>`
- 版面:標題列 = 三個頁籤鈕(mono 小字,active `text-primary border-b-2 border-primary`)+ 右側 Copy/下載/Reset/收合鈕(收合鈕 `aria-label={labels.collapse}`,icon 用 `PanelRightClose`(lucide));片段模式時 meta 頁籤下方一條小字列:`selectedFieldKey` + 「show all」鈕(`aria-label`/文字 = `labels.showAll`)
- schema 頁籤:`<pre data-testid="schema-json">`(著色同);try 頁籤:FilterTreeEditor / 空 schema 提示(沿用)
- Copy/下載永遠用**整份** `jsonResult.json`(片段只是視圖);錯誤條沿用
- 刪除 `derived-preview.tsx` 與其 spec

- [ ] **Step 4: 跑測試確認通過 + lint/typecheck**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/code-panel.spec.tsx && pnpm -F web lint && pnpm -F web check-types`
Expected: 7/7 PASS。**注意**:ui.tsx 仍 import derived-preview → 刪檔會使 check-types 紅;**本 task 同步把 ui.tsx 的 `<DerivedPreview>` 換成 `<CodePanel meta={meta} selectedFieldKey={null} onReset={reset} onCollapse={() => {}} labels={…} treeLabels={treeLabels} />`**(labels memo 補 collapse/expand/showAll 三鍵;messages.ts 加 `mbCollapse`/`mbExpand`/`mbShowAll`,en: "collapse code panel"/"expand code panel"/"show all";zh-TW: "收合程式碼面板"/"展開程式碼面板"/"顯示整份";同時刪 `mbPreviewTitle` 鍵與其使用處 —— 面板自帶標題列)。ui.spec 若有引用 mbPreviewTitle 的斷言一併調整(現無)。

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/`
Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/tools/metadata-builder/ 
git commit -m "refactor(web): metadata-builder code panel with tabs, fragment view, and json coloring

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `ui.tsx` 分割版面 —— 選取佈線 + 收合持久化 + RWD

**Files:**
- Modify: `apps/web/src/tools/metadata-builder/ui.tsx`
- Test: `apps/web/src/tools/metadata-builder/ui.spec.tsx`(附加 3 條)

**Interfaces:**
- Consumes: Tasks 1–2 的 `FieldsPanel`(selectedId/onSelect)與 `CodePanel`(selectedFieldKey/onCollapse)
- Produces: 最終版面 ——

```
<eyebrow>
<tabs Fields/Protocol/Import>
<div class="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(380px,1fr)]">
  <div>{當前編輯面板}</div>
  <div>{codeOpen ? <CodePanel/> : <展開條>}</div>
</div>
```

- [ ] **Step 1: 寫失敗測試(附加)**

`ui.spec.tsx` 檔尾附加:

```tsx
describe("studio layout", () => {
  it("selecting a field switches the code panel to fragment mode; deselect via remove shows full json", () => {
    renderTool();

    fireEvent.click(screen.getByRole("option", { name: /price/ }));
    expect(screen.getByTestId("meta-json").textContent).not.toContain('"request"'); // 片段模式
    expect(screen.getByTestId("meta-json").textContent).toContain('"key": "price"');

    fireEvent.click(screen.getByRole("button", { name: "show all" }));
    expect(screen.getByTestId("meta-json").textContent).toContain('"request"');
  });

  it("collapse hides the code panel and persists; expand restores it", () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "collapse code panel" }));
    expect(screen.queryByTestId("meta-json")).toBeNull();
    expect(localStorage.getItem("rfjs.metadata-builder.code-open")).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: "expand code panel" }));
    expect(screen.getByTestId("meta-json")).toBeTruthy();
    expect(localStorage.getItem("rfjs.metadata-builder.code-open")).toBe("1");
  });

  it("the code panel stays mounted across editor tabs", () => {
    renderTool();
    fireEvent.click(screen.getByRole("button", { name: "Protocol" }));
    expect(screen.getByTestId("meta-json")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByTestId("meta-json")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/ui.spec.tsx`
Expected: 新 3 條 FAIL(fragment 未佈線 —— selectedFieldKey 恆 null;無收合鈕行為;既有測試 PASS)

- [ ] **Step 3: 實作**

`ui.tsx`:

(a) 收合狀態(比照 meta 的 restore/persist 模式,同一個 restore effect 裡處理即可):

```tsx
const CODE_OPEN_KEY = "rfjs.metadata-builder.code-open";
const [codeOpen, setCodeOpen] = React.useState(true); // SSR 首繪恆 true,避免 hydration mismatch
// restore effect 內(既有 try/catch 之後)追加:
const storedOpen = localStorage.getItem(CODE_OPEN_KEY);
if (storedOpen !== null) setCodeOpen(storedOpen !== "0");
else setCodeOpen(window.matchMedia("(min-width: 1024px)").matches); // 既定決策③
```

```tsx
function toggleCode(next: boolean) {
  setCodeOpen(next);
  localStorage.setItem(CODE_OPEN_KEY, next ? "1" : "0");
}
```

(b) 片段目標:`const selectedFieldKey = rows.find((r) => r.id === selectedId)?.key ?? null;`(selectedId 已於 Task 1 進駐 ui.tsx)

(c) 版面(取代現有「面板 + 底部 DerivedPreview」區塊):

```tsx
      <div className="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(380px,1fr)]">
        <div>
          {tab === "fields" && (
            <FieldsPanel rows={rows} onChange={handleFieldsChange} selectedId={selectedId} onSelect={setSelectedId} labels={fieldsLabels} />
          )}
          {tab === "protocol" && (
            <ProtocolPanel request={meta.request} response={meta.response} onChange={handleProtocolChange} labels={protocolLabels} />
          )}
          {tab === "import" && <ImportPanel onMeta={handleImportMeta} onFields={handleImportFields} labels={importLabels} />}
        </div>
        <div>
          {codeOpen ? (
            <CodePanel
              meta={meta}
              selectedFieldKey={tab === "fields" ? selectedFieldKey : null}
              onReset={reset}
              onCollapse={() => toggleCode(false)}
              labels={codeLabels}
              treeLabels={treeLabels}
            />
          ) : (
            <button
              type="button"
              onClick={() => toggleCode(true)}
              aria-label={t("mbExpand")}
              className="flex h-full min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-input text-xs text-muted-foreground hover:text-foreground lg:w-10 lg:flex-col"
            >
              <span className="lg:rotate-90 lg:whitespace-nowrap">CODE</span>
            </button>
          )}
        </div>
      </div>
```

(收合時右欄在 lg 縮成 `lg:w-10` 窄直條 —— grid 欄寬由內容決定?**不行**,grid 欄已固定 minmax。**定案**:收合時整個 grid 換 class —— `codeOpen ? "lg:grid-cols-[minmax(320px,1fr)_minmax(380px,1fr)]" : "lg:grid-cols-[1fr_2.5rem]"`,展開條在窄直條內。)

(d) `fieldsLabels` memo 補三鍵(fieldSummary 用 `t("mbFieldSummary", { n: rows.length, f: rows.filter((r) => r.filterable).length })` —— **注意**:含佔位鍵必須 t() 帶值;memo deps 需含 rows 或改為每 render 計算 —— **定案:fieldSummary 不進 memo,單獨常數逐 render 算**,memo 只放靜態鍵);`codeLabels` memo(metaTitle/schemaTitle/tryTitle 沿用既有三鍵 + collapse/expand/showAll)

(e) import 成功後不動選取(既定決策①);但 selectedId 對應的 row 可能已不存在(匯入換 rows)→ **`handleImportMeta`/`handleImportFields`/`reset` 內加 `setSelectedId(null)`**(防 stale id)

- [ ] **Step 4: 跑測試確認通過 + 全量**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/ && pnpm -F web exec vitest run src/tools/index.spec.ts src/i18n/ && pnpm -F web lint && pnpm -F web check-types`
Expected: 全 PASS(ui.spec 10 條:parity 1 + 既有 6 調整版 + 新 3)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/metadata-builder/ui.tsx apps/web/src/tools/metadata-builder/ui.spec.tsx apps/web/src/tools/metadata-builder/messages.ts
git commit -m "feat(web): metadata-builder studio split layout with collapse and fragment wiring

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: e2e + 全量驗證 + 截圖(含窄幅)+ HOLD PR

**Files:**
- Modify: `apps/web/e2e/metadata-builder.e2e.ts`(既有 1 條調整 + 新 1 條)
- 無其他新程式;截圖(scratchpad)與 PR

- [ ] **Step 1: e2e 調整與新增**

既有測試:「declaring a filterable field surfaces it in the try-filter editor」——「+ condition」現在在程式碼面板的 try 頁籤:hydration gate 後加 `await page.getByRole("button", { name: "try filter", exact: true }).click();` 再走原流程(field 下拉含 author.name 斷言不變)。

新增:

```ts
test("selecting a field switches the code panel to its json fragment", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByTestId("meta-json")).toBeVisible({ timeout: 15_000 });

  await expect(async () => {
    await page.getByRole("button", { name: "Protocol", exact: true }).click();
    await expect(page.getByRole("switch")).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Fields", exact: true }).click();

  await page.getByRole("option", { name: /price/ }).click();
  await expect(page.getByTestId("meta-json")).toContainText('"key": "price"');
  await expect(page.getByTestId("meta-json")).not.toContainText('"request"');

  await page.getByRole("button", { name: "show all" }).click();
  await expect(page.getByTestId("meta-json")).toContainText('"request"');
});
```

- [ ] **Step 2: 全量檢查 + build + e2e**

Run: `pnpm build:packages && pnpm test && pnpm -F web build`
Expected: 全綠

Run: `E2E_PORT=3013 pnpm -F web test:e2e e2e/metadata-builder.e2e.ts`
Expected: 2 條 PASS

- [ ] **Step 3: 截圖(light + dark + 窄幅,對照 mockup C 段)**

production build 起服(3013),拍:① 分割檢視(選中 price,inspector + 片段模式)② 收合態(窄直條)③ try filter 頁籤加一條條件 ④ **900px 視窗直疊態**(程式碼面板收合列)。light/dark 各一輪;逐張與 mockup C 段對照(kind pill 配色、清單密度、程式碼面板頁籤)。截圖存 scratchpad,回報附絕對路徑。

- [ ] **Step 4: push + HOLD PR**

```bash
git push -u origin feat-metadata-studio
gh pr create --title "refactor: metadata builder studio split view with inspector and code panel" --body "$(cat <<'EOF'
## Summary
- the metadata-builder tool adopts the Studio direction picked from three mocked visual directions: a field LIST (line numbers, colored kind pills, flag badges) + single-field INSPECTOR on the left, and an always-on collapsible CODE PANEL on the right (meta.json / schema / try-filter tabs, lightweight json coloring)
- cause-and-effect made visible: selecting a field switches the meta tab to that field's json fragment (show-all escape); copy/download always export the full document
- responsive: ≥lg split with min-width guards; below lg the code panel stacks under the editor; collapse state persists in localStorage (first-visit default follows the viewport)
- pure visual/interaction round — model, import/export, zod gating, localStorage meta behavior and all sibling panels unchanged; zero changesets; existing test semantics preserved (selectors rewritten for the new interaction flow, no assertions weakened)

**HOLD: do not merge** — pending user review.

Spec: docs/superpowers/specs/2026-07-11-metadata-studio-design.md
Plan: docs/superpowers/plans/2026-07-11-metadata-studio.md
Direction mockup: docs/mockups/2026-07-11-metadata-builder-visual-directions.html (C)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR 建立,回報 PR 連結 + 截圖絕對路徑,等使用者 review/merge。
