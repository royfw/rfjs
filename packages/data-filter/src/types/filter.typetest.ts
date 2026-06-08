// Compile-time assertions for the public types. Checked by `tsc --noEmit`;
// never imported by src/index.ts, so it is not bundled or published.
import type { ObjectData } from './filter';

// T1: nested objects and arrays of objects must be assignable to ObjectData.
export const nestedData: ObjectData[] = [
  {
    id: 1,
    active: true,
    tags: ['a', 'b'],
    users: [{ name: 'Alice', age: 30 }],
  },
];
