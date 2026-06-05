export type FilterMatchQuery = {
  logic: LogicalOperator;
  filters: (MatchQueryMetadata | FilterMatchQuery)[];
};

export type MatchQueryDataType = 'string' | 'numeric' | 'boolean' | 'date';

export type MatchQueryMetadata = {
  field: string;
  dataType: MatchQueryDataType;
  // Any filter operator is accepted; the runtime dispatches by `dataType`.
  // Written as a flat union (rather than Text|Numeric|Date, which overlap on
  // DefaultFilterOperator + `terms`) so the type carries no redundant members.
  operator:
    | DefaultFilterOperator
    | 'contains'
    | 'startswith'
    | 'endswith'
    | 'terms'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'range';
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
