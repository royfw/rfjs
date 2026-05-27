import * as _ from 'lodash';
import { toBoolean } from './boolean';

export type DataType = 'string' | 'number' | 'boolean' | 'any' | 'integer' | 'date';
export type MgoDataType = DataType;
export type ValueType = string | number | boolean | Date | RegExp | null | undefined | any;

export const typeTransfer = (value: ValueType, type: MgoDataType | DataType): ValueType => {
  const transfer = {
    any: () => value,
    date: () => new Date(value as string | number),
    string: () => value,
    number: () => Number(value),
    integer: () => Number(value),
    boolean: () => toBoolean(value as boolean | string),
    regex: () => new RegExp(value as string),
  };
  if (!_.has(transfer, type)) type = 'any';
  return transfer[type]();
};
