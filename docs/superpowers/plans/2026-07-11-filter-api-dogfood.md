# filter → API dogfood 實作計畫

> **給執行者:** 必用子技能:superpowers:subagent-driven-development(建議)或 superpowers:executing-plans,逐任務執行本計畫。步驟用 checkbox(`- [ ]`)追蹤。

**目標:** 為 table-builder 工具點亮一條真實的 filter→HTTP→rows 往返——透過一個自包含的 Next.js 假 route(免 Postgres),含場景旋鈕與最小客端接線。

**架構:** 把現有 `fake-fetcher.ts` 的記憶體查詢引擎抽成共享純模組;Next.js `POST /api/query/[resource]` route 複用它在伺服端 filter/sort/paginate;`makeHttpFetcher` transport 把工具的 `BuiltRequest` POST 到該 route;table-builder 新增 in-memory↔HTTP 的 transport 切換。契約走**工具原生慣例**(`BuiltRequest` + `{data:{items,total,nextCursor?}}`),**非** apps/api 的結構化 body。

**技術棧:** Next.js 16 App Router(Node runtime)、TypeScript、React 19、Vitest + @testing-library、消費 `@rfjs/filter-builder`/`@rfjs/pg-filter`/`@rfjs/table-builder(-ui)`/`@rfjs/data-schema`。

## 全域約束

