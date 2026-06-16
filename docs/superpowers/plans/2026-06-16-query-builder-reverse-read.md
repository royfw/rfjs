# query-builder 反向讀取(B2)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 query-builder 在選到 `data-filter` 引擎時,其 canonical `FilterGroupLike` JSON 輸出**就地可編輯**;debounced parse 後反向回寫中間那棵 canonical tree(唯一真相),並把樹用到、schema 還沒有的欄位補進 schema。SQL view 維持唯讀。

**Architecture:** 純 logic 放 `logic/reverse.ts`(`filterGroupToTree` = `treeToFilterGroup` 的逆、`parseFilterGroup` 結構驗證、`mergeFieldsFromTree` 補欄位)。UI 加 presentational 的 `ui/canonical-editor.tsx`(draft + debounce,文字以 props 傳入故免 i18n provider 即可測)。`ui/index.tsx` 在 `engineId === "data-filter"` 時改渲染它,接 `onParse` → `setTree` + `setSchema`;從 `PreviewPanel` 抽 `LiveMatchView` 兩邊共用。

**Tech Stack:** Next.js(client component)、next-intl、Vitest(jsdom,glob `**/*.spec.(ts|tsx)`,globals:true)、`@testing-library/react`、TypeScript、`@/` alias → `apps/web/src`。

**起點 baseline:** `pnpm -F web exec vitest run` → 115 passed(24 files)。所有指令在 worktree 根 `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat+query-builder-reverse` 執行;commit 用 `--no-verify`,footer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`;commit/PR 一律英文。

---

## 現況型別(只讀,勿改;供引用)

`logic/types.ts`:
```ts
export type LogicOp = "and" | "or" | "nor" | "not";
export type FieldKind = "column" | "jsonb";
export type ScalarType = "string" | "numeric" | "date" | "boolean";
export type FieldType = ScalarType | "object" | "array";
export type ElementType = ScalarType | "object";
export interface BuilderGroup { kind: "group"; id: string; logic: LogicOp; children: BuilderItem[]; }
export interface BuilderCondition { kind: "condition"; id: string; field: string; dataType: FieldType; elementType?: ElementType; operator: string; value?: unknown; filters?: BuilderGroup; }
export type BuilderItem = BuilderGroup | BuilderCondition;
export interface FieldSchema { path: string; dataType: FieldType; elementType?: ElementType; include: boolean; kind: FieldKind; }
```
`logic/compile.ts`:
```ts
export interface FilterGroupLike { logic: string; filters: Array<FilterConditionLike | FilterGroupLike>; }
export interface FilterConditionLike { field: string; dataType: string; elementType?: string; operator: string; value?: unknown; filters?: FilterGroupLike; }
export function treeToFilterGroup(group: BuilderGroup): FilterGroupLike { /* 既有:丟棄不完整條件、去 id、elemmatch 遞迴 */ }
```

## File Structure

```
apps/web/src/tools/query-builder/
  logic/
    reverse.ts        # 新:filterGroupToTree + parseFilterGroup + mergeFieldsFromTree + ReverseError
    reverse.spec.ts   # 新
  ui/
    canonical-editor.tsx       # 新:可編輯框(presentational,props 傳文字)
    canonical-editor.spec.tsx  # 新
    preview-panel.tsx          # 改:抽出並 export LiveMatchView
    index.tsx                  # 改:data-filter 分支接 CanonicalEditor + 反向 wiring
  messages.ts                  # 改:加 ToolUI 扁平 key(canonicalEditable / reverseInvalidJson / reverseInvalidShape)
```

---

## Task 1: `filterGroupToTree`(canonical → tree,round-trip)

**Files:** Create `apps/web/src/tools/query-builder/logic/reverse.ts`, `apps/web/src/tools/query-builder/logic/reverse.spec.ts`

- [ ] **Step 1: 寫失敗測試** — `logic/reverse.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "./compile";
import { filterGroupToTree } from "./reverse";
import type { FilterGroupLike } from "./compile";

