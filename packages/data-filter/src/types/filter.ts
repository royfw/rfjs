export type FilterMatchQuery = {
  logic: LogicalOperator;
  filters: (MatchQueryMetadata | FilterMatchQuery)[];
};

export type MatchQueryDataType = 'string' | 'numeric' | 'boolean' | 'date';

export type MatchQueryMetadata = {
  field: string;
  dataType: MatchQueryDataType;
  operator:
    | DefaultFilterOperator
    | TextFilterOperator
    | NumericFilterOperator
    | DateFilterOperator;
  value: ValueType;
};

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

export type ObjectData = {
  [key: string]: ValueType;
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
