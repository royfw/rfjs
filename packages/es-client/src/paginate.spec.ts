import { describe, it, expect, vi } from 'vitest';
import { paginateAll } from './paginate';
import type { SearchTransport, EsHit, EsSearchResponse } from './types';

function page(ids: number[]): EsSearchResponse<{ n: number }> {
  return {
    took: 1,
    timed_out: false,
    hits: {
      total: { value: 0, relation: 'gte' },
      max_score: null,
      hits: ids.map((n) => ({ _index: 'i', _id: String(n), _score: null, _source: { n }, sort: [n] })),
    },
  };
}

describe('paginateAll', () => {
  it('walks pages via search_after until a short page, then closes the PIT', async () => {
    const openPit = vi.fn().mockResolvedValue('pit-1');
    const closePit = vi.fn().mockResolvedValue(undefined);
    const searchFn = vi
      .fn()
      .mockResolvedValueOnce(page([1, 2]))
      .mockResolvedValueOnce(page([3]));
    const transport = { openPit, closePit, search: searchFn } as unknown as SearchTransport;

    const batches: EsHit<{ n: number }>[][] = [];
    for await (const b of paginateAll<{ n: number }>(transport, { index: 'i', body: { query: { match_all: {} } }, pageSize: 2 })) {
      batches.push(b);
    }

    expect(batches.map((b) => b.map((h) => h._source.n))).toEqual([[1, 2], [3]]);
    expect(openPit).toHaveBeenCalledWith({ index: 'i', keepAlive: '1m' });
    expect(searchFn.mock.calls[1][0].body.search_after).toEqual([2]);
    expect(closePit).toHaveBeenCalledWith('pit-1');
  });

  it('closes the PIT even when search throws', async () => {
    const closePit = vi.fn().mockResolvedValue(undefined);
    const transport = {
      openPit: vi.fn().mockResolvedValue('pit-err'),
      closePit,
      search: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as SearchTransport;

    await expect(async () => {
      for await (const _ of paginateAll(transport, { index: 'i', body: {} })) void _;
    }).rejects.toThrow('boom');
    expect(closePit).toHaveBeenCalledWith('pit-err');
  });
});
