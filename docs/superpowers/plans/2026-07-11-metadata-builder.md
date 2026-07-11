# Metadata Builder 工具實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/tools/metadata-builder` 工具 —— authoring `DataResourceMeta`(欄位 kind/enum 值域/協定),匯入/匯出 meta.json,恆在預覽衍生的 `FieldSchema[]` 與可試篩的 FilterTreeEditor。

**Architecture:** 標準工具骨架(`index.ts`/`ui.tsx`/純邏輯/`messages.ts`)+ 三個編輯面板(fields/protocol/import,labels-as-props)+ 恆在 derived-preview。meta 是單一真相(useState + localStorage),`model.ts` 提供 `metaToRows`/`rowsToMeta` 編輯投影與 label 雙語轉換。引擎全部純消費(`parseDataResourceMeta`/`inferFieldsFromRows`/`fieldsToFilterSchema`/`FilterTreeEditor`)。

**Tech Stack:** TypeScript、React 19 + next-intl、zod(經 data-schema)、Vitest + @testing-library/react、Playwright。

## Global Constraints

- 規格:`docs/superpowers/specs/2026-07-10-metadata-builder-design.md`;mockup:`docs/mockups/2026-07-10-metadata-builder.html`(已使用者確認,版面以它為準)
- 工作目錄(worktree 根):`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-metadata-panel` — 所有指令在此執行
- **紅線:不碰 `apps/web/src/tools/table-builder/**` 與 `apps/web/src/app/api/**`(平行 #14 session 所有)**;`apps/workbench/**`、所有引擎套件(`data-schema`/`filter-builder`/`filter-builder-ui`/`table-builder`/`table-builder-ui`)、form-builder 系 —— 零改動,純 import
- 共用檔只做**加法**:`apps/web/src/tools/index.ts`、`apps/web/src/tools/messages.ts`、`packages/web-core/src/registry/tools.ts` 各加一筆,不重排既有項
- label 雙語規則(spec §3.2):兩欄不同 → `{ en, 'zh-TW' }`;單欄或同值 → 字串;匯入 map 的**其他語系鍵原樣保留**(只覆寫 en/zh-TW)
- localStorage key:`rfjs.metadata-builder.meta`;讀出必過 `parseDataResourceMeta`,壞資料靜默回預設;SSR 安全(首繪用預設,讀取放 effect)
- i18n:en 與 zh-TW 同步增鍵(`mb` 前綴);本工具無模板訊息(不需 t.raw)
- lint `--max-warnings 0`;既有測試不得刪弱
- Changesets:`@rfjs/web-core` patch(registry 一筆);apps 不寫;引擎零改動無 changeset
- Commit:conventional、小寫 subject ≤90 字元、trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;pre-commit hook 失敗先讀輸出修好,不可 --no-verify
- 已知環境噪音:`@rfjs/db` lint 與 `@rfjs/form-builder` typecheck 在 main 上就壞(與本輪無關)

---

### Task 1: `model.ts` 純邏輯 —— 編輯投影、label 雙語、預設樣本

**Files:**
- Create: `apps/web/src/tools/metadata-builder/model.ts`
- Test: `apps/web/src/tools/metadata-builder/model.spec.ts`

**Interfaces:**
- Consumes: `DataFieldMeta`/`DataResourceMeta`/`LocalizedLabel`/`FieldFormat`(`@rfjs/data-schema` type)
- Produces(後續 task 依賴,名稱與簽名固定):
  - `interface FieldRow { id: string; key: string; labelEn: string; labelZh: string; labelRest?: Record<string, string>; dataType: 'string'|'numeric'|'date'|'boolean'; format?: FieldFormat; sortable: boolean; filterable: boolean; kind?: 'column'|'jsonb'; options: OptionRow[] }`
  - `interface OptionRow { id: string; value: string; labelEn: string; labelZh: string; labelRest?: Record<string, string> }`
  - `metaToRows(fields: DataFieldMeta[], makeId: () => string): FieldRow[]`
  - `rowsToMeta(rows: FieldRow[]): DataFieldMeta[]`(空 key 列略過;options 空陣列省略鍵;value 依 dataType 不轉型 —— option value 一律存字串,v1 簡化並記為已知限制)
  - `labelToInputs(label: LocalizedLabel | undefined): { en: string; zh: string; rest?: Record<string, string> }`
  - `inputsToLabel(en: string, zh: string, rest?: Record<string, string>): LocalizedLabel`
  - `formatOptionsFor(dataType: FieldRow['dataType']): FieldFormat[]`
  - `DEFAULT_META: DataResourceMeta`(與 table-builder 工具樣本同形但獨立定義:id/title/price/createdAt/inStock/author.name/status 七欄,含 kind/filterable/enum、offset 分頁 request、`filter: { style: 'pg', param: 'filter' }`、response paths)

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/metadata-builder/model.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseDataResourceMeta } from "@rfjs/data-schema";

import {
  DEFAULT_META,
  formatOptionsFor,
  inputsToLabel,
  labelToInputs,
  metaToRows,
  rowsToMeta,
  type FieldRow,
} from "./model";

let n = 0;
const makeId = () => `id-${n++}`;

function row(partial: Partial<FieldRow>): FieldRow {
  return {
    id: "r1",
    key: "k",
    labelEn: "K",
    labelZh: "",
    dataType: "string",
    sortable: false,
    filterable: false,
    options: [],
    ...partial,
  };
}

describe("labelToInputs / inputsToLabel", () => {
  it("string label lands in the en input; round-trips back to a string", () => {
    expect(labelToInputs("Price")).toEqual({ en: "Price", zh: "", rest: undefined });
    expect(inputsToLabel("Price", "")).toBe("Price");
  });

  it("two different values produce an en/zh-TW map; same values collapse to a string", () => {
    expect(inputsToLabel("Price", "價格")).toEqual({ en: "Price", "zh-TW": "價格" });
    expect(inputsToLabel("Price", "Price")).toBe("Price");
  });

  it("preserves other locale keys through a round-trip", () => {
    const src = { en: "Price", "zh-TW": "價格", ja: "価格" };
    const inputs = labelToInputs(src);
    expect(inputs).toEqual({ en: "Price", zh: "價格", rest: { ja: "価格" } });
    expect(inputsToLabel("Cost", inputs.zh, inputs.rest)).toEqual({ en: "Cost", "zh-TW": "價格", ja: "価格" });
  });

  it("zh-only input becomes a plain string", () => {
    expect(inputsToLabel("", "價格")).toBe("價格");
  });
});

