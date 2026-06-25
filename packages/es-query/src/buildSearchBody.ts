import { buildEsQuery, type BuildEsQueryOptions } from './buildEsQuery';
import type {
  EsClause,
  EsFilterMetadata,
  EsSearchBody,
  EsSortField,
  ValueType,
} from './types';

export interface BuildSearchBodyOptions extends BuildEsQueryOptions {
  sort?: EsSortField[];
  size?: number;
  from?: number;
  searchAfter?: ValueType[];
}

export function buildSearchBody(
  metadata: EsFilterMetadata,
  opts: BuildSearchBodyOptions = {},
): EsSearchBody {
  const body: EsSearchBody = { query: buildEsQuery(metadata, opts) };

  if (opts.sort?.length) {
    body.sort = opts.sort.map(
      (s): EsClause => ({ [s.field]: { order: s.order } }),
    );
  }
  if (opts.size !== undefined) body.size = opts.size;
  if (opts.from !== undefined) body.from = opts.from;
  if (opts.searchAfter !== undefined) body.search_after = opts.searchAfter;

  return body;
}