- **紅線:** 不改 `packages/*` 底下任何東西。所有改動都在 `apps/web`,只消費。
- **無 changeset**(只動 apps/web;app 不記版本)。
- 契約 = 工具原生 `BuiltRequest`(`{params, filter}`)請求 + `{data:{items,total,nextCursor?}}` 回應。**不要**改成 apps/api 的 `{filter,sort,page,pageSize}`。
- Transport(`makeHttpFetcher`)是 app 級、可替換的 adapter——**不要**放進 package(避免撞 #14)。
- 複用既有樣本資料(`SAMPLE_ROWS`/`SAMPLE_META`/`SAMPLE_CONFIG`,來自 `@/tools/table-builder/sample`),讓 HTTP 路徑回傳與 in-memory 路徑相同的 rows。
- Commit:英文 Conventional Commits,結尾加 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 一切從 worktree 根目錄執行:`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-filter-api-dogfood`。web 測試 = `pnpm -F web exec vitest run <pattern>`;型別檢查 = `pnpm -F web check-types`;lint = `pnpm -F web lint`。

---

## 檔案結構

- `apps/web/src/lib/fake-query.ts`(新)— 純 `runQuery(rows, columns, fields, built)`;由 `fake-fetcher.ts` 原封搬出的記憶體 filter/sort/paginate 引擎。
- `apps/web/src/tools/table-builder/fake-fetcher.ts`(改)— 變成 `runQuery` 的薄殼(行為不變)。
- `apps/web/src/lib/query-resources.ts`(新)— 資源 registry(`sample` → rows/columns/fields)。
- `apps/web/src/app/api/query/[resource]/route.ts`(新)— POST route + 場景旋鈕。
- `apps/web/src/tools/table-builder/http-fetcher.ts`(新)— `makeHttpFetcher(endpoint)`。
- `apps/web/src/tools/table-builder/ui.tsx`(改)— transport 狀態 + source `fetch` 選擇。
- `apps/web/src/tools/table-builder/source-panel.tsx`(改)— transport 切換(memory / HTTP)。

---

## Task 1 · 抽出純查詢引擎

**檔案:**
- 新增:`apps/web/src/lib/fake-query.ts`
- 修改:`apps/web/src/tools/table-builder/fake-fetcher.ts`
- 測試:`apps/web/src/lib/fake-query.spec.ts`

**介面:**
- 產出:`runQuery(rows: Record<string,unknown>[], columns: TableColumnConfig[], fields: DataFieldMeta[], built: { params: Record<string,string>; filter?: unknown }): { items: Record<string,unknown>[]; total: number; nextCursor?: string }`。

- [ ] **步驟 1:寫失敗測試**

新增 `apps/web/src/lib/fake-query.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { runQuery } from "./fake-query";
import type { TableColumnConfig } from "@rfjs/table-builder";
import type { DataFieldMeta } from "@rfjs/data-schema";

const fields: DataFieldMeta[] = [
  { key: "id", label: "ID", dataType: "numeric", filterable: true, kind: "column" },
  { key: "name", label: "Name", dataType: "string", filterable: true, kind: "column" },
];
const columns: TableColumnConfig[] = [
  { key: "id", label: "ID", dataType: "numeric" },
  { key: "name", label: "Name", dataType: "string" },
];
const rows = [
  { id: 1, name: "Ada" },
  { id: 2, name: "Alan" },
  { id: 3, name: "Grace" },
];

describe("runQuery", () => {
  it("no filter → all rows, total = length", () => {
    const r = runQuery(rows, columns, fields, { params: {} });
    expect(r.total).toBe(3);
    expect(r.items).toHaveLength(3);
  });

  it("applies a column filter (eq)", () => {
    const filter = { logic: "and", filters: [{ target: "column", column: "name", operator: "eq", value: "Ada" }] };
    const r = runQuery(rows, columns, fields, { params: {}, filter });
    expect(r.items).toEqual([{ id: 1, name: "Ada" }]);
    expect(r.total).toBe(1);
  });

  it("sorts + paginates (page strategy)", () => {
    const r = runQuery(rows, columns, fields, { params: { page: "1", pageSize: "2", sort: "-id" } });
    expect(r.items.map((x) => x.id)).toEqual([3, 2]);
    expect(r.total).toBe(3);
  });
});
```

- [ ] **步驟 2:跑測試確認 FAIL**

執行:`pnpm -F web exec vitest run fake-query`
預期:FAIL —— `./fake-query` 不存在。

- [ ] **步驟 3:建立純模組**

把 `fake-fetcher.ts` 的純邏輯搬到 `apps/web/src/lib/fake-query.ts`(helpers 原封複製,export `runQuery`):

```ts
import { sortRows } from "@rfjs/table-builder";
import type { TableColumnConfig } from "@rfjs/table-builder";
import { filterGroupToTree, runLiveMatch } from "@rfjs/filter-builder";
import type { FilterConditionLike, FilterGroupLike } from "@rfjs/filter-builder";
import type { PgFilterGroup, PgLeaf } from "@rfjs/pg-filter";
import type { DataFieldMeta } from "@rfjs/data-schema";

interface ParsedSort { key: string; direction: "asc" | "desc"; }

function parseSort(params: Record<string, string>): ParsedSort | undefined {
  const single = params.sort;
  if (single !== undefined) {
    if (single.startsWith("-")) return { key: single.slice(1), direction: "desc" };
    if (single.includes(":")) {
      const [key, dir] = single.split(":");
      return { key: key ?? "", direction: dir === "desc" ? "desc" : "asc" };
    }
    return { key: single, direction: "asc" };
  }
  if (params.sortBy !== undefined) {
    return { key: params.sortBy, direction: params.order === "desc" ? "desc" : "asc" };
  }
  return undefined;
}

interface PagedResult { items: Record<string, unknown>[]; total: number; nextCursor?: string; }

function paginate(rows: Record<string, unknown>[], params: Record<string, string>): PagedResult {
  if (params.offset !== undefined) {
    const limit = Number(params.limit ?? rows.length);
    const offset = Number(params.offset);
    return { items: rows.slice(offset, offset + limit), total: rows.length };
  }
  if (params.page !== undefined && params.pageSize !== undefined) {
    const pageSize = Number(params.pageSize);
    const page = Number(params.page);
    const start = (page - 1) * pageSize;
    return { items: rows.slice(start, start + pageSize), total: rows.length };
  }
  const limit = Number(params.limit ?? rows.length);
  const offset = params.cursor !== undefined ? Number(params.cursor) : 0;
  const items = rows.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  const nextCursor = nextOffset < rows.length ? String(nextOffset) : undefined;
  return { items, total: rows.length, nextCursor };
}

function pgLeafToCondition(leaf: PgLeaf, fields: DataFieldMeta[]): FilterConditionLike {
  if (leaf.target === "column") {
    const meta = fields.find((f) => f.key === leaf.column);
    return { field: leaf.column, dataType: meta?.dataType ?? "string", operator: leaf.operator, value: leaf.value };
  }
  return { field: leaf.field, dataType: leaf.dataType as FilterConditionLike["dataType"], operator: leaf.operator, value: leaf.value };
}

function pgGroupToFilterGroup(group: PgFilterGroup, fields: DataFieldMeta[]): FilterGroupLike {
  return {
    logic: group.logic,
    filters: group.filters.map((node) =>
      "logic" in node ? pgGroupToFilterGroup(node as PgFilterGroup, fields) : pgLeafToCondition(node as PgLeaf, fields),
    ),
  };
}

function applyPgFilter(rows: Record<string, unknown>[], filter: unknown, fields: DataFieldMeta[]): Record<string, unknown>[] {
  if (filter === undefined) return rows;
  const tree = filterGroupToTree(pgGroupToFilterGroup(filter as PgFilterGroup, fields), () => crypto.randomUUID());
  const match = runLiveMatch(rows, tree);
  return match.uncoverable ? rows : (match.matched as Record<string, unknown>[]);
}

/** 純記憶體查詢:filter(pg reverse → runLiveMatch)→ sort → paginate。in-process fake fetcher
 * 與 HTTP route 共用,兩者 dogfood 完全相同的引擎。 */
export function runQuery(
  rows: Record<string, unknown>[],
  columns: TableColumnConfig[],
  fields: DataFieldMeta[],
  built: { params: Record<string, string>; filter?: unknown },
): PagedResult {
  const filtered = applyPgFilter(rows, built.filter, fields);
  const sort = parseSort(built.params);
  const sorted = sort ? sortRows(filtered, sort, columns) : filtered;
  return paginate(sorted, built.params);
}
```

再把 `fake-fetcher.ts` 改成委派(保留 `FAKE_FETCH_DELAY_MS` 與 `{data}` 外殼):

```ts
import type { TableColumnConfig } from "@rfjs/table-builder";
import type { BuiltRequest, DataFieldMeta } from "@rfjs/data-schema";
import { runQuery } from "@/lib/fake-query";

const FAKE_FETCH_DELAY_MS = 120;

export function makeFakeFetcher(
  rows: Record<string, unknown>[],
  columns: TableColumnConfig[],
  fields: DataFieldMeta[] = [],
): (built: BuiltRequest) => Promise<unknown> {
  return (built: BuiltRequest): Promise<unknown> => {
    const { items, total, nextCursor } = runQuery(rows, columns, fields, built);
    const data: Record<string, unknown> = { items, total };
    if (nextCursor !== undefined) data.nextCursor = nextCursor;
    return new Promise((resolve) => setTimeout(() => resolve({ data }), FAKE_FETCH_DELAY_MS));
  };
}
```

- [ ] **步驟 4:跑測試確認 PASS**

執行:`pnpm -F web exec vitest run fake-query fake-fetcher table-builder`
預期:PASS —— 新 `fake-query` 測試 + 既有 `fake-fetcher`/table-builder 測試續綠(行為不變)。

執行:`pnpm -F web check-types`
預期:無錯誤(apps/web 已設 `@/` 路徑別名)。

- [ ] **步驟 5:Commit**

```bash
git add apps/web/src/lib/fake-query.ts apps/web/src/lib/fake-query.spec.ts apps/web/src/tools/table-builder/fake-fetcher.ts
git commit -m "$(cat <<'EOF'
refactor(web): extract shared in-memory runQuery engine from fake-fetcher

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 · 資源 registry

**檔案:**
- 新增:`apps/web/src/lib/query-resources.ts`
- 測試:`apps/web/src/lib/query-resources.spec.ts`

**介面:**
- 消費:`SAMPLE_ROWS`、`SAMPLE_META`、`SAMPLE_CONFIG`(來自 `@/tools/table-builder/sample`)。
- 產出:`getResource(id: string): { rows; columns; fields } | undefined`。

- [ ] **步驟 1:寫失敗測試**

新增 `apps/web/src/lib/query-resources.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getResource } from "./query-resources";

