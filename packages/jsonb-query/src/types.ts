export type JsonbDialect = 'legacy' | 'jsonpath';

export type JsonbScalarType = 'string' | 'numeric' | 'date' | 'boolean';

export type JsonbValue = string | number | boolean | Date;

export type JsonbLogicalOperator = 'and' | 'or';

export type JsonbScalarOperator =
  | 'eq'
  | 'neq'
  | 'isnull'
  | 'isnotnull'
  | 'contains'
  | 'startswith'
  | 'endswith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'range'
  | 'terms';

export interface JsonbCondition {
  field: string;
  dataType: JsonbScalarType;
  operator: JsonbScalarOperator;
  value?: JsonbValue | JsonbValue[];
}

export interface JsonbFilterGroup {
  logic: JsonbLogicalOperator;
  filters: Array<JsonbCondition | JsonbFilterGroup>;
}

export interface JsonbQueryResult {
  where: string;
  values: unknown[];
  from: string[];
}

export interface BuildJsonbOptions {
  dialect?: JsonbDialect;
  paramOffset?: number;
}
