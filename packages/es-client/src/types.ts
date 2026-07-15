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
