# `@rfjs/es-client` Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@rfjs/es-client` — a client-agnostic execution layer over `@rfjs/es-query`: a `SearchTransport` contract, Elasticsearch/OpenSearch adapters, `search`/`count`/`msearch` wrappers, `search_after` + PIT deep pagination, and a generic highlight config/parse helper.

**Architecture:** The package never imports a concrete ES client. It defines a `SearchTransport` interface; users wrap their own client with `fromElasticClient(client)` or `fromOpenSearchClient(client)`. The wrappers normalize the two clients' response shapes (Elasticsearch v8 returns the body directly; OpenSearch returns `{ body }`) and PIT APIs (`openPointInTime`/`closePointInTime` vs `createPit`/`deletePit`). Search/count/msearch/pagination/highlight build on the transport, not on any client.

**Tech Stack:** TypeScript 5.7, tsdown, Vitest, `@rfjs/es-query` (workspace). No third-party runtime deps; ES/OpenSearch client libs are the user's concern (passed into adapters).

## Global Constraints

- **Node:** >=18; `.nvmrc` `v24.16.0`. **pnpm** >=10.24.0. **TypeScript** 5.7+, `strict: true`.
- **Package name:** `@rfjs/es-client`, `"version": "0.0.0"`, `"private": false`, `publishConfig.access = "public"`.
- **No third-party runtime deps.** Runtime dependency allowed: `@rfjs/es-query` (`workspace:*`). The ES/OpenSearch client libraries must NOT appear in `dependencies` or `peerDependencies` — adapters accept a structurally-typed client argument.
- **Targets modern ES (8.x/9.x) and OpenSearch (2.x/3.x) only.**
- **Source layout:** subfolders by responsibility (`adapters/` is a clear sub-domain); co-locate `*.spec.ts`; barrels per folder; root `src/index.ts` is the only `exports` entry. camelCase module names.
- **Docs rule:** README examples must be neutral — never reference any source project.
- **Tests:** Vitest, `globals: true`, exercised with fake transports and mock client objects (no live cluster). Commit after each green step (Conventional Commits).

---

## File Structure

```
packages/es-client/
  package.json  tsconfig.json  tsconfig.build.json  tsdown.config.ts
  vitest.config.mts  eslint.config.mjs  .npmrc .nvmrc .prettierrc .versionrc
  README.md  README.zh-TW.md
  src/
    index.ts                       # barrel
    types.ts                       # SearchTransport, request/response/hit types, results
    search.ts                      # search/count/msearch wrappers (normalize hits → sources)
    search.spec.ts
    highlight.ts                   # buildHighlight config + parseHighlight response
    highlight.spec.ts
    paginate.ts                    # paginateAll: search_after + PIT async generator
    paginate.spec.ts
    adapters/
      index.ts                     # barrel
      elasticsearch.ts             # fromElasticClient(client) → SearchTransport
      elasticsearch.spec.ts
      opensearch.ts                # fromOpenSearchClient(client) → SearchTransport
      opensearch.spec.ts
```

---

### Task 1: Scaffold the package

**Files:**
- Create all config files (copy from `@rfjs/es-query`), `package.json`, temp `src/index.ts`.

**Interfaces:**
- Produces: installable `@rfjs/es-client` with working `vitest:run`/`typecheck`/`build`.

- [ ] **Step 1: Copy config files from `es-query`**

```bash
cd /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-es-query
mkdir -p packages/es-client/src/adapters
for f in tsconfig.json tsconfig.build.json tsdown.config.ts vitest.config.mts eslint.config.mjs .npmrc .nvmrc .prettierrc .versionrc; do
  cp "packages/es-query/$f" "packages/es-client/$f"
done
printf 'export {};\n' > packages/es-client/src/index.ts
```

- [ ] **Step 2: Write `package.json`**

