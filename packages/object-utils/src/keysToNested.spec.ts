import { describe, it, expect } from 'vitest';
import { keysToNested } from './keysToNested';

describe('Test lib object nested', () => {
  it('Test keysToNested nest 1 obj v1', () => {
    const expectResult = {
      c: {
        d: 10,
      },
    };
    const result = keysToNested(['c', 'd'], 10);
    expect(result).toEqual(expectResult);
  });

  it('Test keysToNested nest 2 obj v1', () => {
    const expectResult = {
      c: {
        d: {
          b: 10,
        },
      },
    };
    const result = keysToNested(['c', 'd', 'b'], 10);
    expect(result).toEqual(expectResult);
  });

  it('Test keysToNested2 nest 2 obj v1', () => {
    const expectResult = {
      c: {
        d: {
          b: 10,
          a: 1000,
        },
        b: {
          b: 20,
        },
        a: 100,
      },
    };
    const testCases = [
      {
        keys: ['c', 'd', 'b'],
        value: 10,
      },
      {
        keys: ['c', 'd', 'a'],
        value: 1000,
      },
      {
        keys: ['c', 'b', 'b'],
        value: 20,
      },
      {
        keys: ['c', 'a'],
        value: 100,
      },
    ];
    const result = {};
    for (const testCase of testCases) {
      keysToNested(testCase.keys, testCase.value, result);
    }
    expect(result).toEqual(expectResult);
  });
  it('Test keysToNested2 nest 2 obj v2', () => {
    const expectResult = {
      default: 12345,
      target: [
        {
          key: 'a',
          value: 1,
        },
        {
          key: 'b',
          value: {
            a: 123,
            c: {
              d: {
                b: 10,
                a: 1000,
              },
              b: {
                b: 20,
              },
              a: 100,
            },
          },
        },
      ],
    };
    const testCases = [
      {
        keys: ['c', 'd', 'b'],
        value: 10,
      },
      {
        keys: ['c', 'd', 'a'],
        value: 1000,
      },
      {
        keys: ['c', 'b', 'b'],
        value: 20,
      },
      {
        keys: ['c', 'a'],
        value: 100,
      },
    ];
    const result = {
      default: 12345,
      target: [
        {
          key: 'a',
          value: 1,
        },
        {
          key: 'b',
          value: {
            a: 123,
          },
        },
      ],
    };
    const target = result.target;
    target.map((item) => {
      if (item.key !== 'b') return item;
      for (const testCase of testCases) {
        keysToNested(testCase.keys, testCase.value, item.value);
      }
      return item;
    });
    expect(result).toEqual(expectResult);
  });
});
