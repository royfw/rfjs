# workbench 資料集探索器(Part C)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 apps/workbench 新增「資料集探索器」——用共用樹編輯器對 **datasets 目錄**建構巢狀過濾,執行 `POST /datasets/query`,顯示符合的資料集 + 總數 + 分頁。

**Architecture:** 只動 `apps/workbench`(消費端,Part C)。樹 UI 來自 `@rfjs/filter-builder-ui`(Part B),結構化 filter 來自 `@rfjs/filter-builder` 的 `treeToPgFilterGroup`(Part A)。新增 API client `queryDatasets` + 探索器 client 元件 + 路由頁。後端契約只 consume 不改。

**Tech Stack:** Next.js(App Router,client component)、next-intl、Vitest(jsdom,glob `**/*.spec.(ts|tsx)`,globals)、`@testing-library/react`、`@rfjs/filter-builder`、`@rfjs/filter-builder-ui`、`@rfjs/pg-filter`(型別)。`@` alias → `apps/workbench/src`。

**相依與時序(重要):**
- **Task 1、2 現在就能做**(只依賴後端契約 + 已 ship 的 `@rfjs/filter-builder`/`@rfjs/pg-filter`)。
- **Task 3 BLOCKED ON Part A**(`@rfjs/filter-builder` 對外 `treeToPgFilterGroup(tree, schema)`)。
- **Task 4、5 BLOCKED ON Part B**(`@rfjs/filter-builder-ui` 的 `<FilterTreeEditor>`/`useFilterTree`/`FilterTreeLabels`)。

**已定契約(來自整合版 + 對方確認):**
- Part A:`treeToPgFilterGroup(tree: BuilderGroup, schema: FieldSchema[]): PgFilterGroup`(`@rfjs/filter-builder`)。
- Part B:`<FilterTreeEditor tree schema engineId onChange onCreateField labels />`、`useFilterTree(init?) → { tree, schema, setTree, setSchema, createField }`、`FilterTreeLabels`(`@rfjs/filter-builder-ui`)。

**後端契約(只讀):** `POST {API_BASE_URL}/datasets/query`,body `{ filter?: PgFilterGroup; sort?; page=1; pageSize=20(max 100) }`(zod `.strict()`),回 `{ items: Dataset[]; total; page; pageSize }`;`Dataset = { id; name; description|null; data: Record<string,unknown>; createdAt; updatedAt }`;錯誤映 400。datasets 可篩欄位:column `name/description/createdAt/updatedAt/id`、jsonb `data`。

**起點 baseline:** worktree 根 `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat+query-builder-ui`,先 `pnpm install` + `pnpm build:packages`。`pnpm -F workbench exec vitest run` 應全綠(記下基準數)。commit 用 `--no-verify`,footer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`;commit/PR 英文。

> **語意校正(對整合版的修正):** `/datasets/query` 篩的是 **datasets 表本身**,回符合的 `Dataset[]`——**不是**查某 dataset 內的列。故無「選 dataset」步驟、無 `[id]` 路由、client 為 `queryDatasets(body)` 而非 `queryDataset(id, body)`。

---

## File Structure

```
apps/workbench/src/
  lib/
    datasets.ts          # 擴充:queryDatasets(body) + 型別(Task 1)
    datasets.spec.ts     # 擴充測試(Task 1)
    dataset-schema.ts        # 新:DATASET_FIELD_SCHEMA 固定欄位(Task 2)
    dataset-schema.spec.ts   # 新(Task 2)
    dataset-query.ts         # 新:buildQueryBody(tree, schema, page, pageSize)(Task 3, 需 Part A)
    dataset-query.spec.ts    # 新(Task 3)
  components/explorer/
    dataset-explorer.tsx       # 新:client 探索器(Task 4, 需 Part B)
    dataset-explorer.spec.tsx  # 新(Task 4)
  app/[locale]/(shell)/datasets/explore/
    page.tsx             # 新:路由頁(server 殼 → 渲染 client explorer)(Task 5, 需 Part B)
  messages/{en,zh-TW}.json  # 新增 Explorer 命名空間 + FilterTree labels(Task 4/5)
```

---

## Task 1: `queryDatasets` API client(獨立,現在可做)

**Files:** Modify `apps/workbench/src/lib/datasets.ts`, `apps/workbench/src/lib/datasets.spec.ts`

- [ ] **Step 1: 追加失敗測試** — 在 `datasets.spec.ts` 末尾追加(沿用既有 `vi.stubGlobal("fetch", …)` 模式):
```ts
import { queryDatasets } from "./datasets";

