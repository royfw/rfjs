# @rfjs/es-client

> [English](./README.md) · [繁體中文](./README.zh-TW.md)

建構在 [`@rfjs/es-query`](../es-query) 之上、**與 client 無關**的執行層。它不直接 import 任何
Elasticsearch / OpenSearch client —— 你把自己的 client 包成一個 `SearchTransport`，本套件就在
其上提供 `search` / `count` / `msearch`、深分頁（`search_after` + Point-In-Time），以及通用
highlight 工具。

支援 **Elasticsearch（8.x / 9.x）**與 **OpenSearch（2.x / 3.x）**。

## 安裝

```bash
pnpm add @rfjs/es-client @rfjs/es-query
# 自備 client，例如 @elastic/elasticsearch 或 @opensearch-project/opensearch
```

## 包裝 client

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

兩者都回傳相同的 `SearchTransport`，所以下面的用法不論目標都一致。adapter 會把兩個 client 的回應
形狀（Elasticsearch 直接回 body；OpenSearch 回 `{ body }`）與各自的 Point-In-Time API 正規化。

## Search / count / msearch

搭配 `@rfjs/es-query` 的 `buildSearchBody`：

```ts
import { buildSearchBody } from '@rfjs/es-query';
import { search } from '@rfjs/es-client';

const body = buildSearchBody(
  { logic: 'and', filters: [{ field: 'status', condition: 'eq', value: 'open' }] },
  { size: 20, sort: [{ field: 'createdAt', order: 'desc' }] },
);

const { total, hits, sources } = await search<{ id: string }>(transport, { index: 'tickets', body });
```

`count(transport, { index, body })` 回傳數字；`msearch(transport, requests)` 每個請求回傳一個結果。

## 深分頁（`search_after` + PIT）

`paginateAll` 開一個 Point-In-Time，用 `search_after` 分批走過所有符合的文件，完成時關閉 PIT
（即使發生錯誤也會關閉）。你的 `body` 應包含 `sort`，這樣每筆 hit 才會帶 `sort` 值作為游標。

```ts
import { paginateAll } from '@rfjs/es-client';

for await (const batch of paginateAll<{ id: string }>(transport, {
  index: 'tickets',
  body: { query: { match_all: {} }, sort: [{ createdAt: { order: 'asc' } }, { _id: 'asc' }] },
  pageSize: 1000,
})) {
  // 每批最多處理 1000 筆 hit
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

若你的目標是其他執行環境（proxy、serverless function、原始 HTTP），可直接實作此契約：

```ts
interface SearchTransport {
  search<T>(req): Promise<EsSearchResponse<T>>;
  count(req): Promise<number>;
  msearch<T>(req): Promise<EsSearchResponse<T>[]>;
  openPit(req): Promise<string>;
  closePit(id): Promise<void>;
}
```

## 授權

ISC
