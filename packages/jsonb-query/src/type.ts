/* eslint-disable @typescript-eslint/no-unused-vars */
import { JsonbDataType, ValueType } from '@rfjs/data-transform';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ISqlQuery {
  fromAlias?: string | null;
  from?: string | null;
  where?: string | null;
}

export type FilterQueryMetadata = {
  logic: LogicalOperator;
  filters: (QueryMetadata | FilterQueryMetadata)[];
};

export type QueryMetadata = {
  field: string;
  dataType: JsonbDataType;
  operator:
    | DefaultFilterOperator
    | TextFilterOperator
    | NumericFilterOperator
    | DateFilterOperator
    | BooleanFilterOperator;
  value: ValueType;
};

export type JsonbOperatorToSqlObj = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key in JsonbDataType]: (
    _jsonb: string,
    _field: string,
    _value: any,
  ) => string | null;
};

export type JsonbWhereAliasFieldObj = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key in JsonbDataType]: (_field: string, _alias: string) => string;
};

export type JsonbFromSqlObj = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key in JsonbDataType]: (_jsonb: string, _field: string) => string | null;
};
export type JsonbFromAliasObj = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key in JsonbDataType]: (_field: string, _alias: string) => string | null;
};

export type LogicalOperator = 'and' | 'or';

export type DefaultFilterOperator = 'eq' | 'neq' | 'isnull' | 'isnotnull';

export type TextFilterOperator =
  | (DefaultFilterOperator & 'contains')
  | 'contains'
  | 'startswith'
  | 'endswith'
  | 'terms';

export type NumericFilterOperator =
  | (DefaultFilterOperator & 'gt')
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'range'
  | 'terms';

export type DateFilterOperator =
  | (DefaultFilterOperator & 'gt')
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'range'
  | 'terms';

export type BooleanFilterOperator = DefaultFilterOperator;

export type FilterOperator =
  | DefaultFilterOperator
  | TextFilterOperator
  | NumericFilterOperator
  | DateFilterOperator
  | BooleanFilterOperator;

export type FilterOperatorQuery = {
  [key in FilterOperator]: (
    _jsonb: string,
    _field: string,
    _dataType: JsonbDataType,
    _value: ValueType,
  ) => ISqlQuery;
};

export type FilterOperatorQueryObj = {
  [key in FilterOperator]: (
    _jsonb: string,
    _field: string,
    _dataType: JsonbDataType,
    _value: ValueType,
  ) => string | null;
};
