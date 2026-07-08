import type { BuiltRequest, RequestMeta, ResponseMeta } from '@rfjs/data-schema';

// Data-source injection (design spec §5.1): 'rows' is a static array sorted/paginated client-side;
// 'remote' hands the transport a `fetch` wrapper so tool pages can pass a fake fetcher while a real
// app passes a real one.
export type TableSource =
  | { kind: 'rows'; rows: Record<string, unknown>[] }
  | {
      kind: 'remote';
      request: RequestMeta;
      response: ResponseMeta;
      fetch: (built: BuiltRequest) => Promise<unknown>;
    };

// Optional labels (design spec §5.3): unlike filter-builder-ui's labels-as-props convention, this
// package ships English defaults so a result-item-embedded table doesn't have to carry a full
// copy deck.
export interface TableLabels {
  empty: string;
  loading: string;
  error: string;
  retry: string;
  prev: string;
  next: string;
  pageOf: string; // 'Page {page} of {count}'
  total: string; // '{total} rows'
  pageSize: string;
}