describe("queryDatasets", () => {
  const body = { page: 1, pageSize: 20 } as const;

  it("returns ok with the query result on a 2xx response", async () => {
    const result = { items: [{ id: "1", name: "A", description: null, data: {}, createdAt: "x", updatedAt: "y" }], total: 1, page: 1, pageSize: 20 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(result) }));
    expect(await queryDatasets(body)).toEqual({ ok: true, result });
  });

  it("returns ok with empty items when nothing matches", async () => {
    const result = { items: [], total: 0, page: 1, pageSize: 20 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(result) }));
    expect(await queryDatasets(body)).toEqual({ ok: true, result });
  });

  it("returns not-ok on a non-2xx response (e.g. 400)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ message: "bad" }) }));
    expect(await queryDatasets(body)).toEqual({ ok: false });
  });

  it("returns not-ok when fetch throws (API unreachable)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await queryDatasets(body)).toEqual({ ok: false });
  });

  it("POSTs to /datasets/query with the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20 }) });
    vi.stubGlobal("fetch", fetchMock);
    await queryDatasets(body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/datasets\/query$/);
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(init.body)).toEqual(body);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `pnpm -F workbench exec vitest run src/lib/datasets.spec.ts` → FAIL(`queryDatasets` 未匯出)。

- [ ] **Step 3: 實作 — 追加到 `apps/workbench/src/lib/datasets.ts`**
```ts
import type { PgFilterGroup, PgSort } from "@rfjs/pg-filter";

export type DatasetRow = {
  id: string;
  name: string;
  description: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type QueryDatasetsBody = {
  filter?: PgFilterGroup;
  sort?: PgSort[];
  page?: number;
  pageSize?: number;
};

export type QueryDatasetsResult = {
  items: DatasetRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type QueryResult = { ok: true; result: QueryDatasetsResult } | { ok: false };

export async function queryDatasets(body: QueryDatasetsBody): Promise<QueryResult> {
  const base = process.env.API_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/datasets/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    return { ok: true, result: (await res.json()) as QueryDatasetsResult };
  } catch {
    return { ok: false };
  }
}
```
Add `@rfjs/pg-filter` and `@rfjs/filter-builder` to `apps/workbench/package.json` dependencies (`workspace:*`) if not present, then `pnpm install`. (pg-filter exports `PgFilterGroup`/`PgSort` types.)

- [ ] **Step 4: 跑測試確認通過** — Run: `pnpm -F workbench exec vitest run src/lib/datasets.spec.ts` → PASS。Run: `pnpm -F workbench check-types` → 0 errors。

- [ ] **Step 5: commit**
```bash
git add apps/workbench/src/lib/datasets.ts apps/workbench/src/lib/datasets.spec.ts apps/workbench/package.json
git commit --no-verify -m "$(cat <<'EOF'
feat(workbench): queryDatasets client for POST /datasets/query

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: dataset 固定欄位 schema(獨立,現在可做)

datasets 目錄的可篩欄位是固定已知的(對齊後端 `datasetPgConfig`)。

**Files:** Create `apps/workbench/src/lib/dataset-schema.ts`, `apps/workbench/src/lib/dataset-schema.spec.ts`

- [ ] **Step 1: 寫失敗測試** — `dataset-schema.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { DATASET_FIELD_SCHEMA } from "./dataset-schema";

