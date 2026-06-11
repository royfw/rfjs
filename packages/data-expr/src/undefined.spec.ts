import { describe, it, expect } from 'vitest';
import { compile } from './compile';

describe('undefined-result handling', () => {
  it('resolves undefined by default and fires onUndefined', async () => {
    const seen: string[] = [];
    const expr = compile('nope.nothing', { onUndefined: (e) => seen.push(e) });
    expect(await expr.evaluate({ a: 1 })).toBeUndefined();
    expect(seen).toEqual(['nope.nothing']);
  });

  it('strict mode rejects with kind "undefined"', async () => {
    const expr = compile('nope.nothing', { strict: true });
    await expect(expr.evaluate({ a: 1 })).rejects.toMatchObject({
      name: 'DataExprError',
      kind: 'undefined',
    });
  });

  it('a defined result does not fire onUndefined', async () => {
    const seen: string[] = [];
    const expr = compile('a', { strict: true, onUndefined: (e) => seen.push(e) });
    expect(await expr.evaluate({ a: 42 })).toBe(42);
    expect(seen).toEqual([]);
  });
});
