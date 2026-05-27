/* eslint-disable @typescript-eslint/no-unused-vars */
import { JsonbOperatorToSqlObj } from './type';

export const jsonbEqOperator: JsonbOperatorToSqlObj = {
  string: (_jsonb: string, _field: string, _value: string) =>
    `((${_jsonb} ->> '${_field}' )::text = '${_value}')`,
  numeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_jsonb} ->> '${_field}' )::numeric = ${_value})`,
  date: (_jsonb: string, _field: string, _value: Date) =>
    `((${_jsonb} ->> '${_field}' ) = ${_value})`,
  boolean: (_jsonb: string, _field: string, _value: boolean) =>
    `((${_jsonb} ->> '${_field}' )::boolean is ${JSON.stringify(_value)})`,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) =>
    `((${_field})::boolean = is ${JSON.stringify(_value)})`,
  arrayString: (_jsonb: string, _field: string, _value: string) =>
    `((${_field})::text = '${_value}')`,
  arrayNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric = ${_value})`,
  arrayDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) = ${_value})`,
  objectString: (_jsonb: string, _field: string, _value: string) =>
    `((${_field})::text = '${_value}')`,
  objectNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric = ${_value})`,
  objectDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) = ${_value})`,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) =>
    `((${_field})::boolean = is ${JSON.stringify(_value)})`,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectDate: (_jsonb: string, _field: string, _value: boolean) => null,
};

export const jsonbNeqOperator: JsonbOperatorToSqlObj = {
  string: (_jsonb: string, _field: string, _value: string) =>
    `((${_jsonb} ->> '${_field}' )::text != '${_value}')`,
  numeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_jsonb} ->> '${_field}' )::numeric != ${_value})`,
  date: (_jsonb: string, _field: string, _value: Date) =>
    `((${_jsonb} ->> '${_field}' ) = ${_value})`,
  boolean: (_jsonb: string, _field: string, _value: boolean) =>
    `((${_jsonb} ->> '${_field}' )::boolean is not ${JSON.stringify(_value)})`,
  arrayString: (_jsonb: string, _field: string, _value: string) =>
    `((${_field})::text != '${_value}')`,
  arrayNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric != ${_value})`,
  arrayDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) != ${_value})`,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) =>
    `((${_field})::boolean = is not ${JSON.stringify(_value)})`,
  objectString: (_jsonb: string, _field: string, _value: string) =>
    `((${_field})::text != '${_value}')`,
  objectNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric != ${_value})`,
  objectDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) != ${_value})`,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) =>
    `((${_field})::boolean = is not ${JSON.stringify(_value)})`,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectDate: (_jsonb: string, _field: string, _value: boolean) => null,
};

export const jsonbIsNullOperator: JsonbOperatorToSqlObj = {
  string: (_jsonb: string, _field: string) =>
    `((${_jsonb} ->> '${_field}' ) is null)`,
  numeric: (_jsonb: string, _field: string) =>
    `((${_jsonb} ->> '${_field}' ) is null)`,
  date: (_jsonb: string, _field: string) =>
    `((${_jsonb} ->> '${_field}' ) is null)`,
  boolean: (_jsonb: string, _field: string) =>
    `((${_jsonb} ->> '${_field}' ) is null)`,
  objectString: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  objectDate: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayDate: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectDate: (_jsonb: string, _field: string, _value: boolean) => null,
};

export const jsonbIsNotNullOperator: JsonbOperatorToSqlObj = {
  string: (_jsonb: string, _field: string) =>
    `((${_jsonb} ->> '${_field}' ) is not null)`,
  numeric: (_jsonb: string, _field: string) =>
    `((${_jsonb} ->> '${_field}' ) is not null)`,
  date: (_jsonb: string, _field: string) =>
    `((${_jsonb} ->> '${_field}' ) is not null)`,
  boolean: (_jsonb: string, _field: string) =>
    `((${_jsonb} ->> '${_field}' ) is not null)`,
  objectString: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  objectDate: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayDate: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectDate: (_jsonb: string, _field: string, _value: boolean) => null,
};

