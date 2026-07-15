import { describe, it, expect, vi } from 'vitest';
import { fromElasticClient } from './elasticsearch';

describe('fromElasticClient', () => {
  it('search spreads body and returns the response directly', async () => {
    const search = vi.fn().mockResolvedValue({ took: 1, hits: { total: { value: 0, relation: 'eq' }, hits: [] } });
    const t = fromElasticClient({ search } as never);
    await t.search({ index: 'i', body: { query: { match_all: {} }, size: 5 } });
    expect(search).toHaveBeenCalledWith({ index: 'i', query: { match_all: {} }, size: 5 });
  });

  it('count returns the numeric count', async () => {
    const count = vi.fn().mockResolvedValue({ count: 9 });
    const t = fromElasticClient({ count } as never);
    expect(await t.count({ index: 'i' })).toBe(9);
  });

  it('openPit/closePit map to point-in-time API', async () => {
    const openPointInTime = vi.fn().mockResolvedValue({ id: 'pit-x' });
    const closePointInTime = vi.fn().mockResolvedValue({ succeeded: true });
    const t = fromElasticClient({ openPointInTime, closePointInTime } as never);
    expect(await t.openPit({ index: 'i', keepAlive: '1m' })).toBe('pit-x');
    expect(openPointInTime).toHaveBeenCalledWith({ index: 'i', keep_alive: '1m' });
    await t.closePit('pit-x');
    expect(closePointInTime).toHaveBeenCalledWith({ id: 'pit-x' });
  });

  it('msearch maps searches and returns responses', async () => {
    const msearch = vi.fn().mockResolvedValue({ responses: [{ hits: { total: { value: 0, relation: 'eq' }, hits: [] } }] });
    const t = fromElasticClient({ msearch } as never);
    const out = await t.msearch({ body: [{ index: 'i' }, { query: {} }] });
    expect(msearch).toHaveBeenCalledWith({ searches: [{ index: 'i' }, { query: {} }] });
    expect(out).toHaveLength(1);
  });
});
