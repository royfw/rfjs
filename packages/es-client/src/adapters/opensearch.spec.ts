import { describe, it, expect, vi } from 'vitest';
import { fromOpenSearchClient } from './opensearch';

describe('fromOpenSearchClient', () => {
  it('search passes { index, body } and unwraps body', async () => {
    const search = vi.fn().mockResolvedValue({ body: { took: 1, hits: { total: { value: 0, relation: 'eq' }, hits: [] } } });
    const t = fromOpenSearchClient({ search } as never);
    const res = await t.search({ index: 'i', body: { query: { match_all: {} } } });
    expect(search).toHaveBeenCalledWith({ index: 'i', body: { query: { match_all: {} } } });
    expect(res.took).toBe(1);
  });

  it('count unwraps body.count', async () => {
    const count = vi.fn().mockResolvedValue({ body: { count: 4 } });
    const t = fromOpenSearchClient({ count } as never);
    expect(await t.count({ index: 'i' })).toBe(4);
  });

  it('openPit/closePit map to createPit/deletePit', async () => {
    const createPit = vi.fn().mockResolvedValue({ body: { pit_id: 'pid-1' } });
    const deletePit = vi.fn().mockResolvedValue({ body: {} });
    const t = fromOpenSearchClient({ createPit, deletePit } as never);
    expect(await t.openPit({ index: 'i', keepAlive: '2m' })).toBe('pid-1');
    expect(createPit).toHaveBeenCalledWith({ index: 'i', keep_alive: '2m' });
    await t.closePit('pid-1');
    expect(deletePit).toHaveBeenCalledWith({ body: { pit_id: ['pid-1'] } });
  });
});
