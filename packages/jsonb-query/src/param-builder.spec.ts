import { describe, it, expect } from 'vitest';
import { ParamBuilder } from './param-builder';

describe('ParamBuilder', () => {
  it('numbers placeholders from $1 and collects values in order', () => {
    const p = new ParamBuilder();
    expect(p.add('a')).toBe('$1');
    expect(p.add(2)).toBe('$2');
    expect(p.values).toEqual(['a', 2]);
  });

  it('applies an offset so the first placeholder follows existing params', () => {
    const p = new ParamBuilder(3);
    expect(p.add('x')).toBe('$4');
    expect(p.values).toEqual(['x']);
  });
});
