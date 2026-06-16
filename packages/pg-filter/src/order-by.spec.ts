import { describe, it, expect } from 'vitest';
import { buildPgOrderBy } from './order-by';
import { PgFilterError } from './errors';
import type { PgFilterConfig, PgSort } from './types';

const config: PgFilterConfig = {
  columns: {
    name: { column: 'name', type: 'text' },
    createdAt: { column: 'created_at', type: 'timestamp' },
  },
  jsonb: { column: 'data', dialect: 'jsonpath' },
};

describe('buildPgOrderBy', () => {
  it('returns empty for no sorts', () => {
    expect(buildPgOrderBy(config, [])).toEqual({ orderBy: '', values: [] });
  });

  it('renders a column sort (no params)', () => {
    const { orderBy, values } = buildPgOrderBy(config, [{ target: 'column', column: 'createdAt', direction: 'desc' }]);
    expect(orderBy).toContain('created_at');
    expect(orderBy).toContain('desc');
    expect(values).toEqual([]);
  });

  it('renders a jsonb sort with a param for the field path', () => {
    const { orderBy, values } = buildPgOrderBy(config, [{ target: 'jsonb', field: 'score', dataType: 'numeric', direction: 'asc' }]);
    expect(orderBy).toContain('$1');
    expect(values.length).toBe(1);
  });

  it('preserves order of mixed sorts and numbers jsonb params after a starting offset', () => {
    const sorts: PgSort[] = [
      { target: 'jsonb', field: 'score', dataType: 'numeric', direction: 'desc' },
      { target: 'column', column: 'name', direction: 'asc' },
      { target: 'jsonb', field: 'rank', dataType: 'numeric', direction: 'asc' },
    ];
    const { orderBy, values } = buildPgOrderBy(config, sorts, 3);
    // starting offset 3 → first jsonb path param is $4, second is $5
    expect(orderBy).toContain('$4');
    expect(orderBy).toContain('$5');
    expect(values.length).toBe(2);
    // column fragment sits between the two jsonb fragments
    const idxScore = orderBy.indexOf('$4');
    const idxName = orderBy.indexOf('name');
    const idxRank = orderBy.indexOf('$5');
    expect(idxScore).toBeLessThan(idxName);
    expect(idxName).toBeLessThan(idxRank);
  });

  it('throws INVALID_TARGET for an unknown sort target', () => {
    const bad = [{ target: 'evil', column: 'name' }];
    expect(() => buildPgOrderBy(config, bad as unknown as PgSort[])).toThrow(PgFilterError);
  });
});
