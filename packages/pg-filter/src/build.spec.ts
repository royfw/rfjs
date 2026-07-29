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

  it('shifts placeholders by paramOffset while leaving values unchanged', () => {
    const input = {
      filter: {
        logic: 'and' as const,
        filters: [{ target: 'column' as const, column: 'name', operator: 'contains' as const, value: 'cust' }],
      },
      sort: [{ target: 'jsonb' as const, field: 'score', dataType: 'numeric' as const, direction: 'desc' as const }],
    };
    const base = buildPgFilter(config, input);
    const offset = buildPgFilter(config, { ...input, paramOffset: 3 });

    // WHERE param moves $1 → $4, ORDER BY jsonb path param moves $2 → $5
    expect(base.where).toContain('$1');
    expect(base.orderBy).toContain('$2');
    expect(offset.where).toContain('$4');
    expect(offset.where).not.toContain('$1');
    expect(offset.orderBy).toContain('$5');
    expect(offset.orderBy).not.toContain('$2');

    // values payload is identical — only the $N numbering changed
    expect(offset.values).toEqual(base.values);
    expect(offset.countValues).toEqual(base.countValues);
  });

  it('treats paramOffset: 0 as the default (no shift)', () => {
    const input = {
      filter: {
        logic: 'and' as const,
        filters: [{ target: 'column' as const, column: 'name', operator: 'eq' as const, value: 'x' }],
      },
    };
    expect(buildPgFilter(config, { ...input, paramOffset: 0 })).toEqual(buildPgFilter(config, input));
  });
});
