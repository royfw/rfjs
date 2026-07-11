# package 級擬真 http-fetcher + metadata-builder 試打(#14)實作計畫

> **給執行者:** 必用子技能:superpowers:subagent-driven-development(建議)或 superpowers:executing-plans,逐任務執行。步驟用 checkbox(`- [ ]`)追蹤。

**目標:** 把 #247 的 app 級 transport 升級成 `@rfjs/table-builder-ui` 的擬真 `makeHttpFetcher(request)`,更新假 route 讀擬真格式,table-builder 改用它,並給 metadata-builder 一顆「試打 endpoint」鈕。

**架構:** fetcher 依 `RequestMeta`(method / filter param)把 `BuiltRequest` 序列化成 GET querystring / POST body;假 route 對稱地解析;table-builder remote HTTP 分支換用 package fetcher;metadata-builder protocol 區用同一 fetcher 試打 author 的 endpoint。

**技術棧:** Next.js 16 App Router、TypeScript、React 19、Vitest + @testing-library、`@rfjs/table-builder-ui`(private,transpilePackages)、`@rfjs/data-schema`。

## 全域約束

- **本輪刻意改 `packages/table-builder-ui`**(加 `makeHttpFetcher` export)——這是 #14 的目的。**不改其他 `packages/*`**;不破壞 table-builder-ui 既有 surface(既有測試全綠)。
- **changeset**:`@rfjs/table-builder-ui` **minor**(新 export;private = version-only);apps 不給。
- 契約 = 擬真:GET → params/filter 進 querystring;POST → params/filter 進 body(filter 走 `filter` key)。回應 `{data:{items,total,nextCursor?}}`。
- Commit:英文 Conventional Commits,結尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 一切從 worktree 根執行:`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-table-builder-http-fetcher`。web 測試 `pnpm -F web exec vitest run <pattern>`;table-builder-ui 測試 `pnpm -F @rfjs/table-builder-ui test`(或 `vitest run`);型別 `pnpm -F web check-types`;lint `pnpm -F web lint`。**vitest 過濾用純子字串(如 `"api/query"`),不要反斜線跳脫 `\[resource\]`(vitest 4 字面比對會匹配 0 檔)。**

---

## 檔案結構

- `packages/table-builder-ui/src/http-fetcher.ts`(新)+ `index.ts`(export)+ `http-fetcher.spec.ts`(新)
- `.changeset/http-fetcher.md`(新)
- `apps/web/src/app/api/query/[resource]/route.ts`(改:GET + POST 擬真)+ `route.spec.ts`(改)
- `apps/web/src/tools/table-builder/sample.ts`(改:endpoint)、`ui.tsx`(改:換 fetcher);`http-fetcher.ts`/`.spec.ts`(**刪**)
- `apps/web/src/tools/metadata-builder/protocol-panel.tsx`(改:試打鈕 + 預設)、`ui.tsx`/`messages.ts`(改:i18n)、`protocol-panel.spec.tsx`(改)

---

## Task 1 · package 級 makeHttpFetcher(@rfjs/table-builder-ui)

**檔案:** 新增 `packages/table-builder-ui/src/http-fetcher.ts` + `.spec.ts`;改 `src/index.ts`;新增 `.changeset/http-fetcher.md`

**介面:** 產出 `makeHttpFetcher(request: RequestMeta): (built: BuiltRequest) => Promise<unknown>`。

- [ ] **步驟 1:寫失敗測試**