describe("getResource", () => {
  it("returns the sample resource with rows/columns/fields", () => {
    const r = getResource("sample");
    expect(r).toBeDefined();
    expect(r!.rows.length).toBeGreaterThan(0);
    expect(r!.columns.length).toBeGreaterThan(0);
    expect(r!.fields.length).toBeGreaterThan(0);
  });
  it("returns undefined for an unknown resource", () => {
    expect(getResource("nope")).toBeUndefined();
  });
});
```

- [ ] **步驟 2:跑測試確認 FAIL**

執行:`pnpm -F web exec vitest run query-resources`
預期:FAIL —— 模組不存在。

- [ ] **步驟 3:實作 registry**

新增 `apps/web/src/lib/query-resources.ts`:

```ts
import { SAMPLE_ROWS, SAMPLE_META, SAMPLE_CONFIG } from "@/tools/table-builder/sample";
import type { TableColumnConfig } from "@rfjs/table-builder";
import type { DataFieldMeta } from "@rfjs/data-schema";

export interface QueryResource {
  rows: Record<string, unknown>[];
  columns: TableColumnConfig[];
  fields: DataFieldMeta[];
}

// 服務與 table-builder 工具相同的 rows,所以工具把 transport 從 in-memory 切成 HTTP 時,
// 回傳的資料一模一樣(證明變的只有 transport)。
const RESOURCES: Record<string, QueryResource> = {
  sample: { rows: SAMPLE_ROWS, columns: SAMPLE_CONFIG.columns, fields: SAMPLE_META.fields },
};