Same shape as `es-query`'s manifest with these changes: `"name": "@rfjs/es-client"`, `"description": "Elasticsearch / OpenSearch execution layer — client-agnostic search, pagination, highlight over @rfjs/es-query"`, `"keywords": ["elasticsearch","opensearch","client","search","pagination"]`, `repository.directory` and `homepage` → `packages/es-client`, and:
```json
  "dependencies": {
    "@rfjs/es-query": "workspace:*"
  }
```
(devDependencies identical to `es-query`'s.)

- [ ] **Step 3: Install + verify**

```bash
pnpm install
pnpm -F @rfjs/es-query build      # ensure dependency types exist
pnpm -F @rfjs/es-client vitest:run
```
Expected: install OK; vitest exits 0 ("no test files").

- [ ] **Step 4: Commit**

```bash
git add packages/es-client
git commit -m "build(es-client): scaffold @rfjs/es-client package"
```

---

### Task 2: Transport + response types

**Files:**
- Create: `packages/es-client/src/types.ts`

**Interfaces:**
- Consumes: `EsSearchBody` from `@rfjs/es-query`.
- Produces:
  - `interface EsHit<T> { _index: string; _id: string; _score: number | null; _source: T; sort?: unknown[]; highlight?: Record<string, string[]> }`
  - `interface EsTotal { value: number; relation: string }`
  - `interface EsSearchResponse<T> { took: number; timed_out: boolean; hits: { total: EsTotal; max_score: number | null; hits: EsHit<T>[] }; pit_id?: string }`
  - `interface EsSearchRequest { index?: string; body: EsSearchBody | Record<string, unknown> }`
  - `interface EsCountRequest { index?: string; body?: Record<string, unknown> }`
  - `interface SearchTransport { search<T>(req): Promise<EsSearchResponse<T>>; count(req): Promise<number>; msearch<T>(req: { body: unknown[] }): Promise<EsSearchResponse<T>[]>; openPit(req: { index: string; keepAlive: string }): Promise<string>; closePit(id: string): Promise<void> }`
  - `interface SearchResult<T> { total: number; hits: EsHit<T>[]; sources: T[] }`

- [ ] **Step 1: Write `types.ts`**

```ts
import type { EsSearchBody } from '@rfjs/es-query';

export interface EsHit<T = unknown> {
  _index: string;
  _id: string;
  _score: number | null;
  _source: T;
  sort?: unknown[];
  highlight?: Record<string, string[]>;
}

export interface EsTotal {
  value: number;
  relation: string;
}

export interface EsSearchResponse<T = unknown> {
  took: number;
  timed_out: boolean;
  hits: {
    total: EsTotal;
    max_score: number | null;
    hits: EsHit<T>[];
  };
  pit_id?: string;
}

export interface EsSearchRequest {
  index?: string;
  body: EsSearchBody | Record<string, unknown>;
}

export interface EsCountRequest {
  index?: string;
  body?: Record<string, unknown>;
}

export interface SearchTransport {
  search<T = unknown>(req: EsSearchRequest): Promise<EsSearchResponse<T>>;
  count(req: EsCountRequest): Promise<number>;
  msearch<T = unknown>(req: { body: unknown[] }): Promise<EsSearchResponse<T>[]>;
  openPit(req: { index: string; keepAlive: string }): Promise<string>;
  closePit(id: string): Promise<void>;
}

export interface SearchResult<T = unknown> {
  total: number;
  hits: EsHit<T>[];
  sources: T[];
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @rfjs/es-client typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/es-client/src/types.ts
git commit -m "feat(es-client): add transport and response types"
```

---

### Task 3: `search` / `count` / `msearch` wrappers

**Files:**
- Create: `packages/es-client/src/search.ts`
- Test: `packages/es-client/src/search.spec.ts`

**Interfaces:**
- Consumes: `SearchTransport`, `EsSearchRequest`, `EsCountRequest`, `EsSearchResponse`, `SearchResult` from `./types`.
- Produces:
  - `function search<T>(transport: SearchTransport, req: EsSearchRequest): Promise<SearchResult<T>>` — maps response to `{ total, hits, sources }`.
  - `function count(transport: SearchTransport, req: EsCountRequest): Promise<number>`.
  - `function msearch<T>(transport: SearchTransport, reqs: EsSearchRequest[]): Promise<SearchResult<T>[]>` — builds the NDJSON-style `[header, body, …]` array and maps each response.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { search, count, msearch } from './search';
import type { SearchTransport, EsSearchResponse } from './types';

function resp<T>(sources: T[]): EsSearchResponse<T> {
  return {
    took: 1,
    timed_out: false,
    hits: {
      total: { value: sources.length, relation: 'eq' },
      max_score: 1,
      hits: sources.map((s, i) => ({ _index: 'i', _id: String(i), _score: 1, _source: s })),
    },
  };
}

describe('search wrappers', () => {
  it('search → total/hits/sources', async () => {
    const transport = { search: vi.fn().mockResolvedValue(resp([{ a: 1 }, { a: 2 }])) } as unknown as SearchTransport;
    const r = await search<{ a: number }>(transport, { index: 'i', body: { query: { bool: {} } } as never });
    expect(r.total).toBe(2);
    expect(r.sources).toEqual([{ a: 1 }, { a: 2 }]);
    expect(r.hits).toHaveLength(2);
  });

  it('count → number', async () => {
    const transport = { count: vi.fn().mockResolvedValue(7) } as unknown as SearchTransport;
    expect(await count(transport, { index: 'i' })).toBe(7);
  });

  it('msearch builds header+body pairs and maps responses', async () => {
    const msearchFn = vi.fn().mockResolvedValue([resp([{ a: 1 }]), resp([{ a: 2 }])]);
    const transport = { msearch: msearchFn } as unknown as SearchTransport;
    const r = await msearch<{ a: number }>(transport, [
      { index: 'i1', body: { query: {} } as never },
      { index: 'i2', body: { query: {} } as never },
    ]);
    expect(msearchFn).toHaveBeenCalledWith({
      body: [{ index: 'i1' }, { query: {} }, { index: 'i2' }, { query: {} }],
    });
    expect(r.map((x) => x.sources)).toEqual([[{ a: 1 }], [{ a: 2 }]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/es-client vitest:run search`
Expected: FAIL — cannot find module `./search`.

- [ ] **Step 3: Write `search.ts`**

```ts
import type {
  EsCountRequest,
  EsSearchRequest,
  EsSearchResponse,
  SearchResult,
  SearchTransport,
} from './types';

function toResult<T>(res: EsSearchResponse<T>): SearchResult<T> {
  return {
    total: res.hits.total.value,
    hits: res.hits.hits,
    sources: res.hits.hits.map((h) => h._source),
  };
}

export async function search<T = unknown>(
  transport: SearchTransport,
  req: EsSearchRequest,
): Promise<SearchResult<T>> {
  return toResult(await transport.search<T>(req));
}

export async function count(
  transport: SearchTransport,
  req: EsCountRequest,
): Promise<number> {
  return transport.count(req);
}

export async function msearch<T = unknown>(
  transport: SearchTransport,
  reqs: EsSearchRequest[],
): Promise<SearchResult<T>[]> {
  const body: unknown[] = [];
  for (const r of reqs) {
    body.push(r.index ? { index: r.index } : {});
    body.push(r.body);
  }
  const responses = await transport.msearch<T>({ body });
  return responses.map(toResult);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/es-client vitest:run search`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/es-client/src/search.ts packages/es-client/src/search.spec.ts
git commit -m "feat(es-client): add search/count/msearch wrappers"
```

---

### Task 4: Highlight config + parse

**Files:**
- Create: `packages/es-client/src/highlight.ts`
- Test: `packages/es-client/src/highlight.spec.ts`

**Interfaces:**
- Consumes: `EsHit` from `./types`.
- Produces:
  - `interface HighlightOptions { fields: string[]; preTags?: string[]; postTags?: string[]; numberOfFragments?: number }`
  - `function buildHighlight(opts: HighlightOptions): { highlight: Record<string, unknown> }` — builds `{ highlight: { pre_tags, post_tags, fields: { [f]: { number_of_fragments } } } }`.
  - `function parseHighlight<T>(hit: EsHit<T>): Record<string, string[]>` — returns `hit.highlight ?? {}`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildHighlight, parseHighlight } from './highlight';
import type { EsHit } from './types';

describe('highlight', () => {
  it('buildHighlight with defaults', () => {
    expect(buildHighlight({ fields: ['title', 'body'] })).toEqual({
      highlight: {
        pre_tags: ['<em>'],
        post_tags: ['</em>'],
        fields: { title: { number_of_fragments: 0 }, body: { number_of_fragments: 0 } },
      },
    });
  });

  it('buildHighlight with custom tags and fragments', () => {
    expect(buildHighlight({ fields: ['t'], preTags: ['<c>'], postTags: ['</c>'], numberOfFragments: 3 })).toEqual({
      highlight: {
        pre_tags: ['<c>'],
        post_tags: ['</c>'],
        fields: { t: { number_of_fragments: 3 } },
      },
    });
  });

  it('parseHighlight returns the highlight map or empty', () => {
    const hit = { _index: 'i', _id: '1', _score: 1, _source: {}, highlight: { body: ['a <em>b</em>'] } } as EsHit;
    expect(parseHighlight(hit)).toEqual({ body: ['a <em>b</em>'] });
    expect(parseHighlight({ _index: 'i', _id: '1', _score: 1, _source: {} } as EsHit)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/es-client vitest:run highlight`
Expected: FAIL — cannot find module `./highlight`.

- [ ] **Step 3: Write `highlight.ts`**

```ts
import type { EsHit } from './types';

export interface HighlightOptions {
  fields: string[];
  preTags?: string[];
  postTags?: string[];
  numberOfFragments?: number;
}

export function buildHighlight(opts: HighlightOptions): {
  highlight: Record<string, unknown>;
} {
  const fragments = opts.numberOfFragments ?? 0;
  const fields: Record<string, { number_of_fragments: number }> = {};
  for (const f of opts.fields) {
    fields[f] = { number_of_fragments: fragments };
  }
  return {
    highlight: {
      pre_tags: opts.preTags ?? ['<em>'],
      post_tags: opts.postTags ?? ['</em>'],
      fields,
    },
  };
}

export function parseHighlight<T = unknown>(
  hit: EsHit<T>,
): Record<string, string[]> {
  return hit.highlight ?? {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/es-client vitest:run highlight`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/es-client/src/highlight.ts packages/es-client/src/highlight.spec.ts
git commit -m "feat(es-client): add generic highlight config and parser"
```

---

### Task 5: `paginateAll` (search_after + PIT)

**Files:**
- Create: `packages/es-client/src/paginate.ts`
- Test: `packages/es-client/src/paginate.spec.ts`

**Interfaces:**
- Consumes: `SearchTransport`, `EsHit` from `./types`.
- Produces:
  - `interface PaginateOptions { index: string; body: Record<string, unknown>; pageSize?: number; keepAlive?: string }`
  - `async function* paginateAll<T>(transport: SearchTransport, opts: PaginateOptions): AsyncGenerator<EsHit<T>[]>` — opens a PIT, repeatedly searches with `size`, `pit`, and `search_after` (the previous page's last `sort`), yields each non-empty page, stops when a page is smaller than `pageSize`, then closes the PIT (even on error).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { paginateAll } from './paginate';
import type { SearchTransport, EsHit, EsSearchResponse } from './types';

function page(ids: number[]): EsSearchResponse<{ n: number }> {
  return {
    took: 1,
    timed_out: false,
    hits: {
      total: { value: 0, relation: 'gte' },
      max_score: null,
      hits: ids.map((n) => ({ _index: 'i', _id: String(n), _score: null, _source: { n }, sort: [n] })),
    },
  };
}

describe('paginateAll', () => {
  it('walks pages via search_after until a short page, then closes the PIT', async () => {
    const openPit = vi.fn().mockResolvedValue('pit-1');
    const closePit = vi.fn().mockResolvedValue(undefined);
    const searchFn = vi
      .fn()
      .mockResolvedValueOnce(page([1, 2]))
      .mockResolvedValueOnce(page([3]));
    const transport = { openPit, closePit, search: searchFn } as unknown as SearchTransport;

    const batches: EsHit<{ n: number }>[][] = [];
    for await (const b of paginateAll<{ n: number }>(transport, { index: 'i', body: { query: { match_all: {} } }, pageSize: 2 })) {
      batches.push(b);
    }

    expect(batches.map((b) => b.map((h) => h._source.n))).toEqual([[1, 2], [3]]);
    expect(openPit).toHaveBeenCalledWith({ index: 'i', keepAlive: '1m' });
    // second search uses search_after from the last sort of page 1
    expect(searchFn.mock.calls[1][0].body.search_after).toEqual([2]);
    expect(closePit).toHaveBeenCalledWith('pit-1');
  });

  it('closes the PIT even when search throws', async () => {
    const closePit = vi.fn().mockResolvedValue(undefined);
    const transport = {
      openPit: vi.fn().mockResolvedValue('pit-err'),
      closePit,
      search: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as SearchTransport;

    await expect(async () => {
      for await (const _ of paginateAll(transport, { index: 'i', body: {} })) void _;
    }).rejects.toThrow('boom');
    expect(closePit).toHaveBeenCalledWith('pit-err');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/es-client vitest:run paginate`
Expected: FAIL — cannot find module `./paginate`.

- [ ] **Step 3: Write `paginate.ts`**

```ts
import type { EsHit, SearchTransport } from './types';

export interface PaginateOptions {
  index: string;
  body: Record<string, unknown>;
  pageSize?: number;
  keepAlive?: string;
}

export async function* paginateAll<T = unknown>(
  transport: SearchTransport,
  opts: PaginateOptions,
): AsyncGenerator<EsHit<T>[]> {
  const pageSize = opts.pageSize ?? 1000;
  const keepAlive = opts.keepAlive ?? '1m';
  const pit = await transport.openPit({ index: opts.index, keepAlive });
  try {
    let searchAfter: unknown[] | undefined;
    for (;;) {
      const body: Record<string, unknown> = {
        ...opts.body,
        size: pageSize,
        pit: { id: pit, keep_alive: keepAlive },
      };
      if (searchAfter) body.search_after = searchAfter;

      const res = await transport.search<T>({ body });
      const hits = res.hits.hits;
      if (hits.length > 0) yield hits;
      if (hits.length < pageSize) break;
      searchAfter = hits[hits.length - 1].sort;
      if (!searchAfter) break;
    }
  } finally {
    await transport.closePit(pit);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/es-client vitest:run paginate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/es-client/src/paginate.ts packages/es-client/src/paginate.spec.ts
git commit -m "feat(es-client): add paginateAll (search_after + PIT)"
```

---

### Task 6: Elasticsearch adapter

**Files:**
- Create: `packages/es-client/src/adapters/elasticsearch.ts`
- Test: `packages/es-client/src/adapters/elasticsearch.spec.ts`

**Interfaces:**
- Consumes: `SearchTransport` and request/response types from `../types`.
- Produces:
  - `interface ElasticClientLike { search(p): Promise<any>; count(p): Promise<{ count: number }>; msearch(p): Promise<{ responses: any[] }>; openPointInTime(p): Promise<{ id: string }>; closePointInTime(p): Promise<unknown> }`
  - `function fromElasticClient(client: ElasticClientLike): SearchTransport` — Elasticsearch v8 returns the body directly. `search({ index, body })` → `client.search({ index, ...body })`; `count` → `client.count({ index, ...body }).count`; `msearch({ body })` → `client.msearch({ searches: body }).responses`; `openPit` → `client.openPointInTime({ index, keep_alive }).id`; `closePit(id)` → `client.closePointInTime({ id })`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { fromElasticClient } from './elasticsearch';

describe('fromElasticClient', () => {
  it('search spreads body and returns the response directly', async () => {
    const search = vi.fn().mockResolvedValue({ took: 1, hits: { total: { value: 0, relation: 'eq' }, hits: [] } });
    const t = fromElasticClient({ search } as never);
    await t.search({ index: 'i', body: { query: { match_all: {} }, size: 5 } });
    expect(search).toHaveBeenCalledWith({ index: 'i', query: { match_all: {} }, size: 5 });
  });

  it('count returns the numeric count', async () => {
    const count = vi.fn().mockResolvedValue({ count: 9 });
    const t = fromElasticClient({ count } as never);
    expect(await t.count({ index: 'i' })).toBe(9);
  });

  it('openPit/closePit map to point-in-time API', async () => {
    const openPointInTime = vi.fn().mockResolvedValue({ id: 'pit-x' });
    const closePointInTime = vi.fn().mockResolvedValue({ succeeded: true });
    const t = fromElasticClient({ openPointInTime, closePointInTime } as never);
    expect(await t.openPit({ index: 'i', keepAlive: '1m' })).toBe('pit-x');
    expect(openPointInTime).toHaveBeenCalledWith({ index: 'i', keep_alive: '1m' });
    await t.closePit('pit-x');
    expect(closePointInTime).toHaveBeenCalledWith({ id: 'pit-x' });
  });

  it('msearch maps searches and returns responses', async () => {
    const msearch = vi.fn().mockResolvedValue({ responses: [{ hits: { total: { value: 0, relation: 'eq' }, hits: [] } }] });
    const t = fromElasticClient({ msearch } as never);
    const out = await t.msearch({ body: [{ index: 'i' }, { query: {} }] });
    expect(msearch).toHaveBeenCalledWith({ searches: [{ index: 'i' }, { query: {} }] });
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/es-client vitest:run adapters/elasticsearch`
Expected: FAIL — cannot find module `./elasticsearch`.

- [ ] **Step 3: Write `adapters/elasticsearch.ts`**

```ts
import type {
  EsCountRequest,
  EsSearchRequest,
  EsSearchResponse,
  SearchTransport,
} from '../types';

export interface ElasticClientLike {
  search(params: Record<string, unknown>): Promise<unknown>;
  count(params: Record<string, unknown>): Promise<{ count: number }>;
  msearch(params: Record<string, unknown>): Promise<{ responses: unknown[] }>;
  openPointInTime(params: Record<string, unknown>): Promise<{ id: string }>;
  closePointInTime(params: Record<string, unknown>): Promise<unknown>;
}

export function fromElasticClient(client: ElasticClientLike): SearchTransport {
  return {
    async search<T>(req: EsSearchRequest): Promise<EsSearchResponse<T>> {
      const { index, body } = req;
      const res = await client.search({ ...(index ? { index } : {}), ...body });
      return res as EsSearchResponse<T>;
    },
    async count(req: EsCountRequest): Promise<number> {
      const { index, body } = req;
      const res = await client.count({ ...(index ? { index } : {}), ...(body ?? {}) });
      return res.count;
    },
    async msearch<T>(req: { body: unknown[] }): Promise<EsSearchResponse<T>[]> {
      const res = await client.msearch({ searches: req.body });
      return res.responses as EsSearchResponse<T>[];
    },
    async openPit(req: { index: string; keepAlive: string }): Promise<string> {
      const res = await client.openPointInTime({ index: req.index, keep_alive: req.keepAlive });
      return res.id;
    },
    async closePit(id: string): Promise<void> {
      await client.closePointInTime({ id });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/es-client vitest:run adapters/elasticsearch`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/es-client/src/adapters/elasticsearch.ts packages/es-client/src/adapters/elasticsearch.spec.ts
git commit -m "feat(es-client): add Elasticsearch transport adapter"
```

---

### Task 7: OpenSearch adapter

**Files:**
- Create: `packages/es-client/src/adapters/opensearch.ts`
- Test: `packages/es-client/src/adapters/opensearch.spec.ts`

**Interfaces:**
- Consumes: `SearchTransport` and request/response types from `../types`.
- Produces:
  - `interface OpenSearchClientLike { search(p): Promise<{ body: any }>; count(p): Promise<{ body: { count: number } }>; msearch(p): Promise<{ body: { responses: any[] } }>; createPit(p): Promise<{ body: { pit_id: string } }>; deletePit(p): Promise<unknown> }`
  - `function fromOpenSearchClient(client: OpenSearchClientLike): SearchTransport` — OpenSearch returns `{ body }`. `search({ index, body })` → `client.search({ index, body }).body`; `count` → `.body.count`; `msearch({ body })` → `client.msearch({ body }).body.responses`; `openPit` → `client.createPit({ index, keep_alive }).body.pit_id`; `closePit(id)` → `client.deletePit({ body: { pit_id: [id] } })`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { fromOpenSearchClient } from './opensearch';

describe('fromOpenSearchClient', () => {
  it('search passes { index, body } and unwraps body', async () => {
    const search = vi.fn().mockResolvedValue({ body: { took: 1, hits: { total: { value: 0, relation: 'eq' }, hits: [] } } });
    const t = fromOpenSearchClient({ search } as never);
    const res = await t.search({ index: 'i', body: { query: { match_all: {} } } });
    expect(search).toHaveBeenCalledWith({ index: 'i', body: { query: { match_all: {} } } });
    expect(res.took).toBe(1);
  });

  it('count unwraps body.count', async () => {
    const count = vi.fn().mockResolvedValue({ body: { count: 4 } });
    const t = fromOpenSearchClient({ count } as never);
    expect(await t.count({ index: 'i' })).toBe(4);
  });

  it('openPit/closePit map to createPit/deletePit', async () => {
    const createPit = vi.fn().mockResolvedValue({ body: { pit_id: 'pid-1' } });
    const deletePit = vi.fn().mockResolvedValue({ body: {} });
    const t = fromOpenSearchClient({ createPit, deletePit } as never);
    expect(await t.openPit({ index: 'i', keepAlive: '2m' })).toBe('pid-1');
    expect(createPit).toHaveBeenCalledWith({ index: 'i', keep_alive: '2m' });
    await t.closePit('pid-1');
    expect(deletePit).toHaveBeenCalledWith({ body: { pit_id: ['pid-1'] } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/es-client vitest:run adapters/opensearch`
Expected: FAIL — cannot find module `./opensearch`.

- [ ] **Step 3: Write `adapters/opensearch.ts`**

```ts
import type {
  EsCountRequest,
  EsSearchRequest,
  EsSearchResponse,
  SearchTransport,
} from '../types';

export interface OpenSearchClientLike {
  search(params: Record<string, unknown>): Promise<{ body: unknown }>;
  count(params: Record<string, unknown>): Promise<{ body: { count: number } }>;
  msearch(params: Record<string, unknown>): Promise<{ body: { responses: unknown[] } }>;
  createPit(params: Record<string, unknown>): Promise<{ body: { pit_id: string } }>;
  deletePit(params: Record<string, unknown>): Promise<unknown>;
}

export function fromOpenSearchClient(client: OpenSearchClientLike): SearchTransport {
  return {
    async search<T>(req: EsSearchRequest): Promise<EsSearchResponse<T>> {
      const res = await client.search({ ...(req.index ? { index: req.index } : {}), body: req.body });
      return res.body as EsSearchResponse<T>;
    },
    async count(req: EsCountRequest): Promise<number> {
      const res = await client.count({ ...(req.index ? { index: req.index } : {}), ...(req.body ? { body: req.body } : {}) });
      return res.body.count;
    },
    async msearch<T>(req: { body: unknown[] }): Promise<EsSearchResponse<T>[]> {
      const res = await client.msearch({ body: req.body });
      return res.body.responses as EsSearchResponse<T>[];
    },
    async openPit(req: { index: string; keepAlive: string }): Promise<string> {
      const res = await client.createPit({ index: req.index, keep_alive: req.keepAlive });
      return res.body.pit_id;
    },
    async closePit(id: string): Promise<void> {
      await client.deletePit({ body: { pit_id: [id] } });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/es-client vitest:run adapters/opensearch`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/es-client/src/adapters/opensearch.ts packages/es-client/src/adapters/opensearch.spec.ts
git commit -m "feat(es-client): add OpenSearch transport adapter"
```

---

### Task 8: Barrels, build, README, changeset

**Files:**
- Create: `packages/es-client/src/adapters/index.ts`
- Modify: `packages/es-client/src/index.ts`
- Create: `packages/es-client/README.md`, `README.zh-TW.md`, `.changeset/es-client-initial.md`

**Interfaces:**
- Produces: public API (`search`/`count`/`msearch`, `buildHighlight`/`parseHighlight`, `paginateAll`, `fromElasticClient`/`fromOpenSearchClient`, all types) + a publishable build.

- [ ] **Step 1: Write `adapters/index.ts`**

```ts
export * from './elasticsearch';
export * from './opensearch';
```

- [ ] **Step 2: Write the root barrel**

Replace `packages/es-client/src/index.ts`:
```ts
export * from './types';
export * from './search';
export * from './highlight';
export * from './paginate';
export * from './adapters';
```

- [ ] **Step 3: Full suite + typecheck + build**

```bash
pnpm -F @rfjs/es-client vitest:run
pnpm -F @rfjs/es-client typecheck
pnpm -F @rfjs/es-client build
```
Expected: all tests PASS; typecheck clean; `dist/index.{js,mjs,d.ts}` produced.

- [ ] **Step 4: Write `README.md` (English, neutral)**

Cover: what it is (execution layer over `@rfjs/es-query`), install, the `SearchTransport` contract, wrapping a client with `fromElasticClient` / `fromOpenSearchClient`, `search`/`count`/`msearch`, `paginateAll` (search_after + PIT), and `buildHighlight`/`parseHighlight`. A worked example pairing `buildSearchBody` from `@rfjs/es-query` with `search`. No source-project references.

- [ ] **Step 5: Write `README.zh-TW.md`** — Traditional-Chinese translation, same examples, en/zh cross-links at top.

- [ ] **Step 6: Add changeset** `.changeset/es-client-initial.md`:
```markdown
---
'@rfjs/es-client': minor
---

Add `@rfjs/es-client` — a client-agnostic execution layer over `@rfjs/es-query`: `SearchTransport` contract, Elasticsearch/OpenSearch adapters, search/count/msearch wrappers, search_after + PIT pagination, and generic highlight helpers.
```

- [ ] **Step 7: Commit**

```bash
git add packages/es-client/src/index.ts packages/es-client/src/adapters/index.ts packages/es-client/README.md packages/es-client/README.zh-TW.md .changeset/es-client-initial.md
git commit -m "feat(es-client): export public API, add READMEs and changeset"
```

---

## Self-Review

**Spec coverage (§2.2, §6 of design):**
- `SearchTransport` + `fromElasticClient`/`fromOpenSearchClient` (no hard client dep) → Tasks 2, 6, 7. ✅
- D search/count/msearch wrappers → Task 3. ✅
- A search_after + PIT pagination → Task 5 (with PIT-close-on-error). ✅
- B generic highlight (config + parse, no VTT) → Task 4. ✅
- Docs en+zh neutral, changeset, subfolder layout, co-located specs → Task 8 + structure. ✅

**Placeholder scan:** none — every code/test step is complete.

**Type consistency:** `SearchTransport`/`EsSearchRequest`/`EsSearchResponse`/`EsHit`/`SearchResult` (Task 2) are used verbatim in Tasks 3–7. `openPit`/`closePit` names match between transport (Task 2), paginate (Task 5), and both adapters (Tasks 6, 7). `fromElasticClient`/`fromOpenSearchClient` names match Task 8 barrel. ✅

---

## Follow-on plans (not in this plan)

1. **filter-builder engine** — register `getEngine('es-query')`; declare ES operators via `arity.ts`/`operators()`.
2. **apps/web tool** — `src/tools/es-query/` interactive demo + en/zh i18n; register both packages in `packageRegistry`.
