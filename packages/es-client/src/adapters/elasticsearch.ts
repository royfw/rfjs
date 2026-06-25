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