const idGen = () => {
  let n = 0;
  return () => `id-${n++}`;
};

describe("filterGroupToTree", () => {
  it("round-trips through treeToFilterGroup (ids dropped on the way back)", () => {
    const g: FilterGroupLike = {
      logic: "and",
      filters: [
        { field: "age", dataType: "numeric", operator: "gt", value: 18 },
        {
          logic: "or",
          filters: [
            { field: "name", dataType: "string", operator: "eq", value: "Ada" },
            { field: "tags", dataType: "array", elementType: "string", operator: "contains", value: "ml" },
          ],
        },
      ],
    };
    expect(treeToFilterGroup(filterGroupToTree(g, idGen()))).toEqual(g);
  });

  it("maps an elemmatch leaf's filters into a nested BuilderGroup, not a group child", () => {
    const g: FilterGroupLike = {
      logic: "and",
      filters: [
        { field: "items", dataType: "array", elementType: "object", operator: "elemmatch", filters: { logic: "and", filters: [{ field: "sku", dataType: "string", operator: "eq", value: "x" }] } },
      ],
    };
    const tree = filterGroupToTree(g, idGen());
    const cond = tree.children[0];
    expect(cond.kind).toBe("condition");
    if (cond.kind === "condition") {
      expect(cond.operator).toBe("elemmatch");
      expect(cond.filters?.kind).toBe("group");
      expect(cond.filters?.children).toHaveLength(1);
    }
    expect(treeToFilterGroup(tree)).toEqual(g);
  });

  it("assigns an id to every node", () => {
    const g: FilterGroupLike = { logic: "and", filters: [{ field: "a", dataType: "string", operator: "eq", value: "1" }] };
    const tree = filterGroupToTree(g, idGen());
    expect(tree.id).toBe("id-0");
    expect(tree.children[0]?.id).toBe("id-1");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `pnpm -F web exec vitest run src/tools/query-builder/logic/reverse.spec.ts` → FAIL(`./reverse` 無法解析)。

- [ ] **Step 3: 實作 `logic/reverse.ts`(本 task 只需 `filterGroupToTree`)**
```ts
import type { FilterConditionLike, FilterGroupLike } from "./compile";
import type {
  BuilderCondition,
  BuilderGroup,
  BuilderItem,
  ElementType,
  FieldType,
  LogicOp,
} from "./types";

// Inverse of treeToFilterGroup: rebuild an editable tree (with ids) from a
// structural filter group. Round-trips: treeToFilterGroup(filterGroupToTree(g)) === g
// for groups whose leaves are complete (field + operator present).
export function filterGroupToTree(group: FilterGroupLike, makeId: () => string): BuilderGroup {
  return {
    kind: "group",
    id: makeId(),
    logic: group.logic as LogicOp,
    children: group.filters.map((item) => toItem(item, makeId)),
  };
}

function toItem(item: FilterConditionLike | FilterGroupLike, makeId: () => string): BuilderItem {
  return "field" in item ? toCondition(item, makeId) : filterGroupToTree(item, makeId);
}

function toCondition(c: FilterConditionLike, makeId: () => string): BuilderCondition {
  const out: BuilderCondition = {
    kind: "condition",
    id: makeId(),
    field: c.field,
    dataType: c.dataType as FieldType,
    operator: c.operator,
  };
  if (c.elementType) out.elementType = c.elementType as ElementType;
  if (c.operator === "elemmatch" && c.filters) {
    out.filters = filterGroupToTree(c.filters, makeId);
  } else if (c.value !== undefined) {
    out.value = c.value;
  }
  return out;
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `pnpm -F web exec vitest run src/tools/query-builder/logic/reverse.spec.ts` → PASS(3 tests)。

- [ ] **Step 5: commit**
```bash
git add apps/web/src/tools/query-builder/logic/reverse.ts apps/web/src/tools/query-builder/logic/reverse.spec.ts
git commit --no-verify -m "$(cat <<'EOF'
feat(web/query-builder): filterGroupToTree for reverse-read

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `parseFilterGroup`(JSON + 結構驗證)

**Files:** Modify `apps/web/src/tools/query-builder/logic/reverse.ts`, `apps/web/src/tools/query-builder/logic/reverse.spec.ts`

- [ ] **Step 1: 追加失敗測試** — 在 `reverse.spec.ts` 末尾追加:
```ts
import { parseFilterGroup } from "./reverse";

describe("parseFilterGroup", () => {
  it("accepts a valid filter group", () => {
    const text = JSON.stringify({ logic: "and", filters: [{ field: "age", dataType: "numeric", operator: "gt", value: 18 }] });
    const r = parseFilterGroup(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.group.filters).toHaveLength(1);
  });

  it("accepts nested groups and elemmatch", () => {
    const text = JSON.stringify({
      logic: "or",
      filters: [
        { logic: "and", filters: [{ field: "a", dataType: "string", operator: "eq", value: "x" }] },
        { field: "items", dataType: "array", elementType: "object", operator: "elemmatch", filters: { logic: "and", filters: [{ field: "sku", dataType: "string", operator: "eq", value: "1" }] } },
      ],
    });
    expect(parseFilterGroup(text).ok).toBe(true);
  });

  it("rejects invalid JSON", () => {
    const r = parseFilterGroup("{ not json");
    expect(r).toEqual({ ok: false, error: "invalidJson" });
  });

  it("rejects a bad logic operator", () => {
    const r = parseFilterGroup(JSON.stringify({ logic: "xor", filters: [] }));
    expect(r).toEqual({ ok: false, error: "invalidShape" });
  });

  it("rejects filters that is not an array", () => {
    const r = parseFilterGroup(JSON.stringify({ logic: "and", filters: {} }));
    expect(r).toEqual({ ok: false, error: "invalidShape" });
  });

  it("rejects a leaf missing field/operator", () => {
    const r = parseFilterGroup(JSON.stringify({ logic: "and", filters: [{ field: "", dataType: "string", operator: "eq" }] }));
    expect(r).toEqual({ ok: false, error: "invalidShape" });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `pnpm -F web exec vitest run src/tools/query-builder/logic/reverse.spec.ts` → FAIL(`parseFilterGroup` 未匯出)。

- [ ] **Step 3: 追加實作到 `logic/reverse.ts`**
```ts
export type ReverseError = "invalidJson" | "invalidShape";

const LOGIC_OPS: readonly string[] = ["and", "or", "nor", "not"];

export function parseFilterGroup(
  text: string,
): { ok: true; group: FilterGroupLike } | { ok: false; error: ReverseError } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  if (!isValidGroup(parsed)) return { ok: false, error: "invalidShape" };
  return { ok: true, group: parsed as FilterGroupLike };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidGroup(v: unknown): boolean {
  if (!isObject(v)) return false;
  if (typeof v.logic !== "string" || !LOGIC_OPS.includes(v.logic)) return false;
  if (!Array.isArray(v.filters)) return false;
  return v.filters.every(isValidItem);
}

function isValidItem(v: unknown): boolean {
  if (!isObject(v)) return false;
  return "field" in v ? isValidLeaf(v) : isValidGroup(v);
}

function isValidLeaf(v: Record<string, unknown>): boolean {
  if (typeof v.field !== "string" || v.field.length === 0) return false;
  if (typeof v.dataType !== "string") return false;
  if (typeof v.operator !== "string" || v.operator.length === 0) return false;
  if (v.operator === "elemmatch" && v.filters !== undefined) return isValidGroup(v.filters);
  return true;
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `pnpm -F web exec vitest run src/tools/query-builder/logic/reverse.spec.ts` → PASS(3 + 6 = 9 tests)。

- [ ] **Step 5: commit**
```bash
git add apps/web/src/tools/query-builder/logic/reverse.ts apps/web/src/tools/query-builder/logic/reverse.spec.ts
git commit --no-verify -m "$(cat <<'EOF'
feat(web/query-builder): parseFilterGroup with shape validation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `mergeFieldsFromTree`(補缺欄位)

**Files:** Modify `apps/web/src/tools/query-builder/logic/reverse.ts`, `apps/web/src/tools/query-builder/logic/reverse.spec.ts`

- [ ] **Step 1: 追加失敗測試**:
```ts
import { mergeFieldsFromTree } from "./reverse";
import type { FieldSchema } from "./types";

describe("mergeFieldsFromTree", () => {
  const base: FieldSchema[] = [{ path: "age", dataType: "numeric", include: true, kind: "column" }];

  it("appends missing fields with kind jsonb and the condition's dataType/elementType", () => {
    const group = { logic: "and", filters: [
      { field: "age", dataType: "numeric", operator: "gt", value: 1 },
      { field: "tags", dataType: "array", elementType: "string", operator: "contains", value: "x" },
    ] } as const;
    const out = mergeFieldsFromTree(base, group);
    expect(out).toHaveLength(2);
    expect(out.find((f) => f.path === "tags")).toEqual({ path: "tags", dataType: "array", elementType: "string", include: true, kind: "jsonb" });
  });

  it("does not touch existing fields (keeps their kind)", () => {
    const group = { logic: "and", filters: [{ field: "age", dataType: "numeric", operator: "gt", value: 1 }] } as const;
    const out = mergeFieldsFromTree(base, group);
    expect(out).toBe(base); // no additions → same reference
    expect(out[0].kind).toBe("column");
  });

  it("includes fields nested in groups and elemmatch", () => {
    const group = { logic: "and", filters: [
      { logic: "or", filters: [{ field: "name", dataType: "string", operator: "eq", value: "a" }] },
      { field: "items", dataType: "array", elementType: "object", operator: "elemmatch", filters: { logic: "and", filters: [{ field: "sku", dataType: "string", operator: "eq", value: "1" }] } },
    ] } as const;
    const out = mergeFieldsFromTree([], group);
    expect(out.map((f) => f.path).sort()).toEqual(["items", "name", "sku"]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `pnpm -F web exec vitest run src/tools/query-builder/logic/reverse.spec.ts` → FAIL(`mergeFieldsFromTree` 未匯出)。

- [ ] **Step 3: 追加實作到 `logic/reverse.ts`**
```ts
import type { FieldSchema } from "./types";

// Append fields referenced by the parsed group but absent from the schema, so
// the builder's field options and the schema-authoritative compile see them.
// Existing fields are left untouched (kind/dataType preserved).
export function mergeFieldsFromTree(schema: FieldSchema[], group: FilterGroupLike): FieldSchema[] {
  const known = new Set(schema.map((f) => f.path));
  const additions: FieldSchema[] = [];

  const walk = (g: FilterGroupLike): void => {
    for (const item of g.filters) {
      if ("field" in item) addLeaf(item);
      else walk(item);
    }
  };
  const addLeaf = (c: FilterConditionLike): void => {
    if (!known.has(c.field)) {
      known.add(c.field);
      const f: FieldSchema = { path: c.field, dataType: c.dataType as FieldType, include: true, kind: "jsonb" };
      if (c.elementType) f.elementType = c.elementType as ElementType;
      additions.push(f);
    }
    if (c.operator === "elemmatch" && c.filters) walk(c.filters);
  };

  walk(group);
  return additions.length ? [...schema, ...additions] : schema;
}
```
(註:`FilterConditionLike` 已在檔首從 `./compile` import;`FieldType`/`ElementType` 已從 `./types` import。新增的 `FieldSchema` import 併入既有 `./types` import 行。)

- [ ] **Step 4: 跑測試確認通過** — Run: `pnpm -F web exec vitest run src/tools/query-builder/logic/reverse.spec.ts` → PASS(9 + 3 = 12 tests)。

- [ ] **Step 5: commit**
```bash
git add apps/web/src/tools/query-builder/logic/reverse.ts apps/web/src/tools/query-builder/logic/reverse.spec.ts
git commit --no-verify -m "$(cat <<'EOF'
feat(web/query-builder): mergeFieldsFromTree for reverse-read schema backfill

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `CanonicalEditor` 元件(presentational + debounce)

文字以 props 傳入(`hint` / `errorText`),故元件**不**用 `useTranslations`,測試免包 i18n provider。

**Files:** Create `apps/web/src/tools/query-builder/ui/canonical-editor.tsx`, `apps/web/src/tools/query-builder/ui/canonical-editor.spec.tsx`

- [ ] **Step 1: 寫失敗測試** — `ui/canonical-editor.spec.tsx`:
```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanonicalEditor } from "./canonical-editor";

afterEach(cleanup);

describe("CanonicalEditor", () => {
  it("calls onParse with the edited text after the debounce window", () => {
    vi.useFakeTimers();
    const onParse = vi.fn();
    render(<CanonicalEditor serialized="{}" errorText={null} hint="edit" onParse={onParse} />);
    const ta = screen.getByLabelText("edit") as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: '{"logic":"and","filters":[]}' } });
    expect(onParse).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onParse).toHaveBeenCalledWith('{"logic":"and","filters":[]}');
    vi.useRealTimers();
  });

  it("does not overwrite the draft from serialized while the box is focused", () => {
    const { rerender } = render(<CanonicalEditor serialized="A" errorText={null} hint="edit" onParse={() => {}} />);
    const ta = screen.getByLabelText("edit") as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: "B" } });
    rerender(<CanonicalEditor serialized="C" errorText={null} hint="edit" onParse={() => {}} />);
    expect(ta.value).toBe("B"); // serialized change ignored while editing
  });

  it("re-syncs the draft from serialized when not editing", () => {
    const { rerender } = render(<CanonicalEditor serialized="A" errorText={null} hint="edit" onParse={() => {}} />);
    const ta = screen.getByLabelText("edit") as HTMLTextAreaElement;
    rerender(<CanonicalEditor serialized="C" errorText={null} hint="edit" onParse={() => {}} />);
    expect(ta.value).toBe("C");
  });

  it("shows errorText when present", () => {
    render(<CanonicalEditor serialized="{}" errorText="bad shape" hint="edit" onParse={() => {}} />);
    expect(screen.getByText("bad shape")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `pnpm -F web exec vitest run src/tools/query-builder/ui/canonical-editor.spec.tsx` → FAIL(`./canonical-editor` 無法解析)。

- [ ] **Step 3: 實作 `ui/canonical-editor.tsx`**
```tsx
"use client";

import { Panel } from "@rfjs/web-ui/components/panel";
import { useEffect, useRef, useState } from "react";

// Editable view of the canonical FilterGroupLike JSON. The tree is the source of
// truth; this box reflects it only when not being edited (avoids clobbering the
// user's draft / cursor). Edits are debounced before calling onParse.
export function CanonicalEditor({
  serialized,
  errorText,
  hint,
  onParse,
}: {
  serialized: string;
  errorText: string | null;
  hint: string;
  onParse: (text: string) => void;
}) {
  const [draft, setDraft] = useState(serialized);
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(serialized);
  }, [serialized, editing]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onChange(text: string) {
    setDraft(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onParse(text), 300);
  }

  return (
    <Panel title={hint}>
      <textarea
        aria-label={hint}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        spellCheck={false}
        rows={12}
        className="w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm"
      />
      {errorText ? <p className="mt-1 font-mono text-sm text-fault">{errorText}</p> : null}
    </Panel>
  );
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `pnpm -F web exec vitest run src/tools/query-builder/ui/canonical-editor.spec.tsx` → PASS(4 tests)。

- [ ] **Step 5: commit**
```bash
git add apps/web/src/tools/query-builder/ui/canonical-editor.tsx apps/web/src/tools/query-builder/ui/canonical-editor.spec.tsx
git commit --no-verify -m "$(cat <<'EOF'
feat(web/query-builder): CanonicalEditor debounced editable JSON view

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 抽 `LiveMatchView` + 接線 index.tsx + i18n + 完整驗證

**Files:** Modify `apps/web/src/tools/query-builder/ui/preview-panel.tsx`, `apps/web/src/tools/query-builder/ui/index.tsx`, `apps/web/src/tools/query-builder/messages.ts`

### 5a. 從 PreviewPanel 抽 `LiveMatchView`(兩邊共用,行為不變)

- [ ] **Step 1: 改 `ui/preview-panel.tsx`** — 抽出並 export `LiveMatchView`,`PreviewPanel` 改用它(輸出/命中區塊外觀不變):
```tsx
"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";

import type { EngineOutput } from "@/tools/query-builder/logic/engines";
import type { LiveMatchResult } from "@/tools/query-builder/logic/live-match";

export function LiveMatchView({ live }: { live: LiveMatchResult }) {
  const t = useTranslations("ToolUI");
  return (
    <div className="border-t border-border pt-2">
      {live.uncoverable ? (
        <p className="font-mono text-xs text-muted-foreground">{t("notPreviewable")}</p>
      ) : (
        <>
          <p className="mb-1 font-mono text-xs text-muted-foreground">{t("matched", { count: live.count })}</p>
          <pre className="max-h-48 overflow-auto font-mono text-xs text-muted-foreground">
            {JSON.stringify(live.matched, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}

export function PreviewPanel({ output, live }: { output: EngineOutput; live: LiveMatchResult }) {
  const t = useTranslations("ToolUI");
  return (
    <Panel
      title={t("output")}
      action={output.ok ? <CopyButton text={output.primary} label={t("copy")} /> : null}
    >
      <div className="flex flex-col gap-3">
        {output.ok ? (
          <>
            <pre className="overflow-x-auto font-mono text-sm text-signal">{output.primary}</pre>
            {output.secondary ? (
              <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">{output.secondary}</pre>
            ) : null}
          </>
        ) : (
          <p className="font-mono text-sm text-fault">{output.error}</p>
        )}
        <LiveMatchView live={live} />
      </div>
    </Panel>
  );
}
```

- [ ] **Step 2: 確認既有測試仍綠** — Run: `pnpm -F web exec vitest run src/tools/query-builder` → PASS(無回歸)。

### 5b. i18n 扁平 key

- [ ] **Step 3: 改 `messages.ts`** — 在 query-builder fragment 的 `ToolUI`(en 與 zh-TW 都要)各加三個**扁平** key(勿用 `error.*` 巢狀,否則與中央 `ToolUI.error` 撞、觸發 A 的碰撞守門測試):
```ts
// en.ToolUI 內追加:
canonicalEditable: "Canonical filter (editable) — edit to rebuild the query",
reverseInvalidJson: "Invalid JSON",
reverseInvalidShape: "Not a valid filter group",
// "zh-TW".ToolUI 內追加:
canonicalEditable: "Canonical 篩選(可編輯)—— 編輯即反推查詢",
reverseInvalidJson: "無效的 JSON",
reverseInvalidShape: "不是合法的 filter group",
```

### 5c. 接線 index.tsx

- [ ] **Step 4: 改 `ui/index.tsx`** — 加反向 state 與 wiring,並在 `engineId === "data-filter"` 改渲染 `CanonicalEditor` + `LiveMatchView`。

新增 import:
```ts
import { filterGroupToTree, mergeFieldsFromTree, parseFilterGroup, type ReverseError } from "@/tools/query-builder/logic/reverse";
import { CanonicalEditor } from "./canonical-editor";
import { PreviewPanel, LiveMatchView } from "./preview-panel";
```
(把原本 `import { PreviewPanel } from "./preview-panel";` 改為上面這行含 `LiveMatchView`。)

在 component 內、`const [tree, setTree] = ...` 之後加:
```ts
const [reverseError, setReverseError] = useState<ReverseError | null>(null);

function onReverseParse(text: string) {
  if (text.trim() === "") {
    setReverseError(null);
    return;
  }
  const r = parseFilterGroup(text);
  if (r.ok) {
    setTree(filterGroupToTree(r.group, id));
    setSchema((s) => mergeFieldsFromTree(s, r.group));
    setReverseError(null);
  } else {
    setReverseError(r.error);
  }
}
```
把 `output={...}` 的內容改成依引擎分支(引擎切換器保留,僅輸出區依 data-filter 切換):
```tsx
output={
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap gap-2">
      {ENGINE_IDS.map((eid) => (
        <Button
          key={eid}
          size="sm"
          variant={eid === engineId ? "default" : "outline"}
          onClick={() => setEngineId(eid)}
        >
          {getEngine(eid).label}
        </Button>
      ))}
    </div>
    {engineId === "data-filter" ? (
      <>
        <CanonicalEditor
          serialized={JSON.stringify(treeToFilterGroup(tree), null, 2)}
          errorText={
            reverseError === "invalidJson"
              ? t("reverseInvalidJson")
              : reverseError === "invalidShape"
                ? t("reverseInvalidShape")
                : null
          }
          hint={t("canonicalEditable")}
          onParse={onReverseParse}
        />
        <LiveMatchView live={live} />
      </>
    ) : (
      <PreviewPanel output={output} live={live} />
    )}
  </div>
}
```
(註:`treeToFilterGroup` 已在檔首 import;`t` 為既有 `useTranslations("ToolUI")`。原 `output` 區塊裡的引擎切換器移到這裡共用,勿重複。)

### 5d. 完整驗證 + commit

- [ ] **Step 5: 完整驗證**
- Run: `pnpm -F web exec vitest run` → 預期全綠(115 baseline + reverse 12 + canonical-editor 4 = 131;若數字略有出入以全綠為準)。
- Run: `pnpm -F web check-types` → 0 errors。
- Run: `pnpm -F web lint` → clean。
- Run: `pnpm -F web build` → 成功,`/tools/[slug]`(含 query-builder)SSG prerender 無錯。

- [ ] **Step 6: commit**
```bash
git add apps/web/src/tools/query-builder
git commit --no-verify -m "$(cat <<'EOF'
feat(web/query-builder): reverse-read editable canonical view

When the data-filter engine is selected, its canonical FilterGroupLike
JSON becomes editable: a debounced parse rewrites the builder tree and
backfills missing schema fields, while invalid input shows an inline
error and leaves the tree unchanged. SQL engines stay read-only.
Extracts LiveMatchView so the live preview shows in both modes.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- **行為(可編輯 data-filter 框 → debounced parse → 回寫樹 + 補 schema)** → Task 5c。✅
- **filterGroupToTree(逆 + elemmatch + id)** → Task 1。✅
- **parseFilterGroup(invalidJson/invalidShape)** → Task 2。✅
- **mergeFieldsFromTree(補缺、保留既有、elemmatch 巢狀)** → Task 3。✅
- **防迴圈(編輯中不回染)+ debounce** → Task 4(CanonicalEditor)+ 測試。✅
- **空字串不報錯不改樹** → Task 5c `onReverseParse` 的 `text.trim() === ""` 早退。✅
- **SQL 唯讀 / live-match 兩邊都在** → Task 5a 抽 `LiveMatchView`、5c 分支。✅
- **i18n 扁平 key 避免 A 碰撞守門** → Task 5b(`canonicalEditable`/`reverseInvalidJson`/`reverseInvalidShape`,非 `error.*`)。✅
- **id 用 crypto.randomUUID(既有 `id`)避免 hydration 雷** → Task 5c 沿用既有 `id`。✅
- **型別一致**:`ReverseError`、`filterGroupToTree(group, makeId)`、`mergeFieldsFromTree(schema, group)`、`CanonicalEditor` props 在各 task 一致。✅

**YAGNI**:不反解 SQL、不做 mongo、不新增 tool、不抽 public lib、不動 sample→infer 與 schema 編輯既有流程。
