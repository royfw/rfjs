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
