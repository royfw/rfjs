import { describe, it, expect } from 'vitest';
import { toJSONString } from './toJSONString';

describe('Test lib object', () => {
  it('Test toJSONString', () => {
    const testObj = {
      a: 1,
      b: 10,
      c: 'a',
    };
    const result = toJSONString(testObj);
    const expectResult = '{"a":1,"b":10,"c":"a"}';
    expect(result).toEqual(expectResult);
  });

  it('Test toJSONString isPretty', () => {
    const testObj = {
      a: 1,
      b: 10,
      c: 'a',
    };
    const result = toJSONString(testObj, true);
    const expectResult = `{
  "a": 1,
  "b": 10,
  "c": "a"
}`;
    expect(result).toEqual(expectResult);
  });
});