新增 `packages/table-builder-ui/src/http-fetcher.spec.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { RequestMeta } from "@rfjs/data-schema";
import { makeHttpFetcher } from "./http-fetcher";

const getReq: RequestMeta = {
  endpoint: "/api/query/sample",
  method: "GET",
  pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
  filter: { style: "pg", param: "filter" },
};

describe("makeHttpFetcher", () => {
  it("GET: params + filter ride the querystring", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { items: [], total: 0 } }) });
    vi.stubGlobal("fetch", fetchMock);
    const built = { endpoint: "/api/query/sample", method: "GET", params: { limit: "10", offset: "0" }, filter: { logic: "and", filters: [] } };
    await makeHttpFetcher(getReq)(built as never);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("/api/query/sample?");
    expect(url).toContain("limit=10");
    expect(url).toContain("filter=");
    expect(fetchMock.mock.calls[0]![1].method).toBe("GET");
    vi.unstubAllGlobals();
  });

  it("POST: params + filter ride the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: {} }) });
    vi.stubGlobal("fetch", fetchMock);
    const postReq: RequestMeta = { ...getReq, method: "POST" };
    const built = { endpoint: "/api/query/sample", method: "POST", params: { limit: "10" }, filter: { logic: "and", filters: [] } };
    await makeHttpFetcher(postReq)(built as never);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.limit).toBe("10");
    expect(body.filter).toEqual({ logic: "and", filters: [] });
    vi.unstubAllGlobals();
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(makeHttpFetcher(getReq)({ endpoint: "/x", method: "GET", params: {} } as never)).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **步驟 2:跑測試確認 FAIL**

執行:`pnpm -F @rfjs/table-builder-ui exec vitest run http-fetcher`
預期:FAIL —— 模組不存在。

- [ ] **步驟 3:實作**

新增 `packages/table-builder-ui/src/http-fetcher.ts`:

```ts
import type { BuiltRequest, RequestMeta } from "@rfjs/data-schema";

/**
 * RequestMeta-driven HTTP transport for a remote `TableSource.fetch`. Serializes the tool's
 * `BuiltRequest` into a real-shaped request: GET puts params + filter (JSON) on the querystring,
 * POST puts them in the JSON body; the filter rides under `request.filter.param`. Non-2xx throws.
 */
export function makeHttpFetcher(request: RequestMeta): (built: BuiltRequest) => Promise<unknown> {
  const filterParam = request.filter?.param;
  return async (built: BuiltRequest): Promise<unknown> => {
    const method = built.method ?? "GET";
    let res: Response;
    if (method === "GET") {
      const qs = new URLSearchParams(built.params);
      if (built.filter !== undefined && filterParam) qs.set(filterParam, JSON.stringify(built.filter));
      res = await fetch(`${built.endpoint}?${qs.toString()}`, { method: "GET" });
    } else {
      const body: Record<string, unknown> = { ...built.params };
      if (built.filter !== undefined && filterParam) body[filterParam] = built.filter;
      res = await fetch(built.endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    if (!res.ok) throw new Error(`query failed: ${res.status}`);
    return res.json();
  };
}
```

在 `packages/table-builder-ui/src/index.ts` 末尾加:

```ts
export * from './http-fetcher';
```

- [ ] **步驟 4:跑測試確認 PASS**

執行:`pnpm -F @rfjs/table-builder-ui exec vitest run http-fetcher`
預期:PASS(3 cases)。
執行:`pnpm -F @rfjs/table-builder-ui exec tsc --noEmit`(或該套件的 check-types 腳本)
預期:無錯誤。

- [ ] **步驟 5:changeset**

新增 `.changeset/http-fetcher.md`:

```md
---
"@rfjs/table-builder-ui": minor
---

Add `makeHttpFetcher(request)` — a RequestMeta-driven HTTP transport for a remote `TableSource.fetch` (GET querystring / POST body serialization, filter under the configured param).
```

- [ ] **步驟 6:Commit**

```bash
git add packages/table-builder-ui/src/http-fetcher.ts packages/table-builder-ui/src/http-fetcher.spec.ts packages/table-builder-ui/src/index.ts .changeset/http-fetcher.md
git commit -m "$(cat <<'EOF'
feat(table-builder-ui): add RequestMeta-driven makeHttpFetcher transport

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 · 假 route 讀擬真格式(GET + POST)

**檔案:** 改 `apps/web/src/app/api/query/[resource]/route.ts` + `route.spec.ts`

**介面:** 消費 `getResource`/`runQuery`(既有)。GET/POST 皆回 `{data:{items,total,nextCursor?}}`;GET 從 querystring、POST 從 body 取 params/filter;knobs 恆在 querystring。

- [ ] **步驟 1:改測試(先讓新格式失敗)**

把 `route.spec.ts` 重寫成擬真格式(GET 為主 + POST + knobs):

```ts
import { describe, it, expect } from "vitest";
import { GET, POST } from "./route";

const ctx = (resource: string) => ({ params: Promise.resolve({ resource }) });

describe("GET /api/query/[resource]", () => {
  it("returns { data:{items,total} } from querystring params", async () => {
    const res = await GET(new Request("http://t/api/query/sample?limit=5&offset=0"), ctx("sample"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { items: unknown[]; total: number } };
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(json.data.total).toBeGreaterThan(0);
  });

  it("applies a filter passed on the querystring", async () => {
    const filter = encodeURIComponent(JSON.stringify({ logic: "and", filters: [{ target: "column", column: "status", operator: "eq", value: "published" }] }));
    const res = await GET(new Request(`http://t/api/query/sample?limit=50&filter=${filter}`), ctx("sample"));
    const json = (await res.json()) as { data: { items: { status: string }[]; total: number } };
    expect(json.data.items.every((r) => r.status === "published")).toBe(true);
  });

  it("404 unknown resource; ?error=500 → 500; ?empty=1 → 0 items", async () => {
    expect((await GET(new Request("http://t/api/query/nope"), ctx("nope"))).status).toBe(404);
    expect((await GET(new Request("http://t/api/query/sample?error=500"), ctx("sample"))).status).toBe(500);
    const empty = await GET(new Request("http://t/api/query/sample?empty=1"), ctx("sample"));
    expect(((await empty.json()) as { data: { total: number } }).data.total).toBe(0);
  });
});

