import { ColumnQueryError } from '../errors';
import type { ColumnConfig } from './config';
import { quoteIdent } from './ident';

export type ColumnSortSpec = {
  column: string;
  direction?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
};

export function buildColumnOrderBy(
  config: ColumnConfig,
  sorts: ColumnSortSpec[],
): { orderBy: string; values: unknown[] } {
  const parts = sorts.map((spec) => {
    const def = config[spec.column];
    if (!def) {
      throw new ColumnQueryError(`Unknown column: ${JSON.stringify(spec.column)}`, 'UNKNOWN_COLUMN');
    }
    const direction = spec.direction ?? 'asc';
    if (direction !== 'asc' && direction !== 'desc') {
      throw new ColumnQueryError(`Invalid sort direction: ${JSON.stringify(direction)}`, 'INVALID_SORT');
    }
    let sql = `${quoteIdent(def.column)} ${direction}`;
    if (spec.nulls !== undefined) {
      if (spec.nulls !== 'first' && spec.nulls !== 'last') {
        throw new ColumnQueryError(`Invalid sort nulls: ${JSON.stringify(spec.nulls)}`, 'INVALID_SORT');
      }
      sql += ` nulls ${spec.nulls}`;
    }
    return sql;
  });
  return { orderBy: parts.join(', '), values: [] };
}
