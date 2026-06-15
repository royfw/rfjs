import { describe, it, expect } from 'vitest';
import { ParamBuilder } from './param-builder';

describe('ParamBuilder', () => {
  it('emits sequential placeholders and collects values', () => {
    const p = new ParamBuilder();
    expect(p.add('a')).toBe('$1');
    expect(p.add('b')).toBe('$2');
    expect(p.values).toEqual(['a', 'b']);
  });

  it('honors a starting offset', () => {
    const p = new ParamBuilder(2);
    expect(p.add('x')).toBe('$3');
    expect(p.values).toEqual(['x']);
  });
});
