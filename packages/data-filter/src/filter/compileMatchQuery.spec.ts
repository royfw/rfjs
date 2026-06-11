import { describe, it, expect } from 'vitest';
import { compileMatchQuery, matchQueryAsync } from './compileMatchQuery';
import type { FilterMatchQuery } from '../types';

const wrap = (cond: unknown): FilterMatchQuery =>
  ({ logic: 'and', filters: [cond] } as FilterMatchQuery);

const order = {
  items: [
    { status: 'paid', amount: 400 },
    { status: 'open', amount: 700 },
    { status: 'paid', amount: 700 },
  ],
  paidTarget: 2,
};

describe('compileMatchQuery / matchQueryAsync', () => {
  it('computed "=" field compared by the normal operator machinery', async () => {
    const matches = compileMatchQuery(
      wrap({ field: '=$sum(items.amount)', dataType: 'numeric', operator: 'gt', value: 1000 }),
    );
    expect(await matches(order)).toBe(true);
    expect(await matches({ items: [{ amount: 1 }] })).toBe(false);
  });
  it('computed "=" value (count-where on the RHS)', async () => {
    expect(
      await matchQueryAsync(order, wrap({
        field: 'paidTarget', dataType: 'numeric', operator: 'eq',
        value: "=$count(items[status='paid'])",
      })),
    ).toBe(true);
  });
  it('plain conditions and group logic behave exactly like the sync api', async () => {
    const filter: FilterMatchQuery = {
      logic: 'or',
      filters: [
        { field: 'paidTarget', dataType: 'numeric', operator: 'gt', value: 99 },
        { field: '=$count(items)', dataType: 'numeric', operator: 'eq', value: 3 },
      ] as never,
    };
    expect(await matchQueryAsync(order, filter)).toBe(true);
  });
  it('an undefined expression result is a no-match (and fires onUndefined)', async () => {
    const seen: string[] = [];
    const matches = compileMatchQuery(
      wrap({ field: '=nope.nothing', dataType: 'numeric', operator: 'gt', value: 0 }),
      { onUndefined: (e) => seen.push(e) },
    );
    expect(await matches(order)).toBe(false);
    expect(seen).toEqual(['nope.nothing']);
  });
  it('a malformed expression throws at COMPILE time (kind compile)', () => {
    expect(() =>
      compileMatchQuery(wrap({ field: '=$sum((', dataType: 'numeric', operator: 'gt', value: 0 })),
    ).toThrow(/invalid expression/);
  });
  it('"=" inside an elemmatch sub-filter is unsupported and throws clearly', async () => {
    const matches = compileMatchQuery(
      wrap({
        field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
        filters: wrap({ field: '=amount * 2', dataType: 'numeric', operator: 'gt', value: 100 }),
      }),
    );
    await expect(matches(order)).rejects.toThrow(/async api/);
  });
});
