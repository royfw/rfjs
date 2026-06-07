import type {
  JsonbCondition,
  JsonbDialect,
  JsonbElemMatchCondition,
  JsonbFilterGroup,
  JsonbQueryResult,
  BuildJsonbOptions,
} from './types';
import { ParamBuilder } from './param-builder';
import { quoteJsonbColumn } from './column';
import {
  type ConditionScope,
  type JsonbQueryDialect,
  type RenderContext,
  assertCondition,
  isFilterGroup,
} from './dialect';
import { renderObjectCondition } from './object-condition';
import { legacyDialect } from './dialect-legacy';
import { jsonpathDialect } from './dialect-jsonpath';

const DIALECTS = {
  legacy: legacyDialect,
  jsonpath: jsonpathDialect,
} satisfies Record<JsonbDialect, JsonbQueryDialect>;

function isElemMatch(node: JsonbCondition): node is JsonbElemMatchCondition {
  return node.dataType === 'array' && node.elementType === 'object';
}

function renderCondition(
  node: JsonbCondition,
  column: string,
  dialect: JsonbQueryDialect,
  ctx: RenderContext,
  scope: ConditionScope,
): string {
  assertCondition(node, scope);
  if (isElemMatch(node)) {
    return dialect.renderElemMatch(column, node, ctx);
  }
  if (node.dataType === 'object') {
    return renderObjectCondition(column, node, ctx.params);
  }
  if (node.dataType === 'array') {
    return dialect.renderArray(column, node, ctx);
  }
  return dialect.render(column, node.field, node.dataType, node.operator, node.value, ctx.params);
}

function buildGroup(
  group: JsonbFilterGroup,
  column: string,
  dialect: JsonbQueryDialect,
  ctx: RenderContext,
  scope: ConditionScope,
): string {
  const parts = group.filters
    .map((node) =>
      isFilterGroup(node)
        ? wrap(buildGroup(node, column, dialect, ctx, scope))
        : renderCondition(node, column, dialect, ctx, scope),
    )
    .filter((sql) => sql.length > 0);
  return parts.join(group.logic === 'or' ? ' or ' : ' and ');
}

function wrap(sql: string): string {
  return sql.length > 0 ? `(${sql})` : '';
}

export function buildJsonbQuery(
  column: string,
  filter: JsonbFilterGroup,
  options: BuildJsonbOptions = {},
): JsonbQueryResult {
  const quoted = quoteJsonbColumn(column);
  const dialectName = options.dialect ?? 'legacy';
  const dialect = DIALECTS[dialectName];
  if (!dialect) {
    throw new Error(`Unknown JSONB dialect: "${dialectName}"`);
  }
  const params = new ParamBuilder(options.paramOffset ?? 0);
  let aliasCount = 0;
  const ctx: RenderContext = {
    params,
    nextAlias: () => {
      aliasCount += 1;
      return `e${aliasCount}`;
    },
    renderGroup: (group, col) => buildGroup(group, col, dialect, ctx, 'elemmatch'),
  };
  const where = buildGroup(filter, quoted, dialect, ctx, 'root');
  return { where, values: params.values, from: [] };
}