export const jsonbContainsOperator: JsonbOperatorToSqlObj = {
  string: (_jsonb: string, _field: string, _value: string) =>
    `((${_jsonb} ->> '${_field}' ) like '%${_value}%')`,
  arrayString: (_jsonb: string, _field: string, _value: string) =>
    `((${_field})::text like '%${_value}%')`,
  objectString: (_jsonb: string, _field: string, _value: string) =>
    `((${_field})::text like '%${_value}%')`,
  boolean: (_jsonb: string, _field: string, _value: boolean) => null,
  numeric: (_jsonb: string, _field: string, _value: boolean) => null,
  date: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  objectDate: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayDate: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectDate: (_jsonb: string, _field: string, _value: boolean) => null,
};

export const jsonbStartsWithOperator: JsonbOperatorToSqlObj = {
  string: (_jsonb: string, _field: string, _value: string) =>
    `((${_jsonb} ->> '${_field}' ) like '${_value}%')`,
  arrayString: (_jsonb: string, _field: string, _value: string) =>
    `((${_field})::text like '${_value}%')`,
  objectString: (_jsonb: string, _field: string, _value: string) =>
    `((${_field})::text like '${_value}%')`,
  boolean: (_jsonb: string, _field: string, _value: boolean) => null,
  numeric: (_jsonb: string, _field: string, _value: boolean) => null,
  date: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  objectDate: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayDate: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectDate: (_jsonb: string, _field: string, _value: boolean) => null,
};

export const jsonbEndsWithOperator: JsonbOperatorToSqlObj = {
  string: (_jsonb: string, _field: string, _value: string) =>
    `((${_jsonb} ->> '${_field}' ) like '%${_value}')`,
  arrayString: (_jsonb: string, _field: string, _value: string) =>
    `((${_field})::text like '%${_value}')`,
  objectString: (_jsonb: string, _field: string, _value: string) =>
    `((${_field})::text like '%${_value}')`,
  boolean: (_jsonb: string, _field: string, _value: boolean) => null,
  numeric: (_jsonb: string, _field: string, _value: boolean) => null,
  date: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  objectDate: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayDate: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectDate: (_jsonb: string, _field: string, _value: boolean) => null,
};

export const jsonbTermsOperator: JsonbOperatorToSqlObj = {
  string: (_jsonb: string, _field: string, _value: string[]) =>
    `((${_jsonb} ->> '${_field}' )::text in (${_value
      .map((i) => `'${i}'`)
      .join(',')}) )`,
  numeric: (_jsonb: string, _field: string, _value: number[]) =>
    `((${_jsonb} ->> '${_field}' )::numeric in (${_value
      .map((i) => `${i}`)
      .join(',')}))`,
  date: (_jsonb: string, _field: string, _value: Date[]) =>
    `((${_jsonb} ->> '${_field}' ) in ( ${_value
      .map((i) => `'${i}'`)
      .join(',')} ))`,
  arrayString: (_jsonb: string, _field: string, _value: string[]) =>
    `((${_field})::text in (${_value.map((i) => `'${i}'`).join(',')}))`,
  arrayNumeric: (_jsonb: string, _field: string, _value: number[]) =>
    `((${_field})::numeric in (${_value.map((i) => `${i}`).join(',')}))`,
  arrayDate: (_jsonb: string, _field: string, _value: Date[]) =>
    `((${_field}) in ( ${_value.map((i) => `'${i}'`).join(',')} ))`,
  objectString: (_jsonb: string, _field: string, _value: string[]) =>
    `((${_field})::text in (${_value.map((i) => `'${i}'`).join(',')}))`,
  objectNumeric: (_jsonb: string, _field: string, _value: number[]) =>
    `((${_field})::numeric in (${_value.map((i) => `${i}`).join(',')}))`,
  objectDate: (_jsonb: string, _field: string, _value: Date[]) =>
    `((${_field}) in ( ${_value.map((i) => `'${i}'`).join(',')} ))`,
  boolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectDate: (_jsonb: string, _field: string, _value: boolean) => null,
};

