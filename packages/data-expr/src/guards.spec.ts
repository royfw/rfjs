import { describe, it, expect } from 'vitest';
import { compile } from './compile';

describe('DoS guards', () => {
  it('aborts a runaway expression via timeoutMs', async () => {
    const runaway = compile('($f := function($x){$f($x+1)}; $f(0))', {
      timeoutMs: 100,
      maxDepth: 1_000_000_000,
    });
    await expect(runaway.evaluate({})).rejects.toMatchObject({
      name: 'DataExprError',
      kind: 'timeout',
    });
  });

  it('aborts deep recursion via maxDepth', async () => {
    const deep = compile('($f := function($x){$x < 100000 ? $f($x+1) + 1 : 0}; $f(0))', {
      timeoutMs: 60_000,
      maxDepth: 50,
    });
    await expect(deep.evaluate({})).rejects.toMatchObject({
      name: 'DataExprError',
      kind: 'depth',
    });
  });

  it('guards reset per call: normal evaluation is unaffected and reusable', async () => {
    const expr = compile('$sum(items.amount)', { timeoutMs: 1000, maxDepth: 100 });
    expect(await expr.evaluate({ items: [{ amount: 1 }, { amount: 2 }] })).toBe(3);
    expect(await expr.evaluate({ items: [{ amount: 5 }] })).toBe(5);
  });
});
