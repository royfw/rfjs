import { buildFilterGroup, makeColumnLeafRenderer, ParamBuilder } from '@rfjs/sql-filter';
import type { ColumnCondition } from '@rfjs/sql-filter';
import { buildJsonbQuery } from '@rfjs/jsonb-query';
import type { JsonbCondition } from '@rfjs/jsonb-query';
import { PgFilterError } from './errors';
import type { PgFilterConfig, PgFilterGroup, PgLeaf } from './types';

export function buildPgWhere(
  config: PgFilterConfig,
  group: PgFilterGroup,
  paramOffset = 0,
): { where: string; values: unknown[] } {
  const params = new ParamBuilder(paramOffset);
  const columnRenderer = makeColumnLeafRenderer(config.columns);

  const renderLeaf = (leaf: PgLeaf, p: ParamBuilder): string => {
    if (leaf.target === 'column') {
      const cond: ColumnCondition = { column: leaf.column, operator: leaf.operator, value: leaf.value };
      return columnRenderer(cond, p);
    }
    if (leaf.target === 'jsonb') {
      const absOffset = paramOffset + p.values.length;
      const cond = {
        field: leaf.field,
        dataType: leaf.dataType,
        operator: leaf.operator,
        ...(leaf.value !== undefined ? { value: leaf.value } : {}),
        ...(leaf.elementType !== undefined ? { elementType: leaf.elementType } : {}),
        ...(leaf.filters !== undefined ? { filters: leaf.filters } : {}),
      } as unknown as JsonbCondition;
      const { where, values } = buildJsonbQuery(
        config.jsonb.column,
        { logic: 'and', filters: [cond] },
        { dialect: config.jsonb.dialect, paramOffset: absOffset },
      );
      for (const v of values) p.add(v);
      return where;
    }
    throw new PgFilterError(
      `Unknown leaf target: ${JSON.stringify((leaf as { target: unknown }).target)}`,
      'INVALID_TARGET',
    );
  };

  const where = buildFilterGroup(group, renderLeaf, params);
  return { where, values: params.values };
}
