# apps/web `es-query-builder` Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a registry-driven `apps/web` tool that visually builds a filter-tree and compiles it live to an Elasticsearch / OpenSearch query (via `getEngine('es-query')`), and register `@rfjs/es-query` + `@rfjs/es-client` in the `@rfjs/web-core` package registry.

**Architecture:** Clone the existing `mongo-query-builder` tool (the closest sibling): a `ToolModule` descriptor, a `"use client"` `ui.tsx` reusing the shared `_filter-builder` helpers + `FilterTreeEditor` with `engineId="es-query"`, an i18n `messages.ts`, and a render spec. Register it in the two `apps/web/src/tools` aggregators and the `web-core` `toolRegistry`/`packageRegistry`.

**Tech Stack:** Next.js (React 19, `"use client"`), next-intl, Vitest + Testing Library, `@rfjs/filter-builder`, `@rfjs/filter-builder-ui`, `@rfjs/web-core`.

## Global Constraints

- **No dialect toggle.** The canonical builder can only emit operators whose ES/OpenSearch output is byte-identical (divergent clauses like `combined_fields` are unreachable from the tree). A toggle would show no difference, so the output is simply labeled as valid for both. (Documented deviation from design §3's "dialect toggle".)
- **i18n keys** under `ToolUI` use a unique `eqb*` prefix (the `index.spec.ts` collision test fails otherwise). The tool's `Tools.<id>` title/description must exist in both `en` and `zh-TW`.
- **Registry rules** (enforced by `web-core/registry.spec.ts`): a web-surface tool must declare ≥1 `relatedPackages`; tool ids unique; `relatedPackages` must exist in `packageRegistry`; `relatedTools` must exist in `toolRegistry`.
- Tests: Vitest. Commit per green step. Neutral copy only — no source-project references.

---

## File Structure

```
packages/web-core/src/registry/packages.ts   # + @rfjs/es-query, @rfjs/es-client entries
packages/web-core/src/registry/tools.ts       # + es-query-builder entry
apps/web/src/tools/es-query-builder/
  index.ts            # ToolModule descriptor
  ui.tsx              # "use client" builder UI (engineId es-query)
  messages.ts         # i18n (en + zh-TW)
  ui.spec.tsx         # render test
apps/web/src/tools/index.ts                    # + register component
apps/web/src/tools/messages.ts                 # + register messages fragment
apps/web/src/tools/index.spec.ts               # + es-query-builder in EXPECTED_WEB_TOOL_IDS
```

---

### Task 1: Register packages + tool in `@rfjs/web-core`

**Files:**
- Modify: `packages/web-core/src/registry/packages.ts`
- Modify: `packages/web-core/src/registry/tools.ts`

**Interfaces:**
- Produces: `packageRegistry` includes `@rfjs/es-query` (relatedTools `['es-query-builder']`) and `@rfjs/es-client`; `toolRegistry` includes the `es-query-builder` definition.

- [ ] **Step 1: Add the two package entries**

In `packages/web-core/src/registry/packages.ts`, insert after the `@rfjs/filter-builder` entry (and add `es-query-builder` to filter-builder's `relatedTools`):
```ts
  {
    name: '@rfjs/es-query',
    status: 'preview',
    href: '/packages/es-query',
    github: GITHUB,
    tags: ['elasticsearch', 'opensearch', 'query'],
    relatedTools: ['es-query-builder'],
  },
  {
    name: '@rfjs/es-client',
    status: 'preview',
    href: '/packages/es-client',
    github: GITHUB,
    tags: ['elasticsearch', 'opensearch', 'client'],
  },
```
And update the `@rfjs/filter-builder` entry's `relatedTools` to append `'es-query-builder'`:
```ts
    relatedTools: ['data-filter-builder', 'jsonb-query-builder', 'sql-filter-builder', 'mongo-query-builder', 'es-query-builder'],
```

- [ ] **Step 2: Add the tool registry entry**

In `packages/web-core/src/registry/tools.ts`, add after the `mongo-query-builder` entry:
```ts
  {
    id: 'es-query-builder',
    category: 'query',
    surface: 'web',
    status: 'preview',
    relatedPackages: ['@rfjs/es-query', '@rfjs/filter-builder'],
    tags: ['builder', 'playground'],
  },
```

- [ ] **Step 3: Run the registry tests**

Run: `pnpm -F @rfjs/web-core vitest:run`
Expected: PASS — schema valid, ids unique, `relatedPackages`/`relatedTools` cross-references resolve.

- [ ] **Step 4: Commit**

```bash
git add packages/web-core/src/registry/packages.ts packages/web-core/src/registry/tools.ts
git commit -m "feat(web-core): register es-query/es-client packages and es-query-builder tool"
```

---

### Task 2: The `es-query-builder` tool module

**Files:**
- Create: `apps/web/src/tools/es-query-builder/index.ts`
- Create: `apps/web/src/tools/es-query-builder/ui.tsx`
- Create: `apps/web/src/tools/es-query-builder/messages.ts`
- Create: `apps/web/src/tools/es-query-builder/ui.spec.tsx`
- Modify: `apps/web/src/tools/index.ts`
- Modify: `apps/web/src/tools/messages.ts`
- Modify: `apps/web/src/tools/index.spec.ts`

**Interfaces:**
- Consumes: `getEngine`, `treeToFilterGroup` from `@rfjs/filter-builder`; `FilterTreeEditor`, `FilterTreeLabels` from `@rfjs/filter-builder-ui`; shared helpers from `@/tools/_filter-builder`.
- Produces: `export const tool: ToolModule = { id: "es-query-builder", Component: EsQueryBuilder }`; `export const messages: LocaleMessages`.

- [ ] **Step 1: Write `messages.ts`**

Create `apps/web/src/tools/es-query-builder/messages.ts`:
```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "es-query-builder": {
        title: "ES Query Builder",
        description:
          "Visually build a boolean filter over sample JSON and see it compiled live to an Elasticsearch / OpenSearch bool query (valid for both).",
      },
    },
    ToolUI: {
      eqbFilterLogic: "Filter logic",
      eqbFields: "Fields",
      eqbSample: "Sample JSON",
      eqbInvalidSample: "Invalid JSON — open to fix",
      eqbRaw: "raw ({count})",
      eqbUpload: "Upload",
      eqbInclude: "include {field}",
      eqbType: "type {field}",
      eqbOutput: "Compiled query",
      eqbQuery: "Elasticsearch / OpenSearch",
      eqbCanonical: "'{ }'",
      eqbCanonicalHint: "Canonical filter (editable) — edit to rebuild the tree",
      eqbReverseInvalidJson: "Invalid JSON",
      eqbReverseInvalidShape: "Not a valid filter group",
      eqbCompileError: "Could not compile: {error}",
      eqbCopy: "Copy",
      eqbValueHint: "type, Enter to add",
      eqbToggleGroup: "Collapse / expand group",
      eqbCollapsedConditions: "cond",
      eqbCollapsedGroups: "grp",
      eqbCollapsedEmpty: "empty",
      eqbLogicAnd: "ALL · must",
      eqbLogicOr: "ANY · should",
      eqbLogicNor: "NONE · must_not",
      eqbLogicNot: "NOT · must_not",
      eqbAddCondition: "+ condition",
      eqbAddGroup: "+ group",
      eqbRemoveGroup: "remove group",
      eqbRemoveCondition: "remove condition",
      eqbElemMatch: "elemmatch (nested match)",
    },
  },
  "zh-TW": {
    Tools: {
      "es-query-builder": {
        title: "ES 查詢建構器",
        description:
          "在範例 JSON 上視覺化建構布林篩選條件，並即時查看其編譯為 Elasticsearch / OpenSearch 的 bool query（兩者皆適用）。",
      },
    },
    ToolUI: {
      eqbFilterLogic: "篩選邏輯",
      eqbFields: "欄位",
      eqbSample: "範例 JSON",
      eqbInvalidSample: "JSON 無效 —— 展開修正",
      eqbRaw: "原始（{count}）",
      eqbUpload: "上傳",
      eqbInclude: "納入 {field}",
      eqbType: "型別 {field}",
      eqbOutput: "編譯後查詢",
      eqbQuery: "Elasticsearch / OpenSearch",
      eqbCanonical: "'{ }'",
      eqbCanonicalHint: "Canonical 篩選（可編輯）—— 編輯即反推條件樹",
      eqbReverseInvalidJson: "無效的 JSON",
      eqbReverseInvalidShape: "不是合法的 filter group",
      eqbCompileError: "無法編譯：{error}",
      eqbCopy: "複製",
      eqbValueHint: "輸入後按 Enter 加入",
      eqbToggleGroup: "收合 / 展開群組",
      eqbCollapsedConditions: "條件",
      eqbCollapsedGroups: "群組",
      eqbCollapsedEmpty: "空群組",
      eqbLogicAnd: "全部成立 · must",
      eqbLogicOr: "擇一成立 · should",
      eqbLogicNor: "皆不成立 · must_not",
      eqbLogicNot: "非 · must_not",
      eqbAddCondition: "+ 條件",
      eqbAddGroup: "+ 群組",
      eqbRemoveGroup: "移除群組",
      eqbRemoveCondition: "移除條件",
      eqbElemMatch: "elemmatch（巢狀比對）",
    },
  },
};
```

- [ ] **Step 2: Write `ui.tsx`**

Create `apps/web/src/tools/es-query-builder/ui.tsx`:
```tsx
"use client";

import { getEngine, treeToFilterGroup } from "@rfjs/filter-builder";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  MetadataStrip,
  QueryOutputPanel,
  RISE,
  SampleCard,
  toCompileContext,
  useFilterBuilder,
  useOperatorLabels,
} from "@/tools/_filter-builder";

const SAMPLE = JSON.stringify(
  [
    { status: "open", age: 36, active: true, tags: ["ml", "math"] },
    { status: "closed", age: 12, active: false, tags: ["games"] },
  ],
  null,
  2,
);

export function EsQueryBuilder() {
  const t = useTranslations("ToolUI");
  const operatorLabels = useOperatorLabels();
  const fb = useFilterBuilder({ sample: SAMPLE });

  const treeLabels: FilterTreeLabels = {
    logic: {
      and: t("eqbLogicAnd"),
      or: t("eqbLogicOr"),
      nor: t("eqbLogicNor"),
      not: t("eqbLogicNot"),
    },
    addCondition: t("eqbAddCondition"),
    addGroup: t("eqbAddGroup"),
    removeGroup: t("eqbRemoveGroup"),
    removeCondition: t("eqbRemoveCondition"),
    elemMatch: t("eqbElemMatch"),
    valueHint: t("eqbValueHint"),
    toggleGroup: t("eqbToggleGroup"),
    collapsedConditions: t("eqbCollapsedConditions"),
    collapsedGroups: t("eqbCollapsedGroups"),
    collapsedEmpty: t("eqbCollapsedEmpty"),
    operatorLabels,
  };

  const compiled = useMemo(
    () => getEngine("es-query").compile(treeToFilterGroup(fb.tree), toCompileContext(fb.schema)),
    [fb.tree, fb.schema],
  );

  const reverseText =
    fb.reverseError === "invalidJson"
      ? t("eqbReverseInvalidJson")
      : fb.reverseError === "invalidShape"
        ? t("eqbReverseInvalidShape")
        : null;

  return (
    <div className="flex flex-col gap-5">
      <style>{RISE}</style>

      <SampleCard
        open={fb.sampleOpen}
        onToggle={() => fb.setSampleOpen((v) => !v)}
        value={fb.sampleText}
        onChange={fb.onSample}
        onUpload={(file) => void fb.onUpload(file)}
        hasError={Boolean(fb.error)}
        labels={{
          sample: t("eqbSample"),
          invalidSample: t("eqbInvalidSample"),
          rawCount: t("eqbRaw", { count: fb.rows.length }),
          upload: t("eqbUpload"),
        }}
        style={{ animationDelay: "0ms" }}
      />

      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "70ms" }}>
        <div className="border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("eqbFields")}
          </span>
        </div>
        <div className="p-4">
          <MetadataStrip
            schema={fb.schema}
            onChange={fb.setSchema}
            labels={{
              include: t("eqbInclude", { field: "" }).trim(),
              type: t("eqbType", { field: "" }).trim(),
            }}
          />
        </div>
      </section>

      <section className="fb-rise rounded-lg border bg-card" style={{ animationDelay: "140ms" }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {t("eqbFilterLogic")}
          </span>
        </div>
        <div className="overflow-x-auto p-5 sm:p-6">
          <FilterTreeEditor
            group={fb.tree}
            engineId="es-query"
            schema={fb.schema}
            onChange={fb.setTree}
            onCreateField={fb.onCreateField}
            labels={treeLabels}
          />
        </div>
      </section>

      <div className="fb-rise" style={{ animationDelay: "210ms" }}>
        <QueryOutputPanel
          primary={compiled.ok ? compiled.primary : null}
          secondary={compiled.ok ? (compiled.secondary ?? null) : null}
          canonicalJson={fb.canonicalJson}
          onCanonicalChange={fb.onCanonicalChange}
          labels={{
            output: t("eqbOutput"),
            primaryLabel: t("eqbQuery"),
            secondaryLabel: "",
            canonical: t("eqbCanonical"),
            canonicalHint: t("eqbCanonicalHint"),
            reverseError: reverseText,
            compileError: compiled.ok ? null : t("eqbCompileError", { error: compiled.error }),
            copy: t("eqbCopy"),
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `index.ts`**

```ts
import type { ToolModule } from "@/tools/types";

import { EsQueryBuilder } from "./ui";

export const tool: ToolModule = { id: "es-query-builder", Component: EsQueryBuilder };
```

- [ ] **Step 4: Write `ui.spec.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { messages } from "./messages";
import { EsQueryBuilder } from "./ui";

describe("EsQueryBuilder", () => {
  it("renders the builder and the compiled-query panel", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
        <EsQueryBuilder />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Fields")).toBeTruthy();
    expect(screen.getAllByText("Compiled query").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: Register in the aggregators**

In `apps/web/src/tools/index.ts`:
- add `import { tool as esQueryBuilder } from "./es-query-builder";`
- append `esQueryBuilder` to the `toolModules` array.

In `apps/web/src/tools/messages.ts`:
- add `import { messages as esQueryBuilder } from "./es-query-builder/messages";`
- append `esQueryBuilder` to the `toolMessages` array.

In `apps/web/src/tools/index.spec.ts`, add `"es-query-builder",` to the `EXPECTED_WEB_TOOL_IDS` array (order doesn't matter — the test sorts).

- [ ] **Step 6: Run the apps/web tool tests**

Run: `pnpm -F web vitest:run src/tools/es-query-builder src/tools/index.spec`
Expected: PASS — render test renders; `index.spec` aggregator/catalog/message-id checks all pass.

- [ ] **Step 7: Typecheck the app**

Run: `pnpm -F web typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/tools/es-query-builder apps/web/src/tools/index.ts apps/web/src/tools/messages.ts apps/web/src/tools/index.spec.ts
git commit -m "feat(web): add es-query-builder interactive tool"
```

---

## Self-Review

**Spec coverage (§3 of design — apps/web tool):**
- Interactive tool: tree editor (left) + live compiled ES/OpenSearch JSON (right) → Task 2 (`ui.tsx`). ✅
- Registry-driven (toolRegistry + component/message aggregators) → Tasks 1–2. ✅
- en/zh-TW i18n → Task 2 (`messages.ts`). ✅
- Both packages registered in `packageRegistry` → Task 1. ✅
- Dialect toggle: **intentionally omitted** (documented under Global Constraints) — builder output is dialect-identical, so the panel is labeled for both. ⚠ deviation, by design.

**Placeholder scan:** none — all files have complete content.

**Type consistency:** `tool.id === "es-query-builder"` matches the registry entry (Task 1), the `EXPECTED_WEB_TOOL_IDS` entry, and the `Tools.es-query-builder` message key. `getEngine("es-query")` matches the engine id registered in the filter-builder plan. `eqb*` ToolUI keys are unique (collision test). ✅

---

## Done after this plan

All four subsystems (es-query, es-client, filter-builder engine, apps/web tool) complete. Remaining wrap-up (outside plans): run the full monorepo `pnpm test` + `pnpm typecheck`, then open the PR from `worktree-feat-es-query`.
