import { buildPgWhere } from './filter';
import { buildPgOrderBy } from './order-by';
import { computeLimitOffset } from './pagination';
import type { PgFilterConfig, PgFilterGroup, PgFilterInput, PgFilterResult } from './types';

const MATCH_ALL: PgFilterGroup = { logic: 'and', filters: [] };

export function buildPgFilter(config: PgFilterConfig, input: PgFilterInput): PgFilterResult {
  const { where, values: whereValues } = buildPgWhere(config, input.filter ?? MATCH_ALL, 0);
  const { orderBy, values: orderByValues } = buildPgOrderBy(config, input.sort ?? [], whereValues.length);
  const { limit, offset } = computeLimitOffset({ page: input.page, pageSize: input.pageSize });
  return {
    where,
    orderBy,
    limit,
    offset,
    values: [...whereValues, ...orderByValues],
    countValues: whereValues,
  };
}
