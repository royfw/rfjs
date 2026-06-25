# apps/web `es-client-demo` Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add an `apps/web` tool that builds a filter-tree, compiles it to an ES/OpenSearch search body, and **executes it with the real `@rfjs/es-client` functions** over an injected **mock `SearchTransport`** that truly filters the sample data (via `runLiveMatch`). Demonstrates search / paginate (search_after + PIT) / highlight.

**Architecture:** Reuse the shared `_filter-builder` hook (sample + tree). The mock transport receives the already-matched rows (UI runs `runLiveMatch`) and only does pagination + highlight; the UI calls the actual `search` / `paginateAll` / `buildHighlight`+`parseHighlight` from `@rfjs/es-client` against it. Only the transport is fake — the es-client code path is real.

**Tech Stack:** Next.js (`"use client"`), next-intl, Vitest + Testing Library, `@rfjs/es-client`, `@rfjs/es-query`, `@rfjs/filter-builder`, `@rfjs/web-core`.

## Global Constraints

- Mock transport lives in the tool dir (demo-only, unit-tested); **not** promoted into `@rfjs/es-client` (YAGNI).
- i18n `ToolUI` keys use a unique `ecd*` prefix; `Tools.<id>` title/description in en + zh-TW.
- Registry rules (web-core `registry.spec.ts`): web tool needs ≥1 `relatedPackages`; ids unique; `relatedPackages`/`relatedTools` cross-refs resolve.
- Neutral copy only. Commit per green step.

---

## File Structure

```
apps/web/package.json                          # + @rfjs/es-client, @rfjs/es-query deps
packages/web-core/src/registry/tools.ts         # + es-client-demo entry
packages/web-core/src/registry/packages.ts       # @rfjs/es-client relatedTools += es-client-demo
apps/web/src/tools/es-client-demo/
  mock-transport.ts        # makeMockTransport + extractTerms (TDD core)
  mock-transport.spec.ts
  index.ts                 # ToolModule
  ui.tsx                   # "use client" orchestrator
  messages.ts              # i18n en/zh
  ui.spec.tsx              # render test
apps/web/src/tools/index.ts          # register component
apps/web/src/tools/messages.ts       # register messages
apps/web/src/tools/index.spec.ts     # EXPECTED_WEB_TOOL_IDS += es-client-demo
```

---

### Task 1: Deps + registry

- [ ] **Step 1:** Add to `apps/web/package.json` dependencies: `"@rfjs/es-client": "workspace:*"` and `"@rfjs/es-query": "workspace:*"`. Run `pnpm install`.
- [ ] **Step 2:** In `packages/web-core/src/registry/tools.ts`, add after `es-query-builder`:
  ```ts
  {
    id: 'es-client-demo',
    category: 'query',
    surface: 'web',
    status: 'preview',
    relatedPackages: ['@rfjs/es-client', '@rfjs/es-query'],
    tags: ['client', 'playground'],
  },
  ```
- [ ] **Step 3:** In `packages/web-core/src/registry/packages.ts`, add `relatedTools: ['es-client-demo']` to the `@rfjs/es-client` entry.
- [ ] **Step 4:** Run `pnpm -F @rfjs/web-core vitest:run` → PASS. Commit `feat(web-core): register es-client-demo tool`.

---

### Task 2: Mock transport (TDD core)

**Interfaces produced:**
- `extractTerms(tree: BuilderGroup): string[]` — unique string literals used in conditions (for highlight marking).
- `makeMockTransport(matched: Record<string, unknown>[], opts?: { terms?: string[]; index?: string }): SearchTransport` — honors `size` / `from` / `search_after` (cursor = global index) and `highlight.fields`; `openPit`→`"pit-mock"`, `closePit`/`msearch` no-op/empty.

