import { toDateString } from './date';
import { toBoolean } from './boolean';

export type JsonbDataType =
  | 'string' | 'numeric' | 'date' | 'boolean'
  | 'objectString' | 'objectNumeric' | 'objectDate' | 'objectBoolean'
  | 'arrayString' | 'arrayNumeric' | 'arrayDate' | 'arrayBoolean'
  | 'arrayObjectString' | 'arrayObjectNumeric' | 'arrayObjectDate' | 'arrayObjectBoolean';

export type JsonbValueType = string | number | boolean | Date | null | undefined | any;

export type JsonbValueTransfer = {
  [key in JsonbDataType]: (value: JsonbValueType) => JsonbValueType;
};

export const jsonbTypeTransfer = (value: JsonbValueType, type: JsonbDataType): JsonbValueType => {
  const transfer: JsonbValueTransfer = {
    string: () => value,
    numeric: () => Number(value),
    date: () => toDateString(value as string | number),
    boolean: () => toBoolean(value as boolean | string),
    objectString: () => value,
    objectNumeric: () => Number(value),
    objectDate: () => toDateString(value as string | number),
    objectBoolean: () => toBoolean(value as boolean | string),
    arrayString: () => value,
    arrayNumeric: () => Number(value),
    arrayDate: () => toDateString(value as string | number),
    arrayBoolean: () => toBoolean(value as boolean | string),
    arrayObjectString: () => value,
    arrayObjectNumeric: () => Number(value),
    arrayObjectDate: () => toDateString(value as string | number),
    arrayObjectBoolean: () => toBoolean(value as boolean | string),
  };
  if (!Object.keys(transfer).includes(type)) type = 'string';
  return transfer[type](value);
};
