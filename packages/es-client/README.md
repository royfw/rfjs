# @rfjs/es-client

> [English](./README.md) · [繁體中文](./README.zh-TW.md)

A **client-agnostic execution layer** over [`@rfjs/es-query`](../es-query). It never imports
a concrete Elasticsearch / OpenSearch client — instead you wrap your own client into a
`SearchTransport`, and the package builds `search` / `count` / `msearch`, deep pagination
(`search_after` + Point-In-Time), and generic highlight helpers on top of it.

Works with **Elasticsearch (8.x / 9.x)** and **OpenSearch (2.x / 3.x)**.

## Install

```bash
pnpm add @rfjs/es-client @rfjs/es-query
# bring your own client, e.g. @elastic/elasticsearch or @opensearch-project/opensearch
```

## Wrap a client

```ts
import { Client } from '@elastic/elasticsearch';
import { fromElasticClient } from '@rfjs/es-client';

const transport = fromElasticClient(new Client({ node: 'http://localhost:9200' }));
```

```ts
import { Client } from '@opensearch-project/opensearch';
import { fromOpenSearchClient } from '@rfjs/es-client';

const transport = fromOpenSearchClient(new Client({ node: 'http://localhost:9200' }));
```

Both return the same `SearchTransport`, so everything below is identical regardless of target.
The adapters normalize the two clients' response shapes (Elasticsearch returns the body
directly; OpenSearch returns `{ body }`) and their Point-In-Time APIs.

## Search / count / msearch

Pair with `buildSearchBody` from `@rfjs/es-query`:

```ts
import { buildSearchBody } from '@rfjs/es-query';
import { search } from '@rfjs/es-client';

const body = buildSearchBody(
  { logic: 'and', filters: [{ field: 'status', condition: 'eq', value: 'open' }] },
  { size: 20, sort: [{ field: 'createdAt', order: 'desc' }] },
);

const { total, hits, sources } = await search<{ id: string }>(transport, { index: 'tickets', body });
```

`count(transport, { index, body })` returns a number; `msearch(transport, requests)` returns
one result per request.

## Deep pagination (`search_after` + PIT)

`paginateAll` opens a Point-In-Time, walks every matching document in batches using
`search_after`, and closes the PIT when done (even on error). Your `body` should include a
`sort` so each hit carries `sort` values for the cursor.

```ts
import { paginateAll } from '@rfjs/es-client';

for await (const batch of paginateAll<{ id: string }>(transport, {
  index: 'tickets',
  body: { query: { match_all: {} }, sort: [{ createdAt: { order: 'asc' } }, { _id: 'asc' }] },
  pageSize: 1000,
})) {
  // process up to 1000 hits per batch
}
```

## Highlight

```ts
import { buildHighlight, parseHighlight } from '@rfjs/es-client';

const body = { query: { match: { body: 'refund' } }, ...buildHighlight({ fields: ['body'] }) };
const { hits } = await search(transport, { index: 'tickets', body });
const snippets = parseHighlight(hits[0]); // { body: ['… <em>refund</em> …'] }
```

## `SearchTransport`

If you target a different runtime (a proxy, a serverless function, raw HTTP), implement the
contract directly:

```ts
interface SearchTransport {
  search<T>(req): Promise<EsSearchResponse<T>>;
  count(req): Promise<number>;
  msearch<T>(req): Promise<EsSearchResponse<T>[]>;
  openPit(req): Promise<string>;
  closePit(id): Promise<void>;
}
```

## License

ISC