export function getResource(id: string): QueryResource | undefined {
  return RESOURCES[id];
}
```

- [ ] **步驟 4:跑測試確認 PASS**

執行:`pnpm -F web exec vitest run query-resources`
預期:PASS。

- [ ] **步驟 5:Commit**

```bash
git add apps/web/src/lib/query-resources.ts apps/web/src/lib/query-resources.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): add fake query resource registry (sample)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 · Next.js 假 route + 場景旋鈕

**檔案:**
- 新增:`apps/web/src/app/api/query/[resource]/route.ts`
- 測試:`apps/web/src/app/api/query/[resource]/route.spec.ts`

**介面:**
- 消費:`getResource`(任務 2)、`runQuery`(任務 1)。
- 產出:`POST /api/query/[resource]` → `{ data: { items, total, nextCursor? } }`;未知資源 404;旋鈕 `?delay/?error/?empty`。

- [ ] **步驟 1:寫失敗測試**

新增 `apps/web/src/app/api/query/[resource]/route.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

function post(resource: string, body: unknown, search = ""): Promise<Response> {
  const req = new Request(`http://t/api/query/${resource}${search}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req, { params: Promise.resolve({ resource }) });
}

describe("POST /api/query/[resource]", () => {
  it("returns { data: { items, total } } for the sample resource", async () => {
    const res = await post("sample", { params: {} });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { items: unknown[]; total: number } };
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(json.data.total).toBeGreaterThan(0);
  });

  it("404 for unknown resource", async () => {
    const res = await post("nope", { params: {} });
    expect(res.status).toBe(404);
  });

  it("?error=500 → 500", async () => {
    const res = await post("sample", { params: {} }, "?error=500");
    expect(res.status).toBe(500);
  });

  it("?empty=1 → 0 items", async () => {
    const res = await post("sample", { params: {} }, "?empty=1");
    const json = (await res.json()) as { data: { items: unknown[]; total: number } };
    expect(json.data.items).toHaveLength(0);
    expect(json.data.total).toBe(0);
  });
});
```

- [ ] **步驟 2:跑測試確認 FAIL**

執行:`pnpm -F web exec vitest run "api/query"`
預期:FAIL —— `./route` 不存在。

- [ ] **步驟 3:實作 route**

新增 `apps/web/src/app/api/query/[resource]/route.ts`:

```ts
import { getResource } from "@/lib/query-resources";
import { runQuery } from "@/lib/fake-query";

