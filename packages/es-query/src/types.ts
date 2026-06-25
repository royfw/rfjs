import type { DataType, ValueType } from '@rfjs/data-transform';

export type { ValueType };

export type EsDialect = 'elasticsearch' | 'opensearch';

export type EsFieldType = 'keyword' | 'text' | 'date' | 'number' | 'boolean';

export type EsConditionType =
  | 'eq' | 'neq' | 'in' | 'notIn'
  | 'lt' | 'lte' | 'gt' | 'gte' | 'between'
  | 'contains' | 'startsWith' | 'endsWith'
  | 'exists' | 'isNull'
  | 'match' | 'matchPhrase' | 'multiMatch' | 'combinedFields'
  | 'fuzzy' | 'regex';

export type EsLogicalOperator = 'and' | 'or' | 'not' | 'nor';

export interface EsFieldCondition {
  field: string;
  condition: EsConditionType;
  /** keyword/text drives term-vs-match; optional, conservative default applies. */
  fieldType?: EsFieldType;
  /** value coercion type for @rfjs/data-transform; defaults to 'any'. */
  dataType?: DataType;
  value: ValueType | ValueType[];
  /** target fields for multiMatch / combinedFields. */
  fields?: string[];
}

export interface EsFilterMetadata {
  logic: EsLogicalOperator;
  filters: Array<EsFieldCondition | EsFilterMetadata>;
}

export type EsClause = Record<string, unknown>;

/** A node inside a bool bucket: a leaf clause or a nested bool query. */
export type EsQueryClause = EsClause | EsBoolQuery;

export interface EsBoolQuery {
  bool: {
    must?: EsQueryClause[];
    should?: EsQueryClause[];
    must_not?: EsQueryClause[];
    minimum_should_match?: number;
  };
}

export interface EsSortField {
  field: string;
  order: 'asc' | 'desc';
}

export interface EsSearchBody {
  query: EsBoolQuery;
  sort?: EsClause[];
  size?: number;
  from?: number;
  search_after?: ValueType[];
}

export function isEsFilterMetadata(
  x: EsFieldCondition | EsFilterMetadata,
): x is EsFilterMetadata {
  return 'logic' in x && 'filters' in x;
}

export function isEsFieldCondition(
  x: EsFieldCondition | EsFilterMetadata,
): x is EsFieldCondition {
  return 'field' in x && 'condition' in x;
}
