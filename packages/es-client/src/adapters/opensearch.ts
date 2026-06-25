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
