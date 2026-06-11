import { describe, it, expect } from 'vitest';
import { compile, evaluate } from './compile';
import { DataExprError } from './errors';

const order = {
  items: [
    { sku: 'A', status: 'paid', amount: 400 },
    { sku: 'B', status: 'open', amount: 700 },
    { sku: 'C', status: 'paid', amount: 700 },
  ],
  customer: { firstName: 'John', lastName: 'Doe' },
  tags: ['vip', 'beta'],
};

describe('compile / evaluate core', () => {
  it('arithmetic', async () => {
    expect(await evaluate('1 + 2 * 3', {})).toBe(7);
  });
  it('aggregates', async () => {
    expect(await evaluate('$sum(items.amount)', order)).toBe(1800);
    expect(await evaluate('$sum(items.amount) * 2', order)).toBe(3600);
  });
  it('count-where', async () => {
    expect(await evaluate("$count(items[status='paid'])", order)).toBe(2);
  });
  it('string merge / extract', async () => {
    expect(await evaluate("customer.firstName & ' ' & customer.lastName", order)).toBe('John Doe');
    expect(await evaluate("$substring(items[0].sku, 0, 1)", order)).toBe('A');
    expect(await evaluate("$join(tags, '-')", order)).toBe('vip-beta');
  });
  it('sequence collapse: 0 hits → undefined, 1 → scalar, n → array', async () => {
    const expr = compile("items[status='paid'].amount");
    expect(await expr.evaluate({ items: [] })).toBeUndefined();
    expect(await expr.evaluate({ items: [{ status: 'paid', amount: 5 }] })).toBe(5);
    expect(await expr.evaluate(order)).toEqual([400, 700]);
  });
  it('a compiled expression is reusable across data inputs', async () => {
    const expr = compile('$sum(items.amount)');
    expect(await expr.evaluate({ items: [{ amount: 1 }] })).toBe(1);
    expect(await expr.evaluate({ items: [{ amount: 2 }, { amount: 3 }] })).toBe(5);
  });
  it('a malformed expression throws kind "compile" synchronously', () => {
    try {
      compile('$sum((');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DataExprError);
      expect((err as DataExprError).kind).toBe('compile');
      expect((err as DataExprError).expression).toBe('$sum((');
    }
  });
  it('a runtime evaluation failure rejects with kind "evaluate"', async () => {
    await expect(evaluate('$number("abc")', {})).rejects.toMatchObject({
      name: 'DataExprError',
      kind: 'evaluate',
    });
  });
});
