import { describe, it, expect } from 'vitest';
import { matchQuery } from './matchQuery';
import { matchAndMap } from './matchAndMap';
import type { FilterMatchQuery } from '../types';

const wrap = (cond: unknown): FilterMatchQuery =>
  ({ logic: 'and', filters: [cond] } as FilterMatchQuery);

describe('sync apis reject "=" expression slots', () => {
  it('matchQuery throws on an "=" field', () => {
    expect(() =>
      matchQuery({ items: [] }, wrap({ field: '=$sum(items.amount)', dataType: 'numeric', operator: 'gt', value: 1 })),
    ).toThrow(/async api/);
  });
  it('matchQuery throws on an "=" value', () => {
    expect(() =>
      matchQuery({ n: 1 }, wrap({ field: 'n', dataType: 'numeric', operator: 'gt', value: '=$count(items)' })),
    ).toThrow(/async api/);
  });
  it('matchAndMap throws on an "=" mapping value', () => {
    expect(() =>
      matchAndMap(
        [{ name: 'alice', qty: 3 }],
        [{
          filter: wrap({ field: 'data.name', dataType: 'string', operator: 'eq', value: 'alice' }),
          mappings: [{ key: 'bonus', type: 'value', value: '=500 * data.qty' }],
        }],
      ),
    ).toThrow(/async api/);
  });
  it('a plain "="-free filter still works synchronously', () => {
    expect(matchQuery({ n: 5 }, wrap({ field: 'n', dataType: 'numeric', operator: 'gt', value: 1 }))).toBe(true);
  });
});
