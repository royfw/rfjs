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
