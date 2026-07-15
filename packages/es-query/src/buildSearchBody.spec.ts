import { describe, it, expect } from 'vitest';
import { buildSearchBody } from './buildSearchBody';
import type { EsFilterMetadata } from './types';

const meta: EsFilterMetadata = {
  logic: 'and',
  filters: [{ field: 'status', condition: 'eq', value: 'open' }],
};

describe('buildSearchBody', () => {
  it('wraps query with no options', () => {
    expect(buildSearchBody(meta)).toEqual({
      query: { bool: { must: [{ term: { status: 'open' } }] } },
    });
  });

  it('adds sort, size, from, search_after', () => {
    expect(
      buildSearchBody(meta, {
        sort: [{ field: 'createdAt', order: 'desc' }],
        size: 20,
        from: 40,
        searchAfter: ['2020-01-01', 'id-1'],
      }),
    ).toEqual({
      query: { bool: { must: [{ term: { status: 'open' } }] } },
      sort: [{ createdAt: { order: 'desc' } }],
      size: 20,
      from: 40,
      search_after: ['2020-01-01', 'id-1'],
    });
  });
});