describe("metaToRows / rowsToMeta", () => {
  it("round-trips a field including kind/options and omits absent optionals", () => {
    const fields = [
      {
        key: "status",
        label: { en: "Status", "zh-TW": "狀態" },
        dataType: "string" as const,
        filterable: true,
        kind: "column" as const,
        options: [{ value: "draft", label: "Draft" }],
      },
      { key: "price", label: "Price", dataType: "numeric" as const, format: "currency" as const },
    ];
    const rows = metaToRows(fields, makeId);
    expect(rows[0]).toMatchObject({ key: "status", labelEn: "Status", labelZh: "狀態", kind: "column", filterable: true });
    expect(rows[0]!.options[0]).toMatchObject({ value: "draft", labelEn: "Draft" });

    const back = rowsToMeta(rows);
    expect(back).toEqual(fields);
  });

  it("drops rows with a blank key and omits empty options arrays", () => {
    const rows = [row({ key: "  " }), row({ key: "ok", options: [] })];
    const back = rowsToMeta(rows);
    expect(back).toEqual([{ key: "ok", label: "K", dataType: "string" }]);
  });

  it("omits sortable/filterable when false and keeps them when true", () => {
    const back = rowsToMeta([row({ key: "a", sortable: true }), row({ key: "b" })]);
    expect(back[0]).toEqual({ key: "a", label: "K", dataType: "string", sortable: true });
    expect("sortable" in back[1]!).toBe(false);
    expect("filterable" in back[1]!).toBe(false);
  });
});

describe("formatOptionsFor", () => {
  it("filters formats by dataType", () => {
    expect(formatOptionsFor("numeric")).toEqual(["integer", "decimal", "percent", "currency"]);
    expect(formatOptionsFor("date")).toEqual(["date", "datetime", "time"]);
    expect(formatOptionsFor("string")).toEqual([]);
    expect(formatOptionsFor("boolean")).toEqual([]);
  });
});