// runQuery 拉入 @rfjs/filter-builder + crypto.randomUUID → Node runtime。
export const runtime = "nodejs";

interface Built { params?: Record<string, string>; filter?: unknown }

export async function POST(req: Request, ctx: { params: Promise<{ resource: string }> }): Promise<Response> {
  const { resource } = await ctx.params;
  const url = new URL(req.url);
  const knob = url.searchParams;

  // 場景旋鈕(spec §5):強制 error / delay / empty 以驅動 UI 狀態。
  const errorCode = Number(knob.get("error"));
  if (errorCode >= 400) return Response.json({ error: "forced" }, { status: errorCode });
  const delay = Number(knob.get("delay"));
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  const found = getResource(resource);
  if (!found) return Response.json({ error: `unknown resource ${resource}` }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Built;
  const built = { params: body.params ?? {}, filter: body.filter };
  const rows = knob.get("empty") ? [] : found.rows;

  const { items, total, nextCursor } = runQuery(rows, found.columns, found.fields, built);
  const data: Record<string, unknown> = { items, total };
  if (nextCursor !== undefined) data.nextCursor = nextCursor;
  return Response.json({ data });
}
```

- [ ] **步驟 4:跑測試確認 PASS**

執行:`pnpm -F web exec vitest run "api/query"`
預期:PASS(4 個 case)。

執行:`pnpm -F web check-types`
預期:無錯誤。

- [ ] **步驟 5:Commit**

```bash
git add "apps/web/src/app/api/query/[resource]/route.ts" "apps/web/src/app/api/query/[resource]/route.spec.ts"
git commit -m "$(cat <<'EOF'
feat(web): add fake /api/query/[resource] route with scenario knobs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 · HTTP transport

**檔案:**
- 新增:`apps/web/src/tools/table-builder/http-fetcher.ts`
- 測試:`apps/web/src/tools/table-builder/http-fetcher.spec.ts`

**介面:**
- 產出:`makeHttpFetcher(endpoint: string): (built: BuiltRequest) => Promise<unknown>`。

- [ ] **步驟 1:寫失敗測試**

新增 `apps/web/src/tools/table-builder/http-fetcher.spec.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { makeHttpFetcher } from "./http-fetcher";

describe("makeHttpFetcher", () => {
  it("POSTs the built request as JSON and returns parsed json", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { items: [], total: 0 } }) });
    vi.stubGlobal("fetch", fetchMock);
    const fetcher = makeHttpFetcher("/api/query/sample");
    const built = { endpoint: "/api/query/sample", method: "POST", params: { page: "1" }, filter: undefined };
    const out = await fetcher(built as never);
    expect(fetchMock).toHaveBeenCalledWith("/api/query/sample", expect.objectContaining({ method: "POST" }));
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.params).toEqual({ page: "1" });
    expect(out).toEqual({ data: { items: [], total: 0 } });
    vi.unstubAllGlobals();
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const fetcher = makeHttpFetcher("/api/query/sample");
    await expect(fetcher({ params: {} } as never)).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **步驟 2:跑測試確認 FAIL**

執行:`pnpm -F web exec vitest run http-fetcher`
預期:FAIL —— 模組不存在。

- [ ] **步驟 3:實作**

新增 `apps/web/src/tools/table-builder/http-fetcher.ts`:

```ts
import type { BuiltRequest } from "@rfjs/data-schema";

/**
 * 給 remote `TableSource.fetch` 用的 app 級最小 HTTP transport:把工具的 `BuiltRequest`
 * POST 到 `endpoint`、回傳解析後的 JSON。刻意是薄、可替換的 adapter —— package 級的
 * http-fetcher(#14)可取代它;兩者共用同一 `(built)=>Promise<unknown>` 簽名與
 * BuiltRequest/`{data}` 契約。
 */
export function makeHttpFetcher(endpoint: string): (built: BuiltRequest) => Promise<unknown> {
  return async (built: BuiltRequest): Promise<unknown> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(built),
    });
    if (!res.ok) throw new Error(`query failed: ${res.status}`);
    return res.json();
  };
}
```

- [ ] **步驟 4:跑測試確認 PASS**

執行:`pnpm -F web exec vitest run http-fetcher`
預期:PASS。

- [ ] **步驟 5:Commit**

```bash
git add apps/web/src/tools/table-builder/http-fetcher.ts apps/web/src/tools/table-builder/http-fetcher.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): add app-level HTTP fetcher transport for table-builder remote source

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 · 把 transport 切換接進 table-builder