export const jsonbRangeOperator: JsonbOperatorToSqlObj = {
  numeric: (_jsonb: string, _field: string, _value: number[]) =>
    `((${_jsonb} ->> '${_field}' )::numeric between ${_value[0]} and ${_value[1]})`,
  date: (_jsonb: string, _field: string, _value: Date[]) =>
    `((${_jsonb} ->> '${_field}' ) between '${_value[0]}' and '${_value[1]}')`,
  arrayNumeric: (_jsonb: string, _field: string, _value: number[]) =>
    `((${_field})::numeric between ${_value[0]} and ${_value[1]})`,
  arrayDate: (_jsonb: string, _field: string, _value: Date[]) =>
    `((${_field}) between '${_value[0]}' and '${_value[1]}')`,
  objectNumeric: (_jsonb: string, _field: string, _value: number[]) =>
    `((${_field})::numeric between ${_value[0]} and ${_value[1]})`,
  objectDate: (_jsonb: string, _field: string, _value: Date[]) =>
    `((${_field}) between '${_value[0]}' and '${_value[1]}')`,
  string: (_jsonb: string, _field: string, _value: boolean) => null,
  boolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectString: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: number[]) =>
    `((${_field})::numeric between ${_value[0]} and ${_value[1]})`,
  arrayObjectDate: (_jsonb: string, _field: string, _value: Date[]) =>
    `((${_field}) between '${_value[0]}' and '${_value[1]}')`,
};

export const jsonbGteOperator: JsonbOperatorToSqlObj = {
  numeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_jsonb} ->> '${_field}' )::numeric >= ${_value})`,
  date: (_jsonb: string, _field: string, _value: Date) =>
    `((${_jsonb} ->> '${_field}' ) >= ${_value})`,
  arrayNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric >= ${_value})`,
  arrayDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) >= '${_value}')`,
  objectNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric >= ${_value})`,
  objectDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) >= '${_value}')`,
  string: (_jsonb: string, _field: string, _value: boolean) => null,
  boolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectString: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric >= ${_value})`,
  arrayObjectDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) >= '${_value}')`,
};

export const jsonbGtOperator: JsonbOperatorToSqlObj = {
  numeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_jsonb} ->> '${_field}' )::numeric > ${_value})`,
  date: (_jsonb: string, _field: string, _value: Date) =>
    `((${_jsonb} ->> '${_field}' )  > '${_value}')`,
  arrayNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric > ${_value})`,
  arrayDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) > '${_value}')`,
  objectNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric > ${_value})`,
  objectDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) > '${_value}')`,
  string: (_jsonb: string, _field: string, _value: boolean) => null,
  boolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectString: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric > ${_value})`,
  arrayObjectDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) > '${_value}')`,
};

export const jsonbLteOperator: JsonbOperatorToSqlObj = {
  numeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_jsonb} ->> '${_field}' )::numeric <= ${_value})`,
  date: (_jsonb: string, _field: string, _value: Date) =>
    `((${_jsonb} ->> '${_field}' ) <= '${_value}')`,
  arrayNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric <= ${_value})`,
  arrayDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) <= '${_value}')`,
  objectNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric <= ${_value})`,
  objectDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) <= '${_value}')`,
  string: (_jsonb: string, _field: string, _value: boolean) => null,
  boolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectString: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric <= ${_value})`,
  arrayObjectDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) <= '${_value}')`,
};

export const jsonbLtOperator: JsonbOperatorToSqlObj = {
  numeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_jsonb} ->> '${_field}' )::numeric < ${_value})`,
  date: (_jsonb: string, _field: string, _value: Date) =>
    `((${_jsonb} ->> '${_field}' ) < '${_value}')`,
  arrayNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric < ${_value})`,
  arrayDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) < '${_value}')`,
  objectNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric < ${_value})`,
  objectDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) < '${_value}')`,
  string: (_jsonb: string, _field: string, _value: boolean) => null,
  boolean: (_jsonb: string, _field: string, _value: boolean) => null,
  objectString: (_jsonb: string, _field: string, _value: boolean) => null,
  objectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectString: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectBoolean: (_jsonb: string, _field: string, _value: boolean) => null,
  arrayObjectNumeric: (_jsonb: string, _field: string, _value: number) =>
    `((${_field})::numeric < ${_value})`,
  arrayObjectDate: (_jsonb: string, _field: string, _value: Date) =>
    `((${_field}) < '${_value}')`,
};
