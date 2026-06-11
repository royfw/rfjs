import { describe, it, expect } from 'vitest';
import { ElemMatch } from './ElemMatch';
import { matchQuery } from '../filter/matchQuery';
import type { FilterMatchQuery } from '../types';

const data = { items: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 5 }] };

describe('ElemMatch', () => {
  it('matches when the SAME element satisfies all sub-conditions', () => {
    const filters: FilterMatchQuery = {
      logic: 'and',
      filters: [
        { field: 'sku', dataType: 'string', operator: 'eq', value: 'A' },
        { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
      ],
    };
    expect(new ElemMatch('items', filters, data, matchQuery).isMatch).toBe(false); // A has qty 1
  });
  it('matches when one element satisfies all sub-conditions', () => {
    const filters: FilterMatchQuery = {
      logic: 'and',
      filters: [
        { field: 'sku', dataType: 'string', operator: 'eq', value: 'A' },
        { field: 'qty', dataType: 'numeric', operator: 'gt', value: 0 },
      ],
    };
    expect(new ElemMatch('items', filters, data, matchQuery).isMatch).toBe(true);
  });
  it('empty / non-array / missing → no match', () => {
    const filters: FilterMatchQuery = {
      logic: 'and',
      filters: [{ field: 'sku', dataType: 'string', operator: 'eq', value: 'A' }],
    };
    expect(new ElemMatch('items', filters, { items: [] }, matchQuery).isMatch).toBe(false);
    expect(new ElemMatch('items', filters, {}, matchQuery).isMatch).toBe(false);
  });
});
