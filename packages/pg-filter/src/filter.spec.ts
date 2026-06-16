import { describe, it, expect } from 'vitest';
import { buildPgWhere } from './filter';
import { PgFilterError } from './errors';
import type { PgFilterConfig, PgFilterGroup } from './types';

const config: PgFilterConfig = {
  columns: {
    name: { column: 'name', type: 'text' },
    createdAt: { column: 'created_at', type: 'timestamp' },
  },
  jsonb: { column: 'data', dialect: 'jsonpath' },
};

describe('buildPgWhere', () => {
  it('renders a pure column tree (flat scalar param)', () => {
    const group: PgFilterGroup = {
      logic: 'and',
      filters: [{ target: 'column', column: 'name', operator: 'contains', value: 'cust' }],
    };
    const { where, values } = buildPgWhere(config, group);
    expect(where).toContain('$1');
    expect(values).toEqual(['cust']);
  });

  it('renders a pure jsonb tree, delegating param shape to jsonb-query', () => {
    const group: PgFilterGroup = {
      logic: 'and',
      filters: [{ target: 'jsonb', field: 'score', dataType: 'numeric', operator: 'gt', value: 80 }],
    };
    const { where, values } = buildPgWhere(config, group);
    expect(where).toContain('data');
    expect(where).toContain('$1');
    expect(where).toContain('$2');
    // jsonpath dialect emits 2 params per scalar leaf: a jsonpath string + a {v} vars object
    expect(values).toHaveLength(2);
    expect(values[0]).toContain('score');
    expect(values[1]).toEqual({ v: 80 });
  });

  it('mixes column + jsonb leaves with contiguous, non-colliding params across the boundary', () => {
    const group: PgFilterGroup = {
      logic: 'and',
      filters: [
        { target: 'column', column: 'name', operator: 'contains', value: 'cust' },
        {
          logic: 'or',
          filters: [
            { target: 'jsonb', field: 'score', dataType: 'numeric', operator: 'gt', value: 80 },
            { target: 'column', column: 'createdAt', operator: 'gt', value: '2026-01-01' },
          ],
        },
      ],
    };
    const { where, values } = buildPgWhere(config, group);
    // column 'cust' → $1 ; jsonb leaf → $2,$3 (jsonpath path + vars) ; column date → $4
    expect(values).toHaveLength(4);
    expect(values[0]).toBe('cust');
    expect(values[3]).toBe('2026-01-01');
    for (const ph of ['$1', '$2', '$3', '$4']) expect(where).toContain(ph);
    expect(where).not.toContain('$5');
  });

  it('honours a starting paramOffset', () => {
    const group: PgFilterGroup = {
      logic: 'and',
      filters: [{ target: 'column', column: 'name', operator: 'eq', value: 'x' }],
    };
    const { where, values } = buildPgWhere(config, group, 5);
    expect(where).toContain('$6');
    expect(values).toEqual(['x']);
  });

  it('returns identity for an empty group', () => {
    expect(buildPgWhere(config, { logic: 'and', filters: [] }).where).toBe('true');
    expect(buildPgWhere(config, { logic: 'or', filters: [] }).where).toBe('false');
  });

  it('throws INVALID_TARGET for an unknown leaf target', () => {
    const bad = { logic: 'and', filters: [{ target: 'evil', column: 'name', operator: 'eq', value: 1 }] };
    expect(() => buildPgWhere(config, bad as unknown as PgFilterGroup)).toThrow(PgFilterError);
  });

  it('rejects an unknown column (sql-filter ColumnQueryError propagates)', () => {
    const group = { logic: 'and', filters: [{ target: 'column', column: 'nope', operator: 'eq', value: 1 }] };
    expect(() => buildPgWhere(config, group as PgFilterGroup)).toThrow();
  });
});
