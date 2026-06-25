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
