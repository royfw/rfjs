import { describe, it, expect } from 'vitest';
import { buildPgFilter } from './build';
import type { PgFilterConfig } from './types';

const config: PgFilterConfig = {
  columns: {
    name: { column: 'name', type: 'text' },
    createdAt: { column: 'created_at', type: 'timestamp' },
  },
  jsonb: { column: 'data', dialect: 'jsonpath' },
};

describe('buildPgFilter', () => {
  it('defaults to match-all when no filter is given', () => {
    const res = buildPgFilter(config, {});
    expect(res.where).toBe('true');
    expect(res.orderBy).toBe('');
    expect(res.values).toEqual([]);
    expect(res.countValues).toEqual([]);
    expect(res.limit).toBeUndefined();
    expect(res.offset).toBeUndefined();
  });

  it('threads params WHERE→ORDER BY and splits values vs countValues', () => {
    const res = buildPgFilter(config, {
      filter: {
        logic: 'and',
        filters: [{ target: 'column', column: 'name', operator: 'contains', value: 'cust' }],
      },
      sort: [{ target: 'jsonb', field: 'score', dataType: 'numeric', direction: 'desc' }],
      page: 2,
      pageSize: 10,
    });
    // WHERE has 1 column param ($1='cust'); ORDER BY jsonb sort adds 1 path param ($2)
    expect(res.countValues).toEqual(['cust']);
    expect(res.values).toHaveLength(2);
    expect(res.values[0]).toBe('cust');
    expect(res.where).toContain('$1');
    expect(res.orderBy).toContain('$2');
    expect(res.limit).toBe(10);
    expect(res.offset).toBe(10);
  });
});
