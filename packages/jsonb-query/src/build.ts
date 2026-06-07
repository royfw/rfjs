import type {
  JsonbCondition,
  JsonbDialect,
  JsonbFilterGroup,
  JsonbQueryResult,
  BuildJsonbOptions,
} from './types';
import { ParamBuilder } from './param-builder';
import { quoteJsonbColumn } from './column';
import type { JsonbQueryDialect } from './dialect';
import { assertOperatorForType, isFilterGroup } from './dialect';
import { legacyDialect } from './dialect-legacy';
import { jsonpathDialect } from './dialect-jsonpath';

const DIALECTS = {
  legacy: legacyDialect,
  jsonpath: jsonpathDialect,
} satisfies Record<JsonbDialect, JsonbQueryDialect>;

function renderCondition(
  node: JsonbCondition,
  column: string,
  dialect: JsonbQueryDialect,
  params: ParamBuilder,
): string {
  if (node.dataType === 'object' || node.dataType === 'array') {
    // Object / scalar-array / elemmatch rendering lands in later tasks; until
    // then reject them explicitly rather than mis-render them as scalars.
    throw new Error(
      `dataType "${node.dataType}" is not yet supported by buildJsonbQuery`,
    );
  }
  assertOperatorForType(node.dataType, node.operator);
  return dialect.render(column, node.field, node.dataType, node.operator, node.value, params);
}

function buildGroup(
  group: JsonbFilterGroup,
  column: string,
  dialect: JsonbQueryDialect,
  params: ParamBuilder,
): string {
  const parts = group.filters
    .map((node) =>
      isFilterGroup(node)
        ? wrap(buildGroup(node, column, dialect, params))
        : renderCondition(node, column, dialect, params),
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
  const where = buildGroup(filter, quoted, dialect, params);
  return { where, values: params.values, from: [] };
}
