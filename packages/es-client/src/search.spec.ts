import { describe, it, expect, vi } from 'vitest';
import { search, count, msearch } from './search';
import type { SearchTransport, EsSearchResponse } from './types';

function resp<T>(sources: T[]): EsSearchResponse<T> {
  return {
    took: 1,
    timed_out: false,
    hits: {
      total: { value: sources.length, relation: 'eq' },
      max_score: 1,
      hits: sources.map((s, i) => ({ _index: 'i', _id: String(i), _score: 1, _source: s })),
    },
  };
}

describe('search wrappers', () => {
  it('search → total/hits/sources', async () => {
    const transport = { search: vi.fn().mockResolvedValue(resp([{ a: 1 }, { a: 2 }])) } as unknown as SearchTransport;
    const r = await search<{ a: number }>(transport, { index: 'i', body: { query: { bool: {} } } as never });
    expect(r.total).toBe(2);
    expect(r.sources).toEqual([{ a: 1 }, { a: 2 }]);
    expect(r.hits).toHaveLength(2);
  });

  it('count → number', async () => {
    const transport = { count: vi.fn().mockResolvedValue(7) } as unknown as SearchTransport;
    expect(await count(transport, { index: 'i' })).toBe(7);
  });

  it('msearch builds header+body pairs and maps responses', async () => {
    const msearchFn = vi.fn().mockResolvedValue([resp([{ a: 1 }]), resp([{ a: 2 }])]);
    const transport = { msearch: msearchFn } as unknown as SearchTransport;
    const r = await msearch<{ a: number }>(transport, [
      { index: 'i1', body: { query: {} } as never },
      { index: 'i2', body: { query: {} } as never },
    ]);
    expect(msearchFn).toHaveBeenCalledWith({
      body: [{ index: 'i1' }, { query: {} }, { index: 'i2' }, { query: {} }],
    });
    expect(r.map((x) => x.sources)).toEqual([[{ a: 1 }], [{ a: 2 }]]);
  });
});
