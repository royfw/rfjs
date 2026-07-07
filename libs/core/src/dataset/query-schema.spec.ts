import { describe, it, expect } from 'vitest';
import { QueryDatasetsBodySchema } from './query-schema';

describe('QueryDatasetsBodySchema', () => {
  it('accepts a mixed column+jsonb filter with sort and applies pagination defaults', () => {
    const parsed = QueryDatasetsBodySchema.parse({
      filter: {
        logic: 'and',
        filters: [
          { target: 'column', column: 'name', operator: 'contains', value: 'cust' },
          { target: 'jsonb', field: 'score', dataType: 'numeric', operator: 'gt', value: 80 },
        ],
      },
      sort: [{ target: 'jsonb', field: 'score', dataType: 'numeric', direction: 'desc' }],
    });
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.filter?.filters.length).toBe(2);
  });

  it('accepts an empty body (all optional, paginated by default)', () => {
    const parsed = QueryDatasetsBodySchema.parse({});
    expect(parsed).toEqual({ page: 1, pageSize: 20 });
  });

  it('clamps pageSize to a max of 100 by rejecting larger values', () => {
    expect(() => QueryDatasetsBodySchema.parse({ pageSize: 101 })).toThrow();
  });

  it('rejects an unknown leaf target', () => {
    expect(() =>
      QueryDatasetsBodySchema.parse({ filter: { logic: 'and', filters: [{ target: 'evil' }] } }),
    ).toThrow();
  });

  it('rejects an invalid logic', () => {
    expect(() => QueryDatasetsBodySchema.parse({ filter: { logic: 'xor', filters: [] } })).toThrow();
  });

  it('rejects unknown/misspelled keys on a leaf (strict) instead of silently dropping them', () => {
    expect(() =>
      QueryDatasetsBodySchema.parse({
        filter: {
          logic: 'and',
          filters: [{ target: 'column', column: 'name', operator: 'eq', value: 'x', feild: 'oops' }],
        },
      }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(() => QueryDatasetsBodySchema.parse({ limt: 5 })).toThrow();
  });
});
