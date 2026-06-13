import type { JsonbScalarType } from './types';
import { ParamBuilder } from './param-builder';
import { quoteJsonbColumn } from './column';
import { fieldSegments, SCALAR_CASTS } from './dialect';
import { JsonbQueryError } from './errors';
import { positionalToNamed } from './named-params';

export type JsonbSortDirection = 'asc' | 'desc';
export type JsonbNullsOrder = 'first' | 'last';

export interface JsonbSortSpec {
  field: string;
  /** Only scalar types are orderable. */
  dataType: JsonbScalarType;
  /** Default 'asc'. */
  direction?: JsonbSortDirection;
  /** Omit to use PostgreSQL's default (NULLS LAST for asc, NULLS FIRST for desc). */
  nulls?: JsonbNullsOrder;
}

export interface JsonbOrderByResult {
  orderBy: string;
  values: unknown[];
}

export interface BuildJsonbOrderByOptions {
  paramOffset?: number;
}

function renderSort(quoted: string, spec: JsonbSortSpec, params: ParamBuilder): string {
  const cast = SCALAR_CASTS[spec.dataType];
  if (cast === undefined) {
    throw new JsonbQueryError(`Invalid sort dataType: ${JSON.stringify(spec.dataType)}`, 'INVALID_SORT');
  }
  const direction = spec.direction ?? 'asc';
  if (direction !== 'asc' && direction !== 'desc') {
    throw new JsonbQueryError(`Invalid sort direction: ${JSON.stringify(direction)}`, 'INVALID_SORT');
  }
  let sql = `(${quoted} #>> ${params.add(fieldSegments(spec.field))})${cast} ${direction}`;
  if (spec.nulls !== undefined) {
    if (spec.nulls !== 'first' && spec.nulls !== 'last') {
      throw new JsonbQueryError(`Invalid sort nulls: ${JSON.stringify(spec.nulls)}`, 'INVALID_SORT');
    }
    sql += ` nulls ${spec.nulls}`;
  }
  return sql;
}

/**
 * Build a parameterized ORDER BY fragment from sort metadata. Dialect-
 * independent (ordering always extracts a scalar via `#>>` + cast). Empty
 * `sorts` yields an empty fragment. Use `paramOffset` to compose after a WHERE.
 */
export function buildJsonbOrderBy(
  column: string,
  sorts: JsonbSortSpec[],
  options: BuildJsonbOrderByOptions = {},
): JsonbOrderByResult {
  const quoted = quoteJsonbColumn(column);
  const params = new ParamBuilder(options.paramOffset ?? 0);
  const orderBy = sorts.map((spec) => renderSort(quoted, spec, params)).join(', ');
  return { orderBy, values: params.values };
}

export interface BuildNamedJsonbOrderByOptions extends BuildJsonbOrderByOptions {
  /** Named-parameter prefix (default "p"): `:p1`, `:p2`, … */
  prefix?: string;
}

export interface NamedOrderByResult {
  orderBy: string;
  params: Record<string, unknown>;
}

/**
 * Named-parameter variant for query layers with named bindings (TypeORM
 * QueryBuilder, Knex). `paramOffset` shifts the parameter *names* (`:p5`, …).
 */
export function buildNamedJsonbOrderBy(
  column: string,
  sorts: JsonbSortSpec[],
  options: BuildNamedJsonbOrderByOptions = {},
): NamedOrderByResult {
  const { prefix, ...buildOptions } = options;
  const { orderBy, values } = buildJsonbOrderBy(column, sorts, buildOptions);
  const { sql, params } = positionalToNamed(orderBy, values, prefix ?? 'p');
  return { orderBy: sql, params };
}