**檔案:**
- 修改:`apps/web/src/tools/table-builder/ui.tsx`
- 修改:`apps/web/src/tools/table-builder/source-panel.tsx`
- 測試:`apps/web/src/tools/table-builder/source-panel.spec.tsx`(沒有就新建,有就擴充)

**介面:**
- 消費:`makeHttpFetcher`(任務 4)。endpoint = `/api/query/sample`。
- 產出:一個 `transport: "memory" | "http"` 控制,只在 remote 來源時顯示;當 `http` 時,remote source 的 `fetch` = `makeHttpFetcher("/api/query/sample")`。

- [ ] **步驟 1:寫失敗測試**

既有的 `apps/web/src/tools/table-builder/source-panel.spec.tsx` 開頭已 import 了 `describe/expect/it/vi`(vitest)、`render/screen/fireEvent`(@testing-library/react)、`SourcePanel`——**不要重複 import,也不要加 `import * as React`(automatic JSX runtime 不需要,會觸發 lint)**。只在檔尾**追加**這個新 `describe` 區塊:

```tsx
const baseLabels = {} as never; // labels 有預設值;見 SourcePanel props

describe("SourcePanel transport toggle", () => {
  it("shows a transport toggle only when remote, and reports changes", () => {
    const onTransportChange = vi.fn();
    const { rerender } = render(
      <SourcePanel mode="rows" onModeChange={() => {}} labels={baseLabels} transport="memory" onTransportChange={onTransportChange} />,
    );
    expect(screen.queryByRole("button", { name: /http/i })).toBeNull();
    rerender(
      <SourcePanel mode="offset" onModeChange={() => {}} labels={baseLabels} transport="memory" onTransportChange={onTransportChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /http/i }));
    expect(onTransportChange).toHaveBeenCalledWith("http");
  });
});
```

- [ ] **步驟 2:跑測試確認 FAIL**

執行:`pnpm -F web exec vitest run source-panel`
預期:FAIL —— `transport`/`onTransportChange` props 與 HTTP 切換鈕尚不存在。

- [ ] **步驟 3:在 `source-panel.tsx` 加切換**

在 `SourcePanelProps` 加:

```ts
  transport?: "memory" | "http";
  onTransportChange?: (t: "memory" | "http") => void;
```

更新 `SourcePanel` 簽名解構它們,並在 `isRemote` 分支(策略列附近)用 `segmentClass` 渲染切換:

```tsx
{isRemote && onTransportChange && (
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground">Transport</span>
    <button type="button" className={segmentClass(transport === "memory")} onClick={() => onTransportChange("memory")}>in-memory</button>
    <button type="button" className={segmentClass(transport === "http")} onClick={() => onTransportChange("http")}>HTTP</button>
  </div>
)}
```

- [ ] **步驟 4:接 `ui.tsx`**

在既有 `sourceMode` 狀態附近(`ui.tsx:55`)加 import + 狀態:

```tsx
import { makeHttpFetcher } from "./http-fetcher";
// ...
const [transport, setTransport] = React.useState<"memory" | "http">("memory");
```

在 `source` useMemo(`ui.tsx:170-181`)依 transport 選 fetch,並把 `transport` 加進 deps:

```tsx
  const source: TableSource = React.useMemo(() => {
    if (sourceMode === "rows") return { kind: "rows", rows };
    const request: RequestMeta = { ...SAMPLE_META.request!, pagination: samplePaginationMeta(sourceMode) };
    return {
      kind: "remote",
      request,
      response: SAMPLE_META.response!,
      fields: SAMPLE_META.fields,
      fetch: transport === "http" ? makeHttpFetcher("/api/query/sample") : makeFakeFetcher(SAMPLE_ROWS, config.columns, SAMPLE_META.fields),
    };
  }, [sourceMode, transport, config.columns, rows]);
```

