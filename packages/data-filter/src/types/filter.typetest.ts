// Compile-time assertions for the public types. Checked by `tsc --noEmit`;
// never imported by src/index.ts, so it is not bundled or published.
import type { ObjectData, MatchQueryMetadata } from './filter';

// T1: nested objects and arrays of objects must be assignable to ObjectData.
export const nestedData: ObjectData[] = [
  {
    id: 1,
    active: true,
    tags: ['a', 'b'],
    users: [{ name: 'Alice', age: 30 }],
  },
];

// T2 positive: valid type/operator combos compile.
export const numericRange: MatchQueryMetadata = {
  field: 'age',
  dataType: 'numeric',
  operator: 'range',
  value: [1, 2],
};

// T2 negative: boolean does not allow 'range'. The @ts-expect-error must be
// CONSUMED (i.e. there must really be an error here) once the union lands.
// @ts-expect-error boolean dataType does not support the 'range' operator
export const badBooleanRange: MatchQueryMetadata = {
  field: 'flag',
  dataType: 'boolean',
  operator: 'range',
  value: true,
};

import type { MatchQueryMetadata as MQM } from './filter';

// valid object/array/elemmatch combos compile
export const okObject: MQM = { field: 'p', dataType: 'object', operator: 'contains', value: { a: 1 } };
export const okArray: MQM = { field: 't', dataType: 'array', elementType: 'string', operator: 'contains', value: 'x' };
export const okElem: MQM = {
  field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
  filters: { logic: 'and', filters: [] },
};

// invalid combos are compile errors
// @ts-expect-error object does not support 'gt'
export const badObjectOp: MQM = {
  field: 'p', dataType: 'object',
  operator: 'gt',
  value: { a: 1 },
};
// @ts-expect-error boolean-array does not support 'range'
export const badBoolArrayOp: MQM = {
  field: 'b', dataType: 'array', elementType: 'boolean',
  operator: 'range',
};
