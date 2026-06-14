import { ParamBuilder } from './param-builder';
import type { FilterGroup, LogicalOperator } from './types';

const EMPTY_GROUP_IDENTITY: Record<LogicalOperator, string> = {
  and: 'true',
  or: 'false',
  not: 'false', // not(AND of nothing) = not(true)
  nor: 'true', // not(OR of nothing) = not(false)
};

function isFilterGroup<L>(node: L | FilterGroup<L>): node is FilterGroup<L> {
  return (
    typeof node === 'object' &&
    node !== null &&
    'logic' in node &&
    'filters' in node &&
    Array.isArray((node as { filters: unknown }).filters)
  );
}

function joinLogic(parts: string[], logic: LogicalOperator): string {
  if (parts.length === 0) return EMPTY_GROUP_IDENTITY[logic];
  const joined = parts.join(logic === 'or' || logic === 'nor' ? ' or ' : ' and ');
  return logic === 'not' || logic === 'nor' ? `not (${joined})` : joined;
}

function wrap(sql: string): string {
  return sql.length > 0 ? `(${sql})` : '';
}

/**
 * Render a nested filter group to a parameterized SQL boolean expression.
 * Leaf rendering is delegated to `renderLeaf`, making the engine independent of
 * what a leaf is (column condition, jsonb condition, etc.).
 */
export function buildFilterGroup<L>(
  group: FilterGroup<L>,
  renderLeaf: (leaf: L, params: ParamBuilder) => string,
  params: ParamBuilder,
): string {
  const parts = group.filters
    .map((node) =>
      isFilterGroup(node)
        ? wrap(buildFilterGroup(node, renderLeaf, params))
        : renderLeaf(node, params),
    )
    .filter((sql) => sql.length > 0);
  return joinLogic(parts, group.logic);
}
