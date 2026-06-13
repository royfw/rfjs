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
  type JsonbQueryDialect,
  type RenderContext,
  assertCondition,
  isFilterGroup,
  legacyDialect,
  jsonpathDialect,
} from './dialect';
import { renderObjectCondition } from './object-condition';
import { JsonbQueryError } from './errors';

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
): string {
  assertCondition(node);
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
): string {
  const parts = group.filters
    .map((node) =>
      isFilterGroup(node)
        ? wrap(buildGroup(node, column, dialect, ctx))
        : renderCondition(node, column, dialect, ctx),
    )
    .filter((sql) => sql.length > 0);
  return joinLogic(parts, group.logic);
}

const EMPTY_GROUP_IDENTITY: Record<JsonbFilterGroup['logic'], string> = {
  and: 'true',
  or: 'false',
  not: 'false', // not(AND of nothing) = not(true)
  nor: 'true', // not(OR of nothing) = not(false)
};

/** Join rendered parts per group logic; `not`/`nor` negate the joined result. */
function joinLogic(parts: string[], logic: JsonbFilterGroup['logic']): string {
  if (parts.length === 0) {
    return EMPTY_GROUP_IDENTITY[logic];
  }
  const joined = parts.join(logic === 'or' || logic === 'nor' ? ' or ' : ' and ');
  return logic === 'not' || logic === 'nor' ? `not (${joined})` : joined;
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
    throw new JsonbQueryError(`Unknown JSONB dialect: "${dialectName}"`, 'INVALID_DIALECT');
  }
  const params = new ParamBuilder(options.paramOffset ?? 0);
  let aliasCount = 0;
  const ctx: RenderContext = {
    params,
    nextAlias: () => {
      aliasCount += 1;
      return `e${aliasCount}`;
    },
    renderGroup: (group, col) => buildGroup(group, col, dialect, ctx),
  };
  const where = buildGroup(filter, quoted, dialect, ctx);
  return { where, values: params.values, from: [] };
}