- [ ] **Step 1: RED** — write `mock-transport.spec.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeMockTransport, extractTerms } from "./mock-transport";
import type { BuilderGroup } from "@rfjs/filter-builder";

const docs = [
  { id: "a", status: "open", body: "please refund my order" },
  { id: "b", status: "open", body: "where is my package" },
  { id: "c", status: "open", body: "refund processed" },
];

describe("makeMockTransport", () => {
  it("returns matched rows as hits + total", async () => {
    const t = makeMockTransport(docs);
    const res = await t.search({ index: "i", body: { size: 10 } });
    expect(res.hits.total.value).toBe(3);
    expect(res.hits.hits.map((h) => h._id)).toEqual(["a", "b", "c"]);
    expect(res.hits.hits[0]._source).toEqual(docs[0]);
    expect(res.hits.hits[0].sort).toEqual([0]);
  });

  it("honors size and from", async () => {
    const t = makeMockTransport(docs);
    const res = await t.search({ index: "i", body: { size: 1, from: 1 } });
    expect(res.hits.hits.map((h) => h._id)).toEqual(["b"]);
  });

  it("pages with search_after (cursor = last sort)", async () => {
    const t = makeMockTransport(docs);
    const p1 = await t.search({ index: "i", body: { size: 2 } });
    expect(p1.hits.hits.map((h) => h._id)).toEqual(["a", "b"]);
    const after = p1.hits.hits[1].sort;
    const p2 = await t.search({ index: "i", body: { size: 2, search_after: after } });
    expect(p2.hits.hits.map((h) => h._id)).toEqual(["c"]);
  });

  it("marks query terms in highlight fields", async () => {
    const t = makeMockTransport(docs, { terms: ["refund"] });
    const res = await t.search({
      index: "i",
      body: { size: 10, highlight: { fields: { body: {} } } },
    });
    expect(res.hits.hits[0].highlight).toEqual({ body: ["please <em>refund</em> my order"] });
    expect(res.hits.hits[1].highlight).toBeUndefined(); // "where is my package" has no term
  });

  it("openPit returns an id; closePit is a no-op", async () => {
    const t = makeMockTransport(docs);
    expect(await t.openPit({ index: "i", keepAlive: "1m" })).toBe("pit-mock");
    await expect(t.closePit("pit-mock")).resolves.toBeUndefined();
  });
});

describe("extractTerms", () => {
  it("collects unique string literals from conditions", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [
        { kind: "condition", id: "1", field: "status", dataType: "string", operator: "eq", value: "open" },
        { kind: "condition", id: "2", field: "body", dataType: "string", operator: "contains", value: "refund" },
        { kind: "condition", id: "3", field: "age", dataType: "numeric", operator: "gt", value: 18 },
      ],
    };
    expect(extractTerms(tree).sort()).toEqual(["open", "refund"]);
  });
});
```

- [ ] **Step 2: Verify RED** — `pnpm -F web exec vitest run src/tools/es-client-demo/mock-transport` → FAIL (module missing).

- [ ] **Step 3: GREEN** — write `mock-transport.ts`:
```ts
import type {
  EsHit,
  EsSearchRequest,
  EsSearchResponse,
  SearchTransport,
} from "@rfjs/es-client";
import type { BuilderGroup, BuilderItem } from "@rfjs/filter-builder";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractTerms(tree: BuilderGroup): string[] {
  const out = new Set<string>();
  const walk = (items: BuilderItem[]): void => {
    for (const item of items) {
      if (item.kind === "group") walk(item.children);
      else {
        const v = item.value;
        if (typeof v === "string" && v) out.add(v);
        else if (Array.isArray(v)) for (const e of v) if (typeof e === "string" && e) out.add(e);
      }
    }
  };
  walk(tree.children);
  return [...out];
}

function mark(text: string, terms: string[]): string {
  let out = text;
  for (const t of terms) {
    if (!t) continue;
    out = out.replace(new RegExp(escapeRegex(t), "gi"), (m) => `<em>${m}</em>`);
  }
  return out;
}

export interface MockTransportOptions {
  terms?: string[];
  index?: string;
}

export function makeMockTransport(
  matched: Record<string, unknown>[],
  opts: MockTransportOptions = {},
): SearchTransport {
  const terms = opts.terms ?? [];
  const index = opts.index ?? "demo";
  const ordered = matched.map((doc, i) => ({ doc, i }));

  const toHit = (entry: { doc: Record<string, unknown>; i: number }, fields?: string[]): EsHit => {
    const { doc, i } = entry;
    const hit: EsHit = {
      _index: index,
      _id: String(doc.id ?? i),
      _score: 1,
      _source: doc,
      sort: [i],
    };
    if (fields?.length && terms.length) {
      const hl: Record<string, string[]> = {};
      for (const f of fields) {
        const v = doc[f];
        if (typeof v === "string") {
          const marked = mark(v, terms);
          if (marked !== v) hl[f] = [marked];
        }
      }
      if (Object.keys(hl).length) hit.highlight = hl;
    }
    return hit;
  };

  const page = (body: Record<string, unknown>) => {
    const size = typeof body.size === "number" ? body.size : 10;
    let start = 0;
    const sa = body.search_after as unknown[] | undefined;
    if (sa && typeof sa[0] === "number") start = (sa[0] as number) + 1;
    else if (typeof body.from === "number") start = body.from;
    return ordered.slice(start, start + size);
  };

  const fieldsOf = (body: Record<string, unknown>): string[] | undefined => {
    const h = body.highlight as { fields?: Record<string, unknown> } | undefined;
    return h?.fields ? Object.keys(h.fields) : undefined;
  };

  return {
    search<T = unknown>(req: EsSearchRequest): Promise<EsSearchResponse<T>> {
      const body = req.body as Record<string, unknown>;
      const hits = page(body).map((e) => toHit(e, fieldsOf(body)));
      return Promise.resolve({
        took: 0,
        timed_out: false,
        hits: {
          total: { value: ordered.length, relation: "eq" },
          max_score: ordered.length ? 1 : null,
          hits: hits as EsHit<T>[],
        },
      });
    },
    count(): Promise<number> {
      return Promise.resolve(ordered.length);
    },
    msearch<T = unknown>(): Promise<EsSearchResponse<T>[]> {
      return Promise.resolve([]);
    },
    openPit(): Promise<string> {
      return Promise.resolve("pit-mock");
    },
    closePit(): Promise<void> {
      return Promise.resolve();
    },
  };
}
```

