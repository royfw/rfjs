import { compile, isExpression, stripExpressionPrefix } from '@rfjs/data-expr';
import type { CompiledExpr, ExprOptions } from '@rfjs/data-expr';
import { createMatchQuery, logicMatchQuery } from './matchQuery';
import type { FilterMatchQuery, MatchQueryMetadata, ObjectData } from '../types';

/** Synthetic path under which a computed "="-field value is fed to the matchers. */
const EXPR_FIELD = '__expr__';

export type CompiledMatchQuery = (data: ObjectData) => Promise<boolean>;

/**
 * Compile a filter tree once: every "="-expression is parsed a single time
 * (data-expr compile-once contract); plain conditions reuse the sync matcher
 * machinery per row. Throws DataExprError(kind 'compile') immediately on a
 * malformed expression. NOTE: "=" inside elemmatch sub-filters is unsupported
 * (they evaluate through the sync matcher, whose guard throws).
 */
export function compileMatchQuery(
  filterQuery: FilterMatchQuery,
  options?: ExprOptions,
): CompiledMatchQuery {
  const children = filterQuery.filters.map((node) =>
    'logic' in node
      ? compileMatchQuery(node, options)
      : compileCondition(node, options),
  );
  return async (data) => {
    const results: boolean[] = [];
    for (const child of children) {
      results.push(await child(data));
    }
    return logicMatchQuery(filterQuery.logic, results);
  };
}

/** One-shot convenience: compile + evaluate once. Prefer compileMatchQuery for row loops. */
export async function matchQueryAsync(
  data: ObjectData,
  filterQuery: FilterMatchQuery,
  options?: ExprOptions,
): Promise<boolean> {
  return compileMatchQuery(filterQuery, options)(data);
}

function compileCondition(
  metadata: MatchQueryMetadata,
  options?: ExprOptions,
): CompiledMatchQuery {
  const rawValue = (metadata as { value?: unknown }).value;
  const fieldExpr: CompiledExpr | null = isExpression(metadata.field)
    ? compile(stripExpressionPrefix(metadata.field), options)
    : null;
  const valueExpr: CompiledExpr | null =
    typeof rawValue === 'string' && isExpression(rawValue)
      ? compile(stripExpressionPrefix(rawValue), options)
      : null;

  if (!fieldExpr && !valueExpr) {
    return (data) => Promise.resolve(createMatchQuery(data, metadata).isMatch);
  }

  return async (data) => {
    // Computed results replace the slot before the (sync) matcher runs; the
    // casts are unavoidable — expression results are only known at runtime.
    const value = valueExpr ? await valueExpr.evaluate(data) : rawValue;
    if (fieldExpr) {
      const target = await fieldExpr.evaluate(data);
      const synthetic = { [EXPR_FIELD]: target } as ObjectData;
      const substituted = { ...metadata, field: EXPR_FIELD, value } as MatchQueryMetadata;
      return createMatchQuery(synthetic, substituted).isMatch;
    }
    const substituted = { ...metadata, value } as MatchQueryMetadata;
    return createMatchQuery(data, substituted).isMatch;
  };
}