describe("DEFAULT_META", () => {
  it("passes parseDataResourceMeta and demonstrates kind/filterable/enum/protocol", () => {
    const parsed = parseDataResourceMeta(DEFAULT_META);
    expect(parsed.fields.some((f) => f.kind === "jsonb")).toBe(true);
    expect(parsed.fields.some((f) => (f.options?.length ?? 0) > 0)).toBe(true);
    expect(parsed.request?.filter).toEqual({ style: "pg", param: "filter" });
    expect(parsed.response?.rowsPath).toBe("data.items");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/model.spec.ts`
Expected: FAIL —— `Cannot find module './model'`(全數紅)

- [ ] **Step 3: 實作**

`apps/web/src/tools/metadata-builder/model.ts`:

```ts
import type { DataFieldMeta, DataResourceMeta, FieldFormat, LocalizedLabel } from "@rfjs/data-schema";

// Edit-model projection (design spec §3.1/§6): `meta` is the single source of truth; rows carry a
// UI-only `id` and split the LocalizedLabel into en/zh-TW inputs (other locale keys ride along in
// `labelRest` untouched — spec §3.2's preservation rule).

export interface OptionRow {
  id: string;
  value: string;
  labelEn: string;
  labelZh: string;
  labelRest?: Record<string, string>;
}

export interface FieldRow {
  id: string;
  key: string;
  labelEn: string;
  labelZh: string;
  labelRest?: Record<string, string>;
  dataType: "string" | "numeric" | "date" | "boolean";
  format?: FieldFormat;
  sortable: boolean;
  filterable: boolean;
  kind?: "column" | "jsonb";
  options: OptionRow[];
}

const ZH = "zh-TW";

export function labelToInputs(label: LocalizedLabel | undefined): { en: string; zh: string; rest?: Record<string, string> } {
  if (label === undefined) return { en: "", zh: "", rest: undefined };
  if (typeof label === "string") return { en: label, zh: "", rest: undefined };
  const { en = "", [ZH]: zh = "", ...rest } = label;
  return { en, zh, rest: Object.keys(rest).length > 0 ? rest : undefined };
}

export function inputsToLabel(en: string, zh: string, rest?: Record<string, string>): LocalizedLabel {
  const hasRest = rest !== undefined && Object.keys(rest).length > 0;
  if (!hasRest) {
    if (en && zh && en !== zh) return { en, [ZH]: zh };
    return en || zh; // 單欄或同值 → 字串
  }
  const out: Record<string, string> = { ...rest };
  if (en) out.en = en;
  if (zh) out[ZH] = zh;
  return out;
}

const NUMERIC_FORMATS: FieldFormat[] = ["integer", "decimal", "percent", "currency"];
const DATE_FORMATS: FieldFormat[] = ["date", "datetime", "time"];

export function formatOptionsFor(dataType: FieldRow["dataType"]): FieldFormat[] {
  return dataType === "numeric" ? NUMERIC_FORMATS : dataType === "date" ? DATE_FORMATS : [];
}

export function metaToRows(fields: DataFieldMeta[], makeId: () => string): FieldRow[] {
  return fields.map((f) => {
    const label = labelToInputs(f.label);
    return {
      id: makeId(),
      key: f.key,
      labelEn: label.en,
      labelZh: label.zh,
      labelRest: label.rest,
      dataType: f.dataType,
      format: f.format,
      sortable: f.sortable ?? false,
      filterable: f.filterable ?? false,
      kind: f.kind,
      options: (f.options ?? []).map((o) => {
        const ol = labelToInputs(o.label);
        return { id: makeId(), value: String(o.value), labelEn: ol.en, labelZh: ol.zh, labelRest: ol.rest };
      }),
    };
  });
}

export function rowsToMeta(rows: FieldRow[]): DataFieldMeta[] {
  return rows
    .filter((r) => r.key.trim().length > 0)
    .map((r) => {
      const field: DataFieldMeta = {
        key: r.key,
        label: inputsToLabel(r.labelEn, r.labelZh, r.labelRest),
        dataType: r.dataType,
      };
      if (r.format !== undefined) field.format = r.format;
      if (r.options.length > 0) {
        // v1 known limitation (plan Task 1 Interfaces): option value is always stored as a string
        field.options = r.options.map((o) => ({ value: o.value, label: inputsToLabel(o.labelEn, o.labelZh, o.labelRest) }));
      }
      if (r.sortable) field.sortable = true;
      if (r.filterable) field.filterable = true;
      if (r.kind !== undefined) field.kind = r.kind;
      return field;
    });
}

/** 預設樣本 —— 與 table-builder 工具的 SAMPLE_META 同形但獨立定義(紅線:不 import 該目錄)。 */
export const DEFAULT_META: DataResourceMeta = {
  fields: [
    { key: "id", label: "ID", dataType: "string", sortable: true, kind: "column" },
    { key: "title", label: "Title", dataType: "string", sortable: true, filterable: true, kind: "column" },
    { key: "price", label: { en: "Price", "zh-TW": "價格" }, dataType: "numeric", format: "currency", sortable: true, filterable: true, kind: "column" },
    { key: "createdAt", label: "Created", dataType: "date", format: "date", sortable: true },
    { key: "inStock", label: "In stock", dataType: "boolean" },
    { key: "author.name", label: "Author", dataType: "string", sortable: true, filterable: true, kind: "jsonb" },
    {
      key: "status",
      label: "Status",
      dataType: "string",
      filterable: true,
      kind: "column",
      options: [
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
        { value: "archived", label: "Archived" },
      ],
    },
  ],
  request: {
    endpoint: "/api/sample/items",
    method: "POST",
    pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
    sort: { style: "single", param: "sort", encoding: "colon" },
    filter: { style: "pg", param: "filter" },
  },
  response: { rowsPath: "data.items", totalPath: "data.total", cursorPath: "data.nextCursor" },
};
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/model.spec.ts`
Expected: PASS(9 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/metadata-builder/model.ts apps/web/src/tools/metadata-builder/model.spec.ts
git commit -m "feat(web): metadata-builder edit model with bilingual labels and default sample

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `fields-panel.tsx` —— 欄位編輯器(含 options 子編輯器與驗證標記)

**Files:**
- Create: `apps/web/src/tools/metadata-builder/fields-panel.tsx`
- Test: `apps/web/src/tools/metadata-builder/fields-panel.spec.tsx`

**Interfaces:**
- Consumes: Task 1 的 `FieldRow`/`OptionRow`/`formatOptionsFor`
- Produces:

```ts
export interface FieldsPanelLabels {
  key: string; labelEn: string; labelZh: string; dataType: string; format: string; formatNone: string;
  sortable: string; filterable: string; kind: string; kindNone: string; options: string;
  addField: string; addOption: string; remove: string; dupKey: string; blankKey: string;
}
export function FieldsPanel({ rows, onChange, labels }: {
  rows: FieldRow[];
  onChange: (rows: FieldRow[]) => void;
  labels: FieldsPanelLabels;
})
```

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/metadata-builder/fields-panel.spec.tsx`:

```tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FieldsPanel } from "./fields-panel";
import type { FieldRow } from "./model";

const LABELS = {
  key: "key", labelEn: "Label (en)", labelZh: "Label (zh-TW)", dataType: "type", format: "format",
  formatNone: "—", sortable: "sortable", filterable: "filterable", kind: "kind", kindNone: "—",
  options: "options", addField: "+ field", addOption: "+ option", remove: "remove",
  dupKey: "duplicate key", blankKey: "key required",
};

function row(partial: Partial<FieldRow>): FieldRow {
  return {
    id: partial.key ?? "r", key: "k", labelEn: "K", labelZh: "", dataType: "string",
    sortable: false, filterable: false, options: [], ...partial,
  };
}

describe("FieldsPanel", () => {
  it("edits a key and reports the full rows array through onChange", () => {
    const onChange = vi.fn();
    render(<FieldsPanel rows={[row({ key: "price", id: "r1" })]} onChange={onChange} labels={LABELS} />);

    fireEvent.change(screen.getByDisplayValue("price"), { target: { value: "cost" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0][0]).toMatchObject({ id: "r1", key: "cost" });
  });

  it("changing dataType clears an incompatible format", () => {
    const onChange = vi.fn();
    render(
      <FieldsPanel rows={[row({ key: "price", dataType: "numeric", format: "currency" })]} onChange={onChange} labels={LABELS} />,
    );

    fireEvent.change(screen.getByDisplayValue("numeric"), { target: { value: "string" } });

    expect(onChange.mock.calls[0]![0][0]).toMatchObject({ dataType: "string", format: undefined });
  });

  it("adds and removes a field row", () => {
    const onChange = vi.fn();
    render(<FieldsPanel rows={[row({ key: "a" })]} onChange={onChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "+ field" }));
    expect(onChange.mock.calls[0]![0]).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "remove" })[0]!);
    expect(onChange.mock.calls[1]![0]).toHaveLength(0);
  });

  it("toggles the options sub-editor and edits an option pair", () => {
    const onChange = vi.fn();
    render(
      <FieldsPanel
        rows={[row({ key: "status", options: [{ id: "o1", value: "draft", labelEn: "Draft", labelZh: "" }] })]}
        onChange={onChange}
        labels={LABELS}
      />,
    );

    // options 開合鈕以該列 options 數為可視文字(mockup:數字徽章)
    fireEvent.click(screen.getByRole("button", { name: /options/ }));
    const box = screen.getByTestId("options-editor");
    fireEvent.change(within(box).getByDisplayValue("draft"), { target: { value: "d1" } });

    expect(onChange.mock.calls[0]![0][0].options[0]).toMatchObject({ value: "d1" });
  });

  it("marks duplicate and blank keys", () => {
    render(<FieldsPanel rows={[row({ key: "a", id: "r1" }), row({ key: "a", id: "r2" }), row({ key: "", id: "r3" })]} onChange={vi.fn()} labels={LABELS} />);

    expect(screen.getAllByText("duplicate key")).toHaveLength(2);
    expect(screen.getByText("key required")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/fields-panel.spec.tsx`
Expected: FAIL —— `Cannot find module './fields-panel'`

- [ ] **Step 3: 實作**

`apps/web/src/tools/metadata-builder/fields-panel.tsx`(視覺照 mockup 的 Fields 表;結構重點如下,樣式用既有 tailwind 慣例):

```tsx
"use client";

import * as React from "react";

import { Button } from "@rfjs/web-ui/components/button";

import { formatOptionsFor, type FieldRow, type OptionRow } from "./model";

export interface FieldsPanelLabels {
  key: string; labelEn: string; labelZh: string; dataType: string; format: string; formatNone: string;
  sortable: string; filterable: string; kind: string; kindNone: string; options: string;
  addField: string; addOption: string; remove: string; dupKey: string; blankKey: string;
}

const DATA_TYPES: FieldRow["dataType"][] = ["string", "numeric", "date", "boolean"];
const KINDS: NonNullable<FieldRow["kind"]>[] = ["column", "jsonb"];

export function FieldsPanel({
  rows,
  onChange,
  labels,
}: {
  rows: FieldRow[];
  onChange: (rows: FieldRow[]) => void;
  labels: FieldsPanelLabels;
}) {
  const [openOptions, setOpenOptions] = React.useState<string | null>(null);

  const dupKeys = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.key, (seen.get(r.key) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([k, n]) => k.trim() !== "" && n > 1).map(([k]) => k));
  }, [rows]);

  function patch(id: string, partial: Partial<FieldRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  }

  function patchDataType(row: FieldRow, dataType: FieldRow["dataType"]) {
    // dataType 事後改 → 不相容 format 自動清掉(spec §3.4)
    const format = row.format !== undefined && formatOptionsFor(dataType).includes(row.format) ? row.format : undefined;
    patch(row.id, { dataType, format });
  }

  function addField() {
    onChange([
      ...rows,
      { id: crypto.randomUUID(), key: "", labelEn: "", labelZh: "", dataType: "string", sortable: false, filterable: false, options: [] },
    ]);
  }

  function patchOption(row: FieldRow, optionId: string, partial: Partial<OptionRow>) {
    patch(row.id, { options: row.options.map((o) => (o.id === optionId ? { ...o, ...partial } : o)) });
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 表頭 + 每列:key / labelEn / labelZh / dataType select / format select(依 formatOptionsFor)
          / sortable / filterable checkbox / kind select(kindNone + KINDS)/ options 開合鈕 / remove。
          key 欄:r.key 為空 → 顯示 labels.blankKey;dupKeys.has(r.key) → 顯示 labels.dupKey(紅字)。
          options 開合鈕 aria-label 含 labels.options;點擊 setOpenOptions(open === r.id ? null : r.id)。 */}
      {rows.map((r) => (
        <React.Fragment key={r.id}>
          {/* ...每列輸入,onChange 透過 patch/patchDataType... */}
          {openOptions === r.id && (
            <div data-testid="options-editor" className="ml-6 rounded-md border border-dashed border-input bg-muted/30 p-2">
              {r.options.map((o) => (
                <div key={o.id} className="flex items-center gap-2 py-0.5">
                  {/* value / labelEn / labelZh 輸入 → patchOption;移除鈕 → patch(options 過濾) */}
                </div>
              ))}
              <Button size="xs" variant="outline" onClick={() => patchOption /* 實作:append 新 OptionRow(crypto.randomUUID) */}>
                {labels.addOption}
              </Button>
            </div>
          )}
        </React.Fragment>
      ))}
      <div>
        <Button size="sm" variant="outline" onClick={addField}>{labels.addField}</Button>
      </div>
    </div>
  );
}
```

(上方骨架中兩處註解是**結構指引**,實作時展開成完整 JSX。硬性要求:dataType/format/kind 都用**原生 `<select>` 且 option 的顯示文字 = value**(RTL 的 `getByDisplayValue` 對 select 匹配的是選中 option 的文字);key/label/option 用原生 `<input>`;checkbox 用 `aria-label={labels.sortable}`/`filterable`;options 開合鈕 `aria-label` 含 `labels.options`;所有變更走 `patch` 回報完整 rows 陣列。)

- [ ] **Step 4: 跑測試確認通過 + lint**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/fields-panel.spec.tsx && pnpm -F web lint`
Expected: PASS(5 tests);lint 綠

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/metadata-builder/fields-panel.tsx apps/web/src/tools/metadata-builder/fields-panel.spec.tsx
git commit -m "feat(web): metadata-builder fields panel with options editor and key validation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `protocol-panel.tsx` —— request/response 協定編輯器

**Files:**
- Create: `apps/web/src/tools/metadata-builder/protocol-panel.tsx`
- Test: `apps/web/src/tools/metadata-builder/protocol-panel.spec.tsx`

**Interfaces:**
- Consumes: `RequestMeta`/`ResponseMeta`/`PaginationMeta`/`SortMeta`/`FilterRequestMeta`(`@rfjs/data-schema` type)
- Produces:

```ts
export interface ProtocolPanelLabels {
  enabled: string; endpoint: string; method: string; pagination: string; sort: string; sortNone: string;
  filter: string; filterNone: string; filterParam: string; rowsPath: string; totalPath: string; cursorPath: string;
  limitParam: string; offsetParam: string; pageParam: string; pageSizeParam: string; firstPage: string;
  cursorParam: string; sortParam: string; encoding: string; fieldParam: string; dirParam: string;
}
export function ProtocolPanel({ request, response, onChange, labels }: {
  request: RequestMeta | undefined;
  response: ResponseMeta | undefined;
  onChange: (next: { request: RequestMeta | undefined; response: ResponseMeta | undefined }) => void;
  labels: ProtocolPanelLabels;
})
```

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/metadata-builder/protocol-panel.spec.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProtocolPanel } from "./protocol-panel";
import type { RequestMeta, ResponseMeta } from "@rfjs/data-schema";

const LABELS = {
  enabled: "declare protocol", endpoint: "endpoint", method: "method", pagination: "pagination",
  sort: "sort", sortNone: "no sort", filter: "filter", filterNone: "none", filterParam: "filter param",
  rowsPath: "rowsPath", totalPath: "totalPath", cursorPath: "cursorPath",
  limitParam: "limitParam", offsetParam: "offsetParam", pageParam: "pageParam", pageSizeParam: "pageSizeParam",
  firstPage: "firstPage", cursorParam: "cursorParam", sortParam: "sort param", encoding: "encoding",
  fieldParam: "fieldParam", dirParam: "dirParam",
};

const REQUEST: RequestMeta = {
  endpoint: "/api/items",
  method: "POST",
  pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
  filter: { style: "pg", param: "filter" },
};
const RESPONSE: ResponseMeta = { rowsPath: "data.items", totalPath: "data.total" };

describe("ProtocolPanel", () => {
  it("toggling the enable switch off reports undefined request/response", () => {
    const onChange = vi.fn();
    render(<ProtocolPanel request={REQUEST} response={RESPONSE} onChange={onChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("switch", { name: "declare protocol" }));

    expect(onChange).toHaveBeenCalledWith({ request: undefined, response: undefined });
  });

  it("toggling on from empty seeds a minimal offset request + response", () => {
    const onChange = vi.fn();
    render(<ProtocolPanel request={undefined} response={undefined} onChange={onChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("switch", { name: "declare protocol" }));

    const next = onChange.mock.calls[0]![0];
    expect(next.request.endpoint).toBe("/api/example");
    expect(next.request.pagination.strategy).toBe("offset");
    expect(next.response.rowsPath).toBe("");
  });

  it("switching pagination strategy swaps the param inputs and rewrites pagination", () => {
    const onChange = vi.fn();
    render(<ProtocolPanel request={REQUEST} response={RESPONSE} onChange={onChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "cursor" }));

    const next = onChange.mock.calls[0]![0];
    expect(next.request.pagination).toEqual({ strategy: "cursor", cursorParam: "cursor", limitParam: "limit" });
  });

  it("editing endpoint and filter param write through", () => {
    const onChange = vi.fn();
    render(<ProtocolPanel request={REQUEST} response={RESPONSE} onChange={onChange} labels={LABELS} />);

    fireEvent.change(screen.getByLabelText("endpoint"), { target: { value: "/api/x" } });
    expect(onChange.mock.calls[0]![0].request.endpoint).toBe("/api/x");

    fireEvent.change(screen.getByLabelText("filter param"), { target: { value: "q" } });
    expect(onChange.mock.calls[1]![0].request.filter).toEqual({ style: "pg", param: "q" });
  });

  it("selecting filter none removes the filter declaration", () => {
    const onChange = vi.fn();
    render(<ProtocolPanel request={REQUEST} response={RESPONSE} onChange={onChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "none" }));

    expect(onChange.mock.calls[0]![0].request.filter).toBeUndefined();
  });
});
```

注意:fixture 的 `sortNone` 刻意用 `"no sort"`(≠ `filterNone` 的 `"none"`)—— 否則最後一條測試的 `{ name: "none" }` 會同時命中 sort 與 filter 的 none 鈕而多重匹配。實作的 i18n 也照此(en `mbSortNone: "no sort"`)。

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/protocol-panel.spec.tsx`
Expected: FAIL —— `Cannot find module './protocol-panel'`

- [ ] **Step 3: 實作**

`apps/web/src/tools/metadata-builder/protocol-panel.tsx` 要點(視覺照 mockup Protocol 頁):

- 頂部 `Switch`(`@rfjs/web-ui/components/switch`,`aria-label={labels.enabled}`):
  - 關 → `onChange({ request: undefined, response: undefined })`
  - 開(從空)→ seed:`{ request: { endpoint: "/api/example", pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" } }, response: { rowsPath: "" } }`(endpoint 不可空 —— `requestMetaSchema` 是 `min(1)`,空字串會讓恆在預覽的 `parseDataResourceMeta` 直接 throw)
- request/response 未宣告時面板其餘部分不渲染
- method:GET/POST segmented(button + `aria-pressed`);pagination:offset/page/cursor segmented,**切換策略時整個 pagination 重建為該策略的預設參數名**(offset: limit/offset;page: page/pageSize;cursor: cursor/limit);各策略的參數名輸入 `aria-label` 用對應 labels
- sort:none/single/split segmented(none → 移除 `sort` 鍵;single 預設 `{ style:'single', param:'sort', encoding:'colon' }`,encoding colon/signed segmented;split 預設 `{ style:'split', fieldParam:'sortBy', dirParam:'order' }`)
- filter:none/pg segmented(none → 移除 `filter` 鍵;pg 預設 `{ style:'pg', param:'filter' }`)+ param 輸入(`aria-label={labels.filterParam}`)
- response:rowsPath/totalPath/cursorPath 三個 text 輸入(後兩者空字串 → 存 undefined 省略鍵)
- 所有輸入用 `<label>` 包或 `aria-label`,測試以 `getByLabelText` 可及

- [ ] **Step 4: 跑測試確認通過 + lint**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/protocol-panel.spec.tsx && pnpm -F web lint`
Expected: PASS(5 tests);lint 綠

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/metadata-builder/protocol-panel.tsx apps/web/src/tools/metadata-builder/protocol-panel.spec.tsx
git commit -m "feat(web): metadata-builder protocol panel for request and response meta

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `import-panel.tsx` —— meta.json 驗證匯入 + 樣本 rows infer 起手

**Files:**
- Create: `apps/web/src/tools/metadata-builder/import-panel.tsx`
- Test: `apps/web/src/tools/metadata-builder/import-panel.spec.tsx`

**Interfaces:**
- Consumes: `parseDataResourceMeta`/`inferFieldsFromRows`(`@rfjs/data-schema`)
- Produces:

```ts
export interface ImportPanelLabels {
  modeMeta: string; modeRows: string; placeholderMeta: string; placeholderRows: string;
  load: string; upload: string; invalidJson: string; hint: string;
}
export function ImportPanel({ onMeta, onFields, labels }: {
  onMeta: (meta: DataResourceMeta) => void;      // meta.json 模式:整份取代
  onFields: (fields: DataFieldMeta[]) => void;   // rows 模式:只換 fields
  labels: ImportPanelLabels;
})
```

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/metadata-builder/import-panel.spec.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImportPanel } from "./import-panel";

const LABELS = {
  modeMeta: "meta.json", modeRows: "sample rows", placeholderMeta: "paste meta json…",
  placeholderRows: "paste rows json…", load: "Load", upload: "Upload .json",
  invalidJson: "Invalid JSON.", hint: "hint",
};

describe("ImportPanel", () => {
  it("loads a valid meta.json through onMeta", () => {
    const onMeta = vi.fn();
    render(<ImportPanel onMeta={onMeta} onFields={vi.fn()} labels={LABELS} />);

    fireEvent.change(screen.getByPlaceholderText("paste meta json…"), {
      target: { value: '{"fields":[{"key":"a","label":"A","dataType":"string"}]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(onMeta).toHaveBeenCalledWith({ fields: [{ key: "a", label: "A", dataType: "string" }] });
  });

  it("shows a zod error for schema-invalid meta and does not call onMeta", () => {
    const onMeta = vi.fn();
    render(<ImportPanel onMeta={onMeta} onFields={vi.fn()} labels={LABELS} />);

    fireEvent.change(screen.getByPlaceholderText("paste meta json…"), {
      target: { value: '{"fields":[{"key":"a","label":"A","dataType":"string","format":"currency"}]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(onMeta).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/format|compatible/i);
  });

  it("shows the invalid-json message for malformed text", () => {
    render(<ImportPanel onMeta={vi.fn()} onFields={vi.fn()} labels={LABELS} />);

    fireEvent.change(screen.getByPlaceholderText("paste meta json…"), { target: { value: "not json {" } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(screen.getByRole("alert").textContent).toBe("Invalid JSON.");
  });

  it("rows mode infers fields and calls onFields only", () => {
    const onMeta = vi.fn();
    const onFields = vi.fn();
    render(<ImportPanel onMeta={onMeta} onFields={onFields} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "sample rows" }));
    fireEvent.change(screen.getByPlaceholderText("paste rows json…"), {
      target: { value: '[{"name":"Ada","age":36}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(onMeta).not.toHaveBeenCalled();
    expect(onFields).toHaveBeenCalledWith([
      { key: "name", label: "name", dataType: "string" },
      { key: "age", label: "age", dataType: "numeric" },
    ]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/import-panel.spec.tsx`
Expected: FAIL —— `Cannot find module './import-panel'`

- [ ] **Step 3: 實作**

`apps/web/src/tools/metadata-builder/import-panel.tsx` 要點(視覺照 mockup Import 頁):

- 模式 segmented(meta.json / sample rows,button + `aria-pressed`);textarea 依模式換 placeholder;上傳走 label 包 `<input type="file">`(比照 table-builder source-panel 的模式 —— 不與 Load 鈕撞名)
- Load:`JSON.parse` 失敗 → `setError(labels.invalidJson)`;meta 模式 → `parseDataResourceMeta`(zod throw → **取 `err.issues?.[0]?.message ?? labels.invalidJson`** —— zod v4 的 `err.message` 是 issues 陣列的 JSON 字串、首行是 `[`,不可直接顯示;duck-typing 讀 `issues` 免 import zod)成功 `onMeta(parsed)` 並清空錯誤;rows 模式 → `inferFieldsFromRows`(throw 同樣進錯誤條)成功 `onFields(fields)`
- 錯誤條 `role="alert"`;成功後清 textarea 與錯誤

- [ ] **Step 4: 跑測試確認通過 + lint**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/import-panel.spec.tsx && pnpm -F web lint`
Expected: PASS(4 tests);lint 綠

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/metadata-builder/import-panel.tsx apps/web/src/tools/metadata-builder/import-panel.spec.tsx
git commit -m "feat(web): metadata-builder import panel with zod gate and infer seeding

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `derived-preview.tsx` —— meta JSON + FieldSchema + 試篩 FilterTreeEditor

**Files:**
- Create: `apps/web/src/tools/metadata-builder/derived-preview.tsx`
- Test: `apps/web/src/tools/metadata-builder/derived-preview.spec.tsx`

**Interfaces:**
- Consumes: `fieldsToFilterSchema`(`@rfjs/table-builder-ui`)、`FilterTreeEditor`+`FilterTreeLabels`(`@rfjs/filter-builder-ui`)、`emptyGroup`+`BuilderGroup`(`@rfjs/filter-builder`)、`parseDataResourceMeta`(`@rfjs/data-schema`)
- Produces:

```ts
export interface DerivedPreviewLabels {
  metaTitle: string; schemaTitle: string; tryTitle: string; emptySchema: string;
  copy: string; copied: string; download: string; reset: string;
}
export function DerivedPreview({ meta, onReset, labels, treeLabels }: {
  meta: DataResourceMeta;
  onReset: () => void;
  labels: DerivedPreviewLabels;
  treeLabels: FilterTreeLabels;
})
```

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/metadata-builder/derived-preview.spec.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DerivedPreview } from "./derived-preview";
import { DEFAULT_META } from "./model";

const LABELS = {
  metaTitle: "meta", schemaTitle: "schema", tryTitle: "try filter", emptySchema: "declare a filterable field first",
  copy: "Copy", copied: "Copied", download: "Download meta.json", reset: "Reset",
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

describe("DerivedPreview", () => {
  it("renders the meta json and the derived FieldSchema for filterable+kind fields", () => {
    render(<DerivedPreview meta={DEFAULT_META} onReset={vi.fn()} labels={LABELS} treeLabels={TREE_LABELS} />);

    const metaJson = screen.getByTestId("meta-json");
    expect(metaJson.textContent).toContain('"fields"');
    expect(metaJson.textContent).toContain('"filter"');

    const schemaJson = screen.getByTestId("schema-json");
    expect(schemaJson.textContent).toContain('"author.name"');
    expect(schemaJson.textContent).not.toContain('"createdAt"'); // not filterable
  });

  it("mounts a filter tree editor fed by the derived schema", () => {
    render(<DerivedPreview meta={DEFAULT_META} onReset={vi.fn()} labels={LABELS} treeLabels={TREE_LABELS} />);
    expect(screen.getByRole("button", { name: "+ condition" })).toBeTruthy();
  });

  it("shows the empty-schema hint when no field is filterable with a kind", () => {
    render(
      <DerivedPreview
        meta={{ fields: [{ key: "a", label: "A", dataType: "string" }] }}
        onReset={vi.fn()}
        labels={LABELS}
        treeLabels={TREE_LABELS}
      />,
    );
    expect(screen.getByText("declare a filterable field first")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ condition" })).toBeNull();
  });

  it("copy flips to copied; download builds a blob and clicks an anchor; reset calls back", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const onReset = vi.fn();
    render(<DerivedPreview meta={DEFAULT_META} onReset={onReset} labels={LABELS} treeLabels={TREE_LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"fields"'));

    fireEvent.click(screen.getByRole("button", { name: "Download meta.json" }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalled();
    click.mockRestore();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/derived-preview.spec.tsx`
Expected: FAIL —— `Cannot find module './derived-preview'`

- [ ] **Step 3: 實作**

`apps/web/src/tools/metadata-builder/derived-preview.tsx` 要點(視覺照 mockup 預覽區,兩欄 grid):

- `const json = React.useMemo(() => JSON.stringify(parseDataResourceMeta(meta), null, 2), [meta])`(zod 正規化後輸出;meta 由編輯器產生理論上恆合法 —— 若 parse throw,以 try/catch 顯示錯誤條而非白屏,spec §7)
- `const schema = React.useMemo(() => fieldsToFilterSchema(meta.fields), [meta.fields])`
- 試篩樹:`useState(() => emptyGroup(() => crypto.randomUUID()))` 本地 state;`schema.length === 0` → 顯示 `labels.emptySchema`,否則 `<FilterTreeEditor group={tree} engineId="pg-filter" schema={schema} onChange={setTree} onCreateField={() => {}} labels={treeLabels} />`
- Copy(try/catch + copied 狀態,meta 變更時 reset —— 比照 #239 metadata-panel)、下載 `meta.json`(Blob `application/json`)、Reset 鈕呼叫 `onReset`
- `<pre data-testid="meta-json">` 與 `<pre data-testid="schema-json">`

- [ ] **Step 4: 跑測試確認通過 + lint**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/derived-preview.spec.tsx && pnpm -F web lint`
Expected: PASS(4 tests);lint 綠

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/metadata-builder/derived-preview.tsx apps/web/src/tools/metadata-builder/derived-preview.spec.tsx
git commit -m "feat(web): metadata-builder derived preview with schema projection and try-filter

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 組裝 —— `ui.tsx` + registry + messages + localStorage

**Files:**
- Create: `apps/web/src/tools/metadata-builder/ui.tsx`、`apps/web/src/tools/metadata-builder/index.ts`、`apps/web/src/tools/metadata-builder/messages.ts`
- Modify: `apps/web/src/tools/index.ts`(import + 陣列尾加一筆)、`apps/web/src/tools/messages.ts`(同)、`packages/web-core/src/registry/tools.ts`(陣列尾加一筆)、`apps/web/src/tools/index.spec.ts`(`EXPECTED_WEB_TOOL_IDS` 按**字母序**插入 `"metadata-builder"` —— 該 spec 是 sorted 比對,位置錯會紅)
- Test: `apps/web/src/tools/metadata-builder/ui.spec.tsx`
- Create: `.changeset/web-core-metadata-builder.md`

**Interfaces:**
- Consumes: Tasks 1–5 全部
- Produces: `/tools/metadata-builder` 完整頁面;registry 條目 `{ id: 'metadata-builder', category: 'generator', surface: 'web', status: 'preview', relatedPackages: ['@rfjs/data-schema'], tags: ['metadata', 'schema', 'builder'] }`(sidebar 分區由 relatedPackages[0] = data-schema 驅動,category 沿用既有 enum 不新增)

- [ ] **Step 1: messages.ts**

`apps/web/src/tools/metadata-builder/messages.ts` —— `LocaleMessages` 形狀(比照其他工具):`Tools['metadata-builder']` 的 title/description(en: "Metadata Builder" / "Author a data resource's metadata — field kinds, enum domains, and the request/response protocol — then hand it to any consumer as meta.json.";zh-TW: "資源綱要設計器" / "authoring 資料資源的 metadata —— 欄位 kind、enum 值域與請求/回應協定,匯出 meta.json 供任何消費者使用。")+ `ToolUI` 鍵(`mb` 前綴,en/zh-TW 同步):

```
mbEyebrow("METADATA BUILDER"/"資源綱要設計器")、mbTabFields("Fields"/"欄位")、mbTabProtocol("Protocol"/"協定")、
mbTabImport("Import"/"匯入")、mbPreviewTitle("Derived artifacts"/"衍生產物")、
mbKey/mbLabelEn/mbLabelZh/mbDataType/mbFormat/mbFormatNone/mbSortable/mbFilterable/mbKind/mbKindNone/
mbOptions/mbAddField/mbAddOption/mbRemove/mbDupKey/mbBlankKey、
mbProtoEnabled/mbEndpoint/mbMethod/mbPagination/mbSort/mbSortNone/mbFilter/mbFilterNone/mbFilterParam/
mbRowsPath/mbTotalPath/mbCursorPath/mbLimitParam/mbOffsetParam/mbPageParam/mbPageSizeParam/mbFirstPage/
mbCursorParam/mbSortParam/mbEncoding/mbFieldParam/mbDirParam、
mbModeMeta/mbModeRows/mbPlaceholderMeta/mbPlaceholderRows/mbLoad/mbUpload/mbInvalidJson/mbImportHint、
mbMetaTitle/mbSchemaTitle/mbTryTitle/mbEmptySchema/mbCopy/mbCopied/mbDownload/mbReset、
mbTreeAnd/mbTreeOr/mbTreeNor/mbTreeNot/mbTreeAddCond/mbTreeAddGroup/mbTreeRemoveGroup/mbTreeRemoveCond/mbTreeElemMatch
```

(英文值照 Tasks 2–5 測試 fixture 的字串;zh-TW 對應翻譯,ex. mbSortNone en "no sort" / zh-TW "不排序"。)

- [ ] **Step 2: 寫失敗測試(ui.spec.tsx)**

`apps/web/src/tools/metadata-builder/ui.spec.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";

import { messages } from "./messages";
import { MetadataBuilderTool } from "./ui";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
      <MetadataBuilderTool />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe("messages parity", () => {
  // 既有 i18n 閘(src/i18n/messages.spec.ts)只保護中央目錄;工具片段的 en/zh-TW 不對稱沒人抓 —— 自己守。
  it("en and zh-TW fragments declare identical key sets", () => {
    const en = messages.en as Record<string, Record<string, unknown>>;
    const zh = messages["zh-TW"] as Record<string, Record<string, unknown>>;
    expect(Object.keys(zh.ToolUI!).sort()).toEqual(Object.keys(en.ToolUI!).sort());
    expect(Object.keys(zh.Tools!).sort()).toEqual(Object.keys(en.Tools!).sort());
  });
});

describe("MetadataBuilderTool", () => {
  it("tabs swap the editor panel while the derived preview stays visible", () => {
    renderTool();

    expect(screen.getByRole("button", { name: "+ field" })).toBeTruthy(); // default Fields
    fireEvent.click(screen.getByRole("button", { name: "Protocol" }));
    expect(screen.queryByRole("button", { name: "+ field" })).toBeNull();
    expect(screen.getByTestId("meta-json")).toBeTruthy(); // preview always on
  });

  it("editing a field key reflects into the preview json", () => {
    renderTool();

    fireEvent.change(screen.getByDisplayValue("price"), { target: { value: "cost" } });

    expect(screen.getByTestId("meta-json").textContent).toContain('"key": "cost"');
    // 注意用完整 "key": 前綴 —— label 仍是 "Price"(大寫),裸 "price" 斷言只靠大小寫僥倖通過
    expect(screen.getByTestId("meta-json").textContent).not.toContain('"key": "price"');
  });

  it("meta.json import replaces the whole meta", () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(screen.getByPlaceholderText("paste meta json…"), {
      target: { value: '{"fields":[{"key":"only","label":"Only","dataType":"string"}]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    const json = screen.getByTestId("meta-json").textContent!;
    expect(json).toContain('"only"');
    expect(json).not.toContain('"request"'); // 整份取代,舊 request 不留
  });

  it("rows import replaces fields but keeps the protocol", () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "sample rows" }));
    fireEvent.change(screen.getByPlaceholderText("paste rows json…"), {
      target: { value: '[{"sku":"x1"}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    const json = screen.getByTestId("meta-json").textContent!;
    expect(json).toContain('"sku"');
    expect(json).toContain('"request"'); // 協定保留
  });

  it("persists edits to localStorage and restores them on remount", () => {
    const { unmount } = renderTool();
    fireEvent.change(screen.getByDisplayValue("price"), { target: { value: "cost" } });
    unmount();

    renderTool();
    expect(screen.getByTestId("meta-json").textContent).toContain('"cost"');
  });

  it("silently falls back to the default sample when localStorage holds garbage", () => {
    localStorage.setItem("rfjs.metadata-builder.meta", "{broken");
    renderTool();
    expect(screen.getByTestId("meta-json").textContent).toContain('"price"');
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/ui.spec.tsx`
Expected: FAIL —— `Cannot find module './ui'`(全數紅)

- [ ] **Step 4: 實作**

(a) `ui.tsx` 要點:

- state:`const [meta, setMeta] = React.useState<DataResourceMeta>(DEFAULT_META);` + `const [tab, setTab] = React.useState<'fields'|'protocol'|'import'>('fields');` + rows 投影:`const [rows, setRows] = React.useState<FieldRow[]>(() => metaToRows(DEFAULT_META.fields, () => crypto.randomUUID()));`
- **同步規則(單一真相是 meta)**:Fields 編輯 → `setRows(next)` 且 `setMeta(m => ({ ...m, fields: rowsToMeta(next) }))`;Import/Reset **整份換 meta 時同步重建 rows**(`metaToRows`);Protocol 只動 request/response 不碰 rows
- localStorage(**順序有硬性要求** —— 寫入 effect 若在還原前跑會把儲存值蓋成預設):

```tsx
  const restoredRef = React.useRef(false);
  React.useEffect(() => {            // 1) 還原 —— 必須宣告在寫入 effect 之前
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = parseDataResourceMeta(JSON.parse(raw));
        setMeta(parsed);
        setRows(metaToRows(parsed.fields, () => crypto.randomUUID()));
      }
    } catch { /* 壞資料靜默回預設(spec §6) */ }
    restoredRef.current = true;
  }, []);
  React.useEffect(() => {            // 2) 持久化 —— 還原完成前不寫
    if (!restoredRef.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  }, [meta]);
```

  Reset → `localStorage.removeItem(STORAGE_KEY)` + 回 `DEFAULT_META` + 重建 rows(`STORAGE_KEY = "rfjs.metadata-builder.meta"` 模組常數)
- 版面:eyebrow(`mbEyebrow`)→ 三頁籤(segmented,同 #239 視覺)→ 當前面板 → 恆在 `<DerivedPreview meta={meta} onReset={reset} labels={…} treeLabels={…} />`
- labels memos:fields/protocol/import/preview 各一個 useMemo(mb* 鍵);treeLabels 用 `mbTree*` 鍵(`FilterTreeLabels` 必填欄:logic/addCondition/addGroup/removeGroup/removeCondition/elemMatch —— 其餘選填省略)
- Import 成功(兩種模式)後 `setTab('fields')`(spec §5)

(b) `index.ts`:

```ts
import type { ToolModule } from "@/tools/types";

import { MetadataBuilderTool } from "./ui";

export const tool: ToolModule = { id: "metadata-builder", Component: MetadataBuilderTool };
```

(c) `apps/web/src/tools/index.ts`:import 區加 `import { tool as metadataBuilder } from "./metadata-builder";`,`toolModules` 陣列尾加 `metadataBuilder`。`apps/web/src/tools/messages.ts` 同型(import + 陣列尾)。**同步** `apps/web/src/tools/index.spec.ts` 的 `EXPECTED_WEB_TOOL_IDS`:在字母序正確位置插入 `"metadata-builder"`(介於 `"jwt-decoder"` 與 `"mongo-query-builder"` 之間;該測試把實際 id `.sort()` 後與此陣列 `toEqual`)。

(d) `packages/web-core/src/registry/tools.ts` 陣列尾加:

```ts
  {
    id: 'metadata-builder',
    category: 'generator',
    surface: 'web',
    status: 'preview',
    relatedPackages: ['@rfjs/data-schema'],
    tags: ['metadata', 'schema', 'builder'],
  },
```

(e) `.changeset/web-core-metadata-builder.md`:

```md
---
"@rfjs/web-core": patch
---

register the metadata-builder tool (data-schema authoring surface)
```

- [ ] **Step 5: 跑測試確認通過 + 全工具測試 + lint/typecheck**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/ src/tools/index.spec.ts src/i18n/ && pnpm -F @rfjs/web-core vitest:run && pnpm -F web lint && pnpm -F web check-types`
Expected: 全 PASS(ui 7 + 各面板;web-core registry spec 含新條目仍綠 —— 若該 spec 斷言工具總數,同步 +1 並在報告註明);lint/typecheck 綠

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tools/metadata-builder/ apps/web/src/tools/index.ts apps/web/src/tools/messages.ts apps/web/src/tools/index.spec.ts packages/web-core/src/registry/tools.ts .changeset/web-core-metadata-builder.md
git commit -m "feat(web): assemble the metadata-builder tool and register it

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: e2e + 全量驗證 + 截圖 + HOLD PR

**Files:**
- Create: `apps/web/e2e/metadata-builder.e2e.ts`
- 無其他新程式;產出截圖(session scratchpad)與 PR

**Interfaces:**
- Consumes: Tasks 1–6 全部
- Produces: 綠的全量檢查、e2e、light/dark 截圖(對照 mockup)、HOLD PR

- [ ] **Step 1: e2e**

`apps/web/e2e/metadata-builder.e2e.ts`:

```ts
import { test, expect } from "@playwright/test";

const URL = "/en/tools/metadata-builder";

test("declaring a filterable field surfaces it in the try-filter editor", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByTestId("meta-json")).toBeVisible({ timeout: 15_000 });

  // Hydration gate(#240 教訓):等頁籤切換真的生效(React handler 已掛上)再互動
  await expect(async () => {
    await page.getByRole("button", { name: "Protocol", exact: true }).click();
    await expect(page.getByRole("switch")).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Fields", exact: true }).click();

  // 預設樣本已含 filterable 欄位;試篩編輯器加一條條件,欄位下拉應含 author.name
  await page.getByRole("button", { name: "+ condition" }).click();
  await page.getByRole("combobox", { name: "field" }).click();
  await expect(page.getByRole("option", { name: "author.name" })).toBeVisible();
});
```

(combobox/option 的 aria 名稱以既有 table-builder e2e 的 FilterTreeEditor selector 慣例為準:`combobox { name: "field" }`。)

- [ ] **Step 2: 全量檢查 + build + e2e**

Run: `pnpm build:packages && pnpm test`
Expected: 全綠(turbo ~49 tasks)

Run: `pnpm -F web build`
Expected: 成功(新頁 `/tools/metadata-builder` 進 build 輸出)

Run: `E2E_PORT=3013 pnpm -F web test:e2e e2e/metadata-builder.e2e.ts`
Expected: 1 條 PASS

- [ ] **Step 3: 真渲染截圖(light + dark,對照 mockup)**

production build 起服(port 3013),Playwright 拍:Fields 頁籤(含 options 子編輯器展開)、Protocol 頁籤、Import 頁籤、預覽區(試篩加一條條件後)。light + dark 各一輪;逐張與 `docs/mockups/2026-07-10-metadata-builder.html` 對照檢視。截圖存 session scratchpad,回報附絕對路徑。

- [ ] **Step 4: push + HOLD PR**

```bash
git push -u origin feat-metadata-panel
gh pr create --title "feat: metadata builder tool for authoring data resource metadata" --body "$(cat <<'EOF'
## Summary
- new `/tools/metadata-builder` tool — the authoring surface for `DataResourceMeta`: field declarations (kind / dataType / filterable / format / enum option domains) with bilingual (en + zh-TW) labels, a request/response protocol editor, and meta.json import/export interoperable with the table-builder metadata tab
- "infer to start, author to finish": paste sample rows to seed fields via `inferFieldsFromRows`, then declare what inference cannot produce (kind, enum domains, governance flags)
- always-on derived preview: normalized meta json (copy / download / reset), the projected `FieldSchema[]`, and a live try-filter `FilterTreeEditor` fed by the authored schema
- `@rfjs/web-core` (patch): registry entry; engines untouched (pure consumption)

**HOLD: do not merge** — pending user review.

Spec: docs/superpowers/specs/2026-07-10-metadata-builder-design.md
Plan: docs/superpowers/plans/2026-07-11-metadata-builder.md
Mockup: docs/mockups/2026-07-10-metadata-builder.html

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR 建立,回報 PR 連結 + 截圖絕對路徑,等使用者 review/merge。