describe("POST /api/query/[resource]", () => {
  it("reads params + filter from the body", async () => {
    const req = new Request("http://t/api/query/sample", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: "5", offset: "0", filter: { logic: "and", filters: [] } }),
    });
    const res = await POST(req, ctx("sample"));
    const json = (await res.json()) as { data: { items: unknown[] } };
    expect(json.data.items.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **步驟 2:跑測試確認 FAIL**

執行:`pnpm -F web exec vitest run "api/query"`
預期:FAIL —— 目前 route 無 `GET` export(且 POST 讀 `body.params`,新測試送扁平 body)。

- [ ] **步驟 3:重寫 route**

`apps/web/src/app/api/query/[resource]/route.ts`:

```ts
import { getResource } from "@/lib/query-resources";
import { runQuery } from "@/lib/fake-query";

// runQuery 拉入 @rfjs/filter-builder + crypto.randomUUID → Node runtime。
export const runtime = "nodejs";

interface Built { params: Record<string, string>; filter?: unknown }

const KNOBS = new Set(["delay", "error", "empty"]);

// knobs(delay/error/empty)恆在 querystring;GET 的 params/filter 也在 querystring,
// POST 的則在 body —— 兩者最後都收斂成 Built 交給共用的 respond()。
async function respond(resource: string, knob: URLSearchParams, built: Built): Promise<Response> {
  const errorCode = Number(knob.get("error"));
  if (errorCode >= 400) return Response.json({ error: "forced" }, { status: errorCode });
  const delay = Number(knob.get("delay"));
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  const found = getResource(resource);
  if (!found) return Response.json({ error: `unknown resource ${resource}` }, { status: 404 });

  const rows = knob.get("empty") ? [] : found.rows;
  const { items, total, nextCursor } = runQuery(rows, found.columns, found.fields, built);
  const data: Record<string, unknown> = { items, total };
  if (nextCursor !== undefined) data.nextCursor = nextCursor;
  return Response.json({ data });
}

export async function GET(req: Request, ctx: { params: Promise<{ resource: string }> }): Promise<Response> {
  const { resource } = await ctx.params;
  const qs = new URL(req.url).searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of qs) if (!KNOBS.has(k) && k !== "filter") params[k] = v;
  const raw = qs.get("filter");
  return respond(resource, qs, { params, filter: raw ? JSON.parse(raw) : undefined });
}

export async function POST(req: Request, ctx: { params: Promise<{ resource: string }> }): Promise<Response> {
  const { resource } = await ctx.params;
  const qs = new URL(req.url).searchParams;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { filter, ...rest } = body;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(rest)) params[k] = String(v);
  return respond(resource, qs, { params, filter });
}
```

- [ ] **步驟 4:跑測試確認 PASS**

執行:`pnpm -F web exec vitest run "api/query"`
預期:PASS。
執行:`pnpm -F web check-types` → 無錯誤。

- [ ] **步驟 5:Commit**

```bash
git add "apps/web/src/app/api/query/[resource]/route.ts" "apps/web/src/app/api/query/[resource]/route.spec.ts"
git commit -m "$(cat <<'EOF'
feat(web): fake query route reads faithful GET/POST format

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 · table-builder 改用 package fetcher

**檔案:** 改 `apps/web/src/tools/table-builder/{sample.ts,ui.tsx}`;**刪** `apps/web/src/tools/table-builder/http-fetcher.ts` + `http-fetcher.spec.ts`

**介面:** 消費 `makeHttpFetcher`(`@rfjs/table-builder-ui`,Task 1)。

- [ ] **步驟 1:改 sample endpoint**

`sample.ts`:`SAMPLE_META.request.endpoint` `"/api/sample/items"` → `"/api/query/sample"`。

- [ ] **步驟 2:改 ui.tsx 換 fetcher**

- 移除 `import { makeHttpFetcher } from "./http-fetcher";`,改為(與既有 table-builder-ui import 併排):
  ```ts
  import { makeHttpFetcher } from "@rfjs/table-builder-ui";
  ```
- source useMemo 的 HTTP 分支:`makeHttpFetcher("/api/query/sample")` → `makeHttpFetcher(request)`(此處 `request` 已於 memo 內建好)。

- [ ] **步驟 3:刪除 app 級 fetcher**

```bash
git rm apps/web/src/tools/table-builder/http-fetcher.ts apps/web/src/tools/table-builder/http-fetcher.spec.ts
```
確認無殘留 import(grep `./http-fetcher`)。

- [ ] **步驟 4:跑測試 + 型別**

執行:`pnpm -F web exec vitest run table-builder`
預期:PASS(既有測試不受影響;source memo 行為不變)。
執行:`pnpm -F web check-types` → 無錯誤(且無 `./http-fetcher` 殘引用)。

- [ ] **步驟 5:Commit**

```bash
git add apps/web/src/tools/table-builder/sample.ts apps/web/src/tools/table-builder/ui.tsx
git commit -m "$(cat <<'EOF'
refactor(web): table-builder consumes @rfjs/table-builder-ui makeHttpFetcher

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 · metadata-builder 試打 endpoint

**檔案:** 改 `apps/web/src/tools/metadata-builder/{protocol-panel.tsx,ui.tsx,messages.ts,model.ts}` + `protocol-panel.spec.tsx`

**介面:** 消費 `buildRequestParams`/`extractRows`(`@rfjs/data-schema`)、`makeHttpFetcher`(`@rfjs/table-builder-ui`)。

- [ ] **步驟 1:寫失敗測試**

在 `protocol-panel.spec.tsx` 追加(若既有檔已 import render/screen/fireEvent/vi/describe/it/expect/SourcePanel 對應項,**不要重複 import**;只加新 `describe`):

```tsx
describe("ProtocolPanel try endpoint", () => {
  const req = {
    endpoint: "/api/query/sample",
    method: "GET" as const,
    pagination: { strategy: "offset" as const, limitParam: "limit", offsetParam: "offset" },
    filter: { style: "pg" as const, param: "filter" },
  };
  const res = { rowsPath: "data.items", totalPath: "data.total" };

  it("fires the request and shows the row count", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { items: [{ id: 1 }, { id: 2 }], total: 2 } }) }));
    render(<ProtocolPanel request={req} response={res} onChange={() => {}} labels={LABELS} />);
    fireEvent.click(screen.getByRole("button", { name: /try|試打/i }));
    // 斷言 count span 專屬字串 "2 rows"(LABELS.tryRows="{count} rows".replace → "2 rows");
    // 原始 JSON <pre> 不含 "2 rows",避免 findByText 多重匹配。
    expect(await screen.findByText(/2 rows/)).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("shows an error when the fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    render(<ProtocolPanel request={req} response={res} onChange={() => {}} labels={LABELS} />);
    fireEvent.click(screen.getByRole("button", { name: /try|試打/i }));
    expect(await screen.findByText(/boom/)).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
```

> 註:新 describe 直接用既有 `LABELS` const(步驟 3 會補上 `try`/`tryRows`/`tryError` 三個 key,其中 `tryRows: "{count} rows"` 保留字面 `{count}`)。**不要重複 import、不要加 `import * as React`。**

- [ ] **步驟 2:跑測試確認 FAIL**

執行:`pnpm -F web exec vitest run protocol-panel`
預期:FAIL —— 無試打鈕 / 新 label。

- [ ] **步驟 3:加 labels 欄位 + i18n**

- `protocol-panel.tsx` 的 `ProtocolPanelLabels` interface 加:`try: string; tryRows: string; tryError: string;`
- **既有 `protocol-panel.spec.tsx` 的 `LABELS` const 一併補這三個 key**(否則變 22/25 欄,5 處 `labels={LABELS}` 會 tsc 失敗 —— 這是驗證找到的必修點):`try: "Try", tryRows: "{count} rows", tryError: "Request failed",`。
- `ui.tsx` 的 `protocolLabels` useMemo 加:`try: t("mbTry"), tryRows: t.raw("mbTryRows") as string, tryError: t("mbTryError"),`
  > **`tryRows` 必須用 `t.raw(...)`**:`mbTryRows` 含 `{count}`,用 `t("mbTryRows")` 會在 real Next runtime 丟 `IntlError: FORMATTING_ERROR`(vitest/`next build` 吞掉,但工具掛載即崩;memory `rfjs-next-intl-count-placeholder`,曾炸 #183/#237)。`t.raw` 取字面 `{count}` 字串,供 protocol-panel 端 `.replace("{count}", String(rows))`。
- `messages.ts` en 區加:`mbTry: "Try endpoint", mbTryRows: "{count} rows", mbTryError: "Request failed",`;zh-TW 區加:`mbTry: "試打", mbTryRows: "{count} 筆", mbTryError: "請求失敗",`(保留其他 locale key)。

- [ ] **步驟 4:實作試打(protocol-panel.tsx)**

imports:
```ts
import { buildRequestParams, extractRows } from "@rfjs/data-schema";
import { makeHttpFetcher } from "@rfjs/table-builder-ui";
```
預設值改為指向假 route(showcase 開箱可試):
```ts
const DEFAULT_REQUEST: RequestMeta = {
  endpoint: "/api/query/sample",
  method: "GET",
  pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
};
const DEFAULT_RESPONSE: ResponseMeta = { rowsPath: "data.items", totalPath: "data.total" };
```
在 `ProtocolPanel` 內加狀態 + handler,並在 `enabled && request && response` 區塊尾端渲染鈕 + 結果:
```tsx
const [trying, setTrying] = React.useState(false);
const [tryOut, setTryOut] = React.useState<{ rows: number; raw: string } | null>(null);
const [tryErr, setTryErr] = React.useState<string | null>(null);

async function runTry() {
  if (!request || !response) return;
  setTrying(true); setTryOut(null); setTryErr(null);
  try {
    const built = buildRequestParams(request, { pageSize: 10 });
    const out = await makeHttpFetcher(request)(built);
    setTryOut({ rows: extractRows(out, response).length, raw: JSON.stringify(out, null, 2) });
  } catch (e) {
    setTryErr(e instanceof Error ? e.message : labels.tryError);
  } finally {
    setTrying(false);
  }
}
```
```tsx
<div className="col-span-2 mt-1 flex flex-col gap-1">
  <button type="button" disabled={trying} onClick={runTry} className="w-fit rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
    {labels.try}
  </button>
  {tryErr && <span className="text-xs text-destructive">{tryErr}</span>}
  {tryOut && (
    <>
      <span className="text-xs text-muted-foreground">{labels.tryRows.replace("{count}", String(tryOut.rows))}</span>
      <pre className="max-h-40 overflow-auto rounded-md border border-input bg-muted/30 p-2 font-mono text-[11px]">{tryOut.raw}</pre>
    </>
  )}
</div>
```
> `labels.tryRows` 是含字面 `{count}` 的字串(由 ui.tsx 的 `t.raw` 取得),顯示時 `.replace("{count}", String(tryOut.rows))` 代入實際筆數 → 例如 "2 rows"。錯誤時顯示 `tryErr`(即 `e.message`)。

- [ ] **步驟 4b:改 `model.ts` 的初始 endpoint(驗證找到的必修點)**

試打實際打的是 `meta.request`,而工具初始 `meta = DEFAULT_META`(`model.ts`),其 `request.endpoint = "/api/sample/items"` 是**死路**(無 route handler)——只改 protocol-panel.tsx 的 `DEFAULT_REQUEST` 沒用(那只在重新 toggle 時才套用)。

在 `apps/web/src/tools/metadata-builder/model.ts` 把 `DEFAULT_META.request.endpoint` `"/api/sample/items"` → `"/api/query/sample"`(method 維持 `POST` 即可——新 route 支援 POST;`DEFAULT_META.response` 的 `data.items`/`data.total` 已對齊)。這樣一載入、protocol 開著、按試打就命中假 route、顯示筆數(Task 5 截圖才成立)。

- [ ] **步驟 5:跑測試 + 型別 + lint**

執行:`pnpm -F web exec vitest run protocol-panel metadata-builder`
預期:PASS。
執行:`pnpm -F web check-types` → 無錯誤。
執行:`pnpm -F web lint`(至少 touched 檔)→ 無錯誤。
> 若 `protocol-panel.spec` 既有測試斷言 `DEFAULT_REQUEST`/`DEFAULT_RESPONSE` 舊值,一併更新為新預設。

- [ ] **步驟 6:Commit**

```bash
git add apps/web/src/tools/metadata-builder/protocol-panel.tsx apps/web/src/tools/metadata-builder/ui.tsx apps/web/src/tools/metadata-builder/messages.ts apps/web/src/tools/metadata-builder/model.ts apps/web/src/tools/metadata-builder/protocol-panel.spec.tsx
git commit -m "$(cat <<'EOF'
feat(web): add "try endpoint" to metadata-builder protocol panel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 · 全量驗證 + 截圖

**檔案:** 無(只驗證)。

- [ ] **步驟 1:全量驗證**

執行:`pnpm -F @rfjs/table-builder-ui exec vitest run`(該套件全測)→ PASS。
執行:`pnpm -F web exec vitest run "api/query" table-builder protocol-panel metadata-builder` → PASS。
執行:`pnpm -F web check-types` → 無錯誤(既有無關錯誤記錄不修)。
執行:`pnpm -F web lint` → 無錯誤。

- [ ] **步驟 2:截圖(verify skill)**

worktree 起 dev 於非 3000 埠(`pnpm --dir <wt>/apps/web exec next dev --port 3140`),bundled chromium(`~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`)自寫腳本(同 #247):
- table-builder:切 Fake fetcher + HTTP → 表格從 **GET** `/api/query/sample?...` 渲染(攔 network 確認是 GET + querystring)。
- metadata-builder:protocol 開啟 → 按「試打」→ 回應區顯示 rows 數(打 `/api/query/sample`)。
存 scratchpad,回報路徑。

- [ ] **步驟 3:HOLD** —— 不 push、不開 PR。回報分支狀態 + 截圖;等放行。

---

## 自我檢查

**Spec 覆蓋:** Piece1→T1、Piece2→T2、Piece3→T3、Piece4→T4、驗證/截圖→T5。changeset(T1)、i18n(T4)、刪 app 級 fetcher(T3)皆有。✅
**Placeholder 掃描:** 無 TBD/TODO;每 code 步驟有 code。✅
**型別一致:** `makeHttpFetcher(request: RequestMeta)` 在 T1 定義、T3/T4 使用一致;route GET/POST 皆回 `{data:{items,total,nextCursor?}}`;`buildRequestParams(request,{pageSize:10})` / `extractRows(out,response)` 簽名對齊 §讀到的 data-schema。✅
**已知注意:**
1. route GET 的 knobs(delay/error/empty)與 params 共用 querystring → `KNOBS` set + 排除 `filter` 後其餘為 params。
2. metadata-builder 試打固定打 `/api/query/sample`,回書籍樣本(spec §5:試打驗協定/看形狀,非回自有資料;A 案)。
3. 改 `DEFAULT_REQUEST/RESPONSE` 若撞既有 protocol-panel.spec 斷言 → 一併更新。
4. 與後續視覺輪:本輪動 table-builder `ui.tsx`;視覺輪 rebase 在本輪之後(使用者已定序)。