在渲染 `<SourcePanel>` 的地方(`ui.tsx` 約 317 行,`onModeChange={setSourceMode}` 旁)傳新 props:

```tsx
          transport={transport}
          onTransportChange={setTransport}
```

- [ ] **步驟 5:跑測試確認 PASS**

執行:`pnpm -F web exec vitest run source-panel table-builder`
預期:PASS。

執行:`pnpm -F web check-types`
預期:無錯誤。

- [ ] **步驟 6:Commit**

```bash
git add apps/web/src/tools/table-builder/ui.tsx apps/web/src/tools/table-builder/source-panel.tsx apps/web/src/tools/table-builder/source-panel.spec.tsx
git commit -m "$(cat <<'EOF'
feat(web): add in-memory/HTTP transport toggle to table-builder remote source

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 · 全量驗證 + 截圖

**檔案:** 無(只驗證)。

- [ ] **步驟 1:全量 affected 驗證**

執行:`pnpm -F web exec vitest run fake-query query-resources http-fetcher source-panel table-builder "api/query"`
預期:全 PASS。

執行:`pnpm -F web check-types`
預期:無錯誤(若有 PRE-EXISTING 無關錯誤,記錄但不修)。

執行:`pnpm -F web lint`
預期:無錯誤。

- [ ] **步驟 2:截圖真實 HTTP 往返(verify skill)**

從 worktree 起 dev server 在**非 3000** 埠(3000 常被別的 session 佔):
`pnpm --dir "<worktree>/apps/web" exec next dev --port 3120`
用 playwright 驅動(bundled chromium `~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,同 #243 那次):
1. 開 `/en/tools/table-builder`,把 Source 從 "rows" 切開(→ offset),Transport 設 HTTP。
2. 打開 filter、加條件、Apply → 確認表格從一發真 network POST `/api/query/sample` 更新(看 Network 分頁 / rows 有被篩)。
3. 截:happy(篩後 rows)。loading / error / 空 可用旋鈕 URL(`?delay=1500` / `?error=500` / `?empty=1`)驅動;若 UI 驅動旋鈕不便,happy path 截 UI,loading/error/空 由已寫的 route.spec 斷言涵蓋。

截圖存 session scratchpad;回報路徑。

- [ ] **步驟 3:HOLD** —— 不 push、不開 PR。回報分支狀態 + 截圖;等放行。

---

## 自我檢查

**Spec 覆蓋:**
- §3 契約(BuiltRequest + `{data}`)→ 任務 1/3/4。✅
- §4 共享引擎 → 任務 1。✅
- §5 route + 旋鈕 + registry → 任務 2/3。✅
- §6 客端接線 → 任務 4/5。✅
- §8 測試:純引擎(T1)、registry(T2)、route 含旋鈕(T3)、transport(T4)、切換(T5)。✅
- §9 截圖 → 任務 6。✅
- §10 無 changeset → 遵守(只動 apps/web)。✅
- §2/§7 紅線(不改 `packages/*`)、transport 留 app 級 → 各任務遵守。✅

**Placeholder 掃描:** 無 TBD/TODO;每個 code 步驟都給 code。✅

**型別一致:** `runQuery(rows, columns, fields, {params, filter})` 在 T1 定義、T3 route、T1 fake-fetcher 一致。`makeHttpFetcher(endpoint): (built)=>Promise<unknown>` 在 T4 定義 + T5 使用一致。route `POST(req, { params: Promise<{resource}> })` 對上 T3 測試的 `Promise.resolve(...)` 與 Next 16 async params。回應 `{data:{items,total,nextCursor?}}` 在 T1 fake-fetcher、T3 route、T4 測試一致。✅

**已知注意:** Next 16 App Router 的 `params` 是 Promise —— route `await ctx.params`、測試傳 `Promise.resolve({resource})`;若安裝的 Next 型別預期同步 params 物件,handler 與測試要一起改。
