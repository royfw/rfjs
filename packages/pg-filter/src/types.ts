import type { FilterGroup, ColumnType, ColumnOperator } from '@rfjs/sql-filter';
import type { JsonbDataType, JsonbScalarType, JsonbDialect, JsonbFilterGroup } from '@rfjs/jsonb-query';

export interface PgColumnLeaf {
  target: 'column';
  column: string; // key of config.columns
  operator: ColumnOperator;
  value?: unknown;
}

export interface PgJsonbLeaf {
  target: 'jsonb'; // leaf kind, not a column name (jsonb column is config.jsonb.column)
  field: string;
  dataType: JsonbDataType;
  operator: string; // deep-validated by jsonb-query
  value?: unknown;
  elementType?: JsonbScalarType | 'object';
  filters?: JsonbFilterGroup; // per-element group for elemmatch
}

export type PgLeaf = PgColumnLeaf | PgJsonbLeaf;
export type PgFilterGroup = FilterGroup<PgLeaf>;

export interface PgColumnSort {
  target: 'column';
  column: string;
  direction?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

export interface PgJsonbSort {
  target: 'jsonb';
  field: string;
  dataType: JsonbScalarType; // only scalars are orderable
  direction?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

export type PgSort = PgColumnSort | PgJsonbSort;

export interface PgFilterConfig {
  columns: Record<string, { column: string; type: ColumnType }>;
  jsonb: { column: string; dialect?: JsonbDialect };
}

export interface PgFilterInput {
  filter?: PgFilterGroup;
  sort?: PgSort[];
  page?: number; // 1-based; default 1
  pageSize?: number; // omit → no LIMIT
}

export interface PgFilterResult {
  where: string; // never empty; 'true' when no filter
  orderBy: string; // '' when no sort
  limit?: number;
  offset?: number;
  values: unknown[]; // main query: WHERE params ++ ORDER BY params
  countValues: unknown[]; // COUNT query: WHERE params only (prefix of values)
}
