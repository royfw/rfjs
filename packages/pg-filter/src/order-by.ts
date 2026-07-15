import { buildColumnOrderBy } from '@rfjs/sql-filter';
import type { ColumnSortSpec } from '@rfjs/sql-filter';
import { buildJsonbOrderBy } from '@rfjs/jsonb-query';
import type { JsonbSortSpec } from '@rfjs/jsonb-query';
import { PgFilterError } from './errors';
import type { PgFilterConfig, PgSort } from './types';

export function buildPgOrderBy(
  config: PgFilterConfig,
  sorts: PgSort[],
  paramOffset = 0,
): { orderBy: string; values: unknown[] } {
  const fragments: string[] = [];
  const values: unknown[] = [];

  for (const sort of sorts) {
    if (sort.target === 'column') {
      const spec: ColumnSortSpec = { column: sort.column, direction: sort.direction, nulls: sort.nulls };
      fragments.push(buildColumnOrderBy(config.columns, [spec]).orderBy);
    } else if (sort.target === 'jsonb') {
      const spec: JsonbSortSpec = { field: sort.field, dataType: sort.dataType, direction: sort.direction, nulls: sort.nulls };
      const res = buildJsonbOrderBy(config.jsonb.column, [spec], { paramOffset: paramOffset + values.length });
      fragments.push(res.orderBy);
      values.push(...res.values);
    } else {
      throw new PgFilterError(
        `Unknown sort target: ${JSON.stringify((sort as { target: unknown }).target)}`,
        'INVALID_TARGET',
      );
    }
  }

  return { orderBy: fragments.join(', '), values };
}