- [ ] **Step 4: Verify GREEN** — same vitest command → PASS (6 cases). Commit `feat(web): add es-client-demo mock transport`.

---

### Task 3: Tool module + UI + registration

- [ ] **Step 1:** Write `messages.ts` (en + zh-TW) with `Tools["es-client-demo"]` {title, description} and `ToolUI` `ecd*` keys: `ecdSample, ecdInvalidSample, ecdRaw, ecdUpload, ecdFields, ecdInclude, ecdType, ecdFilterLogic, ecdRequest, ecdScenario, ecdRun, ecdResult, ecdTotal, ecdUncoverable, ecdSnippet, ecdCopy, ecdLogicAnd/Or/Nor/Not, ecdAdd*/remove*, ecdValueHint, ecdToggleGroup, ecdCollapsed*, ecdElemMatch, ecdScenarioSearch/Paginate/Highlight`.
- [ ] **Step 2:** Write `ui.tsx` (`"use client"`, `EsClientDemo`):
  - `fb = useFilterBuilder({ sample })` (sample: docs with status/age/body/tags).
  - tree editor via `FilterTreeEditor engineId="es-query"` + `MetadataStrip` + `SampleCard` (same labels pattern as mongo tool).
  - `compiled = getEngine("es-query").compile(treeToFilterGroup(fb.tree), toCompileContext(fb.schema))`.
  - `live = runLiveMatch(fb.rows, fb.tree)`.
  - request body: `compiled.ok ? { query: JSON.parse(compiled.primary), size: 10 } : null`; show JSON.
  - scenario state `"search" | "paginate" | "highlight"`; on Run (async) build the transport `makeMockTransport(live.matched as Record<string,unknown>[], { terms: extractTerms(fb.tree) })` and call the real es-client fn:
    - search: `await search(transport, { index: "demo", body })`
    - paginate: `for await (const b of paginateAll(transport, { index: "demo", body: { query: body.query }, pageSize: 2 })) batches.push(b)`
    - highlight: `await search(transport, { index: "demo", body: { ...body, ...buildHighlight({ fields: ["body"] }) } })`, then `parseHighlight(hit)` per hit.
  - if `live.uncoverable` → disable Run, show `ecdUncoverable` note.
  - render request JSON, scenario tabs, Run button, result panel (total + hits; highlight rendered by splitting `<em>…</em>`), and a static code snippet per scenario.
- [ ] **Step 3:** Write `index.ts` (`tool = { id: "es-client-demo", Component: EsClientDemo }`) and `ui.spec.tsx` (render with `messages.en`, assert a static label e.g. the Fields/Request heading).
- [ ] **Step 4:** Register in `apps/web/src/tools/index.ts` (component) + `messages.ts` (messages, alphabetical by path) + add `"es-client-demo"` to `index.spec.ts` `EXPECTED_WEB_TOOL_IDS`.
- [ ] **Step 5:** Build deps (`pnpm -F @rfjs/es-client build && pnpm -F @rfjs/es-query build && pnpm -F @rfjs/web-core build && pnpm -F @rfjs/filter-builder build`), then `pnpm -F web exec vitest run src/tools/es-client-demo src/tools/index.spec` → PASS. Lint the new files. Commit `feat(web): add es-client-demo interactive tool`.

---

## Self-Review

**Spec coverage:** mock transport truly filters (Task 2 via matched rows from `runLiveMatch`); real es-client search/paginate/highlight (Task 3); injected-transport story front and center; registry + i18n (Tasks 1, 3); uncoverable-op note (Task 3). ✅

**Placeholder scan:** Task 2 (the TDD core) has full code; Task 3 UI is composition over the established `_filter-builder` pattern + listed es-client calls. No "TODO".

**Type consistency:** `makeMockTransport` returns `SearchTransport` (es-client); `EsHit.sort` cursor is `[number]`, consumed by `paginateAll` search_after; `extractTerms` takes `BuilderGroup`. ✅
