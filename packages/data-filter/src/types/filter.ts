export type FilterMatchQuery = {
  logic: LogicalOperator;
  filters: (MatchQueryMetadata | FilterMatchQuery)[];
};

export type MatchQueryDataType = 'string' | 'numeric' | 'boolean' | 'date';

export interface StringCondition {
  field: string;
  dataType: 'string';
  operator: TextFilterOperator;
  value: ValueType;
}

export interface NumericCondition {
  field: string;
  dataType: 'numeric';
  operator: NumericFilterOperator;
  value: ValueType;
}

export interface DateCondition {
  field: string;
  dataType: 'date';
  operator: DateFilterOperator;
  value: ValueType;
}

export interface BooleanCondition {
  field: string;
  dataType: 'boolean';
  operator: BooleanFilterOperator;
  value: ValueType;
}

/**
 * A single field condition, discriminated by `dataType` so each data type only
 * accepts its own operators. Future object/array/elemmatch variants are added
 * to this union (mirroring `@rfjs/jsonb-query`) without breaking existing ones.
 */
export type MatchQueryMetadata =
  | StringCondition
  | NumericCondition
  | DateCondition
  | BooleanCondition;

export type LogicalOperator = 'and' | 'or' | 'nor' | 'not';

export type DefaultFilterOperator = 'eq' | 'neq' | 'isnull' | 'isnotnull';

export type TextFilterOperator =
  | 'contains'
  | 'startswith'
  | 'endswith'
  | 'terms'
  | DefaultFilterOperator;

export type NumericFilterOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'range'
  | 'terms'
  | DefaultFilterOperator;

export type DateFilterOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'range'
  | 'terms'
  | DefaultFilterOperator;

export type BooleanFilterOperator = DefaultFilterOperator;

export type ValueType =
  | string
  | string[]
  | number
  | number[]
  | Date
  | Date[]
  | boolean
  | boolean[];

export type DataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'any'
  | 'integer'
  | 'date';

/**
 * An input record to filter. Values may be scalars, nested records, arrays of
 * scalars, or arrays of records — JSONPath/lodash resolve arbitrary depth at
 * runtime, so the data type is intentionally permissive.
 */
export type ObjectData = {
  [key: string]: ValueType | ObjectData | ObjectData[] | null;
};

export interface PathResolveOptions {
  fallbackToLodash?: boolean;
  fallbackOnEmpty?: boolean;
}

export interface PathResolveResult {
  value: unknown;
  usedJsonPath: boolean;
  isWildcardResult: boolean;
}