describe("DATASET_FIELD_SCHEMA", () => {
  it("exposes the queryable column fields aligned to datasetPgConfig", () => {
    const byPath = Object.fromEntries(DATASET_FIELD_SCHEMA.map((f) => [f.path, f]));
    expect(byPath.name).toMatchObject({ kind: "column", dataType: "string" });
    expect(byPath.description).toMatchObject({ kind: "column", dataType: "string" });
    expect(byPath.createdAt).toMatchObject({ kind: "column", dataType: "date" });
    expect(byPath.updatedAt).toMatchObject({ kind: "column", dataType: "date" });
  });

  it("marks every field included so it shows in the builder", () => {
    expect(DATASET_FIELD_SCHEMA.every((f) => f.include)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `pnpm -F workbench exec vitest run src/lib/dataset-schema.spec.ts` → FAIL。

- [ ] **Step 3: 實作 `dataset-schema.ts`**
```ts
import type { FieldSchema } from "@rfjs/filter-builder";

// Queryable fields of the datasets catalog, aligned to the backend datasetPgConfig
// (columns: name/description/createdAt/updatedAt; jsonb: the `data` column).
// jsonb data.* fields are added at runtime via the builder's creatable field input.
export const DATASET_FIELD_SCHEMA: FieldSchema[] = [
  { path: "name", dataType: "string", include: true, kind: "column" },
  { path: "description", dataType: "string", include: true, kind: "column" },
  { path: "createdAt", dataType: "date", include: true, kind: "column" },
  { path: "updatedAt", dataType: "date", include: true, kind: "column" },
];
```

- [ ] **Step 4: 跑測試確認通過** — Run: `pnpm -F workbench exec vitest run src/lib/dataset-schema.spec.ts` → PASS。Run: `pnpm -F workbench check-types` → 0。

- [ ] **Step 5: commit**
```bash
git add apps/workbench/src/lib/dataset-schema.ts apps/workbench/src/lib/dataset-schema.spec.ts
git commit --no-verify -m "$(cat <<'EOF'
feat(workbench): fixed dataset filter field schema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 查詢 body 建構 〔BLOCKED ON Part A〕

需 `@rfjs/filter-builder` 對外 `treeToPgFilterGroup(tree, schema)`。Part A merge 後再做。

**Files:** Create `apps/workbench/src/lib/dataset-query.ts`, `apps/workbench/src/lib/dataset-query.spec.ts`

- [ ] **Step 1: 寫失敗測試** — `dataset-query.spec.ts`:
```ts
import { emptyGroup, addCondition, updateNode } from "@rfjs/filter-builder";
import { describe, expect, it } from "vitest";

import { buildQueryBody } from "./dataset-query";
import { DATASET_FIELD_SCHEMA } from "./dataset-schema";

const id = () => crypto.randomUUID();

describe("buildQueryBody", () => {
  it("maps an empty tree to a body with an empty-and filter group", () => {
    const body = buildQueryBody(emptyGroup(id), DATASET_FIELD_SCHEMA, 1, 20);
    expect(body).toMatchObject({ page: 1, pageSize: 20 });
    expect(body.filter).toEqual({ logic: "and", filters: [] });
  });

  it("tags a column condition with target 'column'", () => {
    let tree = emptyGroup(id);
    tree = addCondition(tree, tree.id, id);
    const condId = tree.children[0].id;
    tree = updateNode(tree, condId, { field: "name", dataType: "string", operator: "eq", value: "x" });
    const body = buildQueryBody(tree, DATASET_FIELD_SCHEMA, 2, 50);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(50);
    const leaf = body.filter?.filters[0] as { target: string; column?: string };
    expect(leaf.target).toBe("column");
    expect(leaf.column).toBe("name");
  });
});
```
(註:`addCondition`/`updateNode`/`emptyGroup` 為 `@rfjs/filter-builder` 既有 tree-ops;若簽名不同,以實際匯出為準。)

- [ ] **Step 2: 跑測試確認失敗** — Run: `pnpm -F workbench exec vitest run src/lib/dataset-query.spec.ts` → FAIL(`buildQueryBody` 未匯出;且 `treeToPgFilterGroup` 須已由 Part A 提供)。

- [ ] **Step 3: 實作 `dataset-query.ts`**
```ts
import { treeToPgFilterGroup, type BuilderGroup, type FieldSchema } from "@rfjs/filter-builder";

import type { QueryDatasetsBody } from "./datasets";

// Build the POST /datasets/query body from the builder tree + field schema.
export function buildQueryBody(
  tree: BuilderGroup,
  schema: FieldSchema[],
  page: number,
  pageSize: number,
): QueryDatasetsBody {
  return { filter: treeToPgFilterGroup(tree, schema), page, pageSize };
}
```

- [ ] **Step 4: 跑測試確認通過** — Run: `pnpm -F workbench exec vitest run src/lib/dataset-query.spec.ts` → PASS。Run: `pnpm -F workbench check-types` → 0。

- [ ] **Step 5: commit**
```bash
git add apps/workbench/src/lib/dataset-query.ts apps/workbench/src/lib/dataset-query.spec.ts
git commit --no-verify -m "$(cat <<'EOF'
feat(workbench): build /datasets/query body from filter tree

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 探索器 client 元件 〔BLOCKED ON Part B〕

需 `@rfjs/filter-builder-ui` 的 `<FilterTreeEditor>`/`useFilterTree`/`FilterTreeLabels`。

**Files:** Create `apps/workbench/src/components/explorer/dataset-explorer.tsx`, `apps/workbench/src/components/explorer/dataset-explorer.spec.tsx`; Modify `apps/workbench/src/messages/{en,zh-TW}.json`

- [ ] **Step 1: i18n** — 在 `messages/{en,zh-TW}.json` 新增 `Explorer` 命名空間(外圍字串 + FilterTree labels)。en 例:
```json
"Explorer": {
  "title": "Dataset Explorer",
  "description": "Filter the datasets catalog with nested conditions.",
  "run": "Run",
  "addField": "Add field (e.g. data.region)",
  "matched": "{count} matched",
  "empty": "No datasets match.",
  "error": "Query failed.",
  "cols": { "name": "Name", "description": "Description", "created": "Created" },
  "tree": {
    "and": "AND", "or": "OR", "nor": "NOR", "not": "NOT",
    "addCondition": "+ condition", "addGroup": "+ group",
    "removeCondition": "remove condition", "removeGroup": "remove group",
    "elemMatch": "elemmatch (nested)"
  }
}
```
zh-TW 對應翻譯(同 key)。`tree.*` 用來組 `FilterTreeLabels`。

- [ ] **Step 2: 寫失敗測試** — `dataset-explorer.spec.tsx`(沿用 props/stub 模式;stub `queryDatasets`):
```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/datasets", () => ({
  queryDatasets: vi.fn().mockResolvedValue({ ok: true, result: { items: [{ id: "1", name: "Alpha", description: null, data: {}, createdAt: "2026-01-01", updatedAt: "2026-01-01" }], total: 1, page: 1, pageSize: 20 } }),
}));

import { queryDatasets } from "@/lib/datasets";
import { DatasetExplorer } from "./dataset-explorer";

afterEach(cleanup);

const labels = {
  title: "Dataset Explorer", description: "d", run: "Run", addField: "Add",
  matched: "{count} matched", empty: "none", error: "err",
  cols: { name: "Name", description: "Description", created: "Created" },
  tree: { and: "AND", or: "OR", nor: "NOR", not: "NOT", addCondition: "+c", addGroup: "+g", removeCondition: "rc", removeGroup: "rg", elemMatch: "em" },
};

describe("DatasetExplorer", () => {
  it("runs a query and renders matched datasets", async () => {
    render(<DatasetExplorer labels={labels} />);
    fireEvent.click(screen.getByText("Run"));
    await waitFor(() => expect(queryDatasets).toHaveBeenCalled());
    expect(await screen.findByText("Alpha")).toBeTruthy();
  });
});
```

- [ ] **Step 3: 實作 `dataset-explorer.tsx`**(client component)
```tsx
"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { FilterTreeEditor, useFilterTree, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { useState } from "react";

import { buildQueryBody } from "@/lib/dataset-query";
import { DATASET_FIELD_SCHEMA } from "@/lib/dataset-schema";
import { queryDatasets, type QueryResult } from "@/lib/datasets";

export type ExplorerLabels = {
  title: string; description: string; run: string; addField: string;
  matched: string; empty: string; error: string;
  cols: { name: string; description: string; created: string };
  tree: FilterTreeLabels & Record<string, unknown>;
};

export function DatasetExplorer({ labels }: { labels: ExplorerLabels }) {
  const { tree, schema, setTree, createField } = useFilterTree({ schema: DATASET_FIELD_SCHEMA });
  const [res, setRes] = useState<QueryResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setRes(await queryDatasets(buildQueryBody(tree, schema, 1, 20)));
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title={labels.title}>
        <FilterTreeEditor
          tree={tree}
          schema={schema}
          engineId="pg-filter"
          onChange={setTree}
          onCreateField={createField}
          labels={labels.tree}
        />
        <Button className="mt-3" size="sm" disabled={busy} onClick={run}>{labels.run}</Button>
      </Panel>
      <Panel>
        {res === null ? null : !res.ok ? (
          <span className="text-sm text-destructive">{labels.error}</span>
        ) : res.result.items.length === 0 ? (
          <span className="text-sm text-muted-foreground">{labels.empty}</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {res.result.items.map((d) => (
              <li key={d.id} className="text-sm">
                <span className="font-medium">{d.name}</span>
                {d.description ? <span className="text-muted-foreground"> — {d.description}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
```
(註:`FilterTreeLabels` 形狀以 Part B 實際匯出為準;`ExplorerLabels.tree` 對齊之。`useFilterTree` 的 `init.schema` 用法以 Part B 為準。)

- [ ] **Step 4: 跑測試 + 型別** — Run: `pnpm -F workbench exec vitest run src/components/explorer/dataset-explorer.spec.tsx` → PASS。Run: `pnpm -F workbench check-types` → 0。

- [ ] **Step 5: commit**
```bash
git add apps/workbench/src/components/explorer apps/workbench/src/messages
git commit --no-verify -m "$(cat <<'EOF'
feat(workbench): dataset explorer client component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 路由頁 + nav + 完整驗證 〔BLOCKED ON Part B〕

**Files:** Create `apps/workbench/src/app/[locale]/(shell)/datasets/explore/page.tsx`; Modify nav(如 `components/shell` 有側欄項)+ `messages` 若需要

- [ ] **Step 1: 實作頁面** — `app/[locale]/(shell)/datasets/explore/page.tsx`(server 殼,組 labels 傳給 client):
```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DatasetExplorer, type ExplorerLabels } from "@/components/explorer/dataset-explorer";

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Explorer");
  const labels: ExplorerLabels = {
    title: t("title"), description: t("description"), run: t("run"), addField: t("addField"),
    matched: t("matched", { count: 0 }).replace("0", "{count}"), empty: t("empty"), error: t("error"),
    cols: { name: t("cols.name"), description: t("cols.description"), created: t("cols.created") },
    tree: {
      logic: { and: t("tree.and"), or: t("tree.or"), nor: t("tree.nor"), not: t("tree.not") },
      addCondition: t("tree.addCondition"), addGroup: t("tree.addGroup"),
      removeCondition: t("tree.removeCondition"), removeGroup: t("tree.removeGroup"),
      elemMatch: t("tree.elemMatch"),
    },
  };
  return <DatasetExplorer labels={labels} />;
}
```
(註:`labels.tree` 形狀對齊 Part B 的 `FilterTreeLabels`;若 Part B 的 labels 不含 `logic` 巢狀而是別的形狀,以其為準調整。`matched` 若 explorer 用到再接;v1 可省。)

- [ ] **Step 2: nav 入口** — 若 workbench 側欄/`(shell)` 有導覽清單,加「Dataset Explorer → /datasets/explore」一項(讀 `components/shell` 與 `Nav` messages,照既有樣式加;若導覽是資料驅動則加一筆)。

- [ ] **Step 3: 完整驗證**
- Run: `pnpm -F workbench exec vitest run` → 全綠(baseline + 新測試)。
- Run: `pnpm -F workbench check-types` → 0。
- Run: `pnpm -F workbench lint` → clean。
- Run: `pnpm -F workbench build` → 成功,`/datasets/explore` 正常產出。

- [ ] **Step 4: commit**
```bash
git add apps/workbench/src
git commit --no-verify -m "$(cat <<'EOF'
feat(workbench): datasets explorer route and nav entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- **API client(成功/空/400/API-down/POST body)** → Task 1。✅
- **固定欄位 schema(對齊 datasetPgConfig)** → Task 2。✅
- **tree → 結構化 body(treeToPgFilterGroup)** → Task 3〔需 Part A〕。✅
- **探索器 UI(FilterTreeEditor + useFilterTree + run + 結果/空/錯)** → Task 4〔需 Part B〕。✅
- **路由頁 + labels 組裝 + nav + 驗證** → Task 5〔需 Part B〕。✅
- **語意校正(篩 datasets 表、無 [id])** → 全程依此。✅
- **相依標記**:T1/T2 現在可做;T3 等 Part A;T4/T5 等 Part B。✅
- **零重疊**:只動 apps/workbench。✅

**待對方契約最終定名/形狀時校準的點**(實作各該 task 前確認):
1. `treeToPgFilterGroup` 最終簽名(對方確認為 `(tree, schema)`)。
2. `@rfjs/filter-builder-ui` 的 `FilterTreeLabels` 實際形狀、`useFilterTree` 的 `init` 形狀、`FilterTreeEditor` props。
3. workbench 是否已有資料驅動的側欄(決定 Task 5 nav 作法)。

**YAGNI:** v1 不做 sort UI(用後端預設 tiebreaker)、不做 jsonb 欄位自動抽樣預填(手輸 `data.*`)、不做分頁器(先 page=1;分頁可後續加)。
