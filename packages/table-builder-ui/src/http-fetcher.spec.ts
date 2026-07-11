import { describe, it, expect, vi } from 'vitest';
import type { RequestMeta } from '@rfjs/data-schema';
import { makeHttpFetcher } from './http-fetcher';

const getReq: RequestMeta = {
  endpoint: '/api/query/sample',
  method: 'GET',
  pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
  filter: { style: 'pg', param: 'filter' },
};

describe('makeHttpFetcher', () => {
  it('GET: params + filter ride the querystring', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { items: [], total: 0 } }) });
    vi.stubGlobal('fetch', fetchMock);
    const built = { endpoint: '/api/query/sample', method: 'GET', params: { limit: '10', offset: '0' }, filter: { logic: 'and', filters: [] } };
    await makeHttpFetcher(getReq)(built as never);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/api/query/sample?');
    expect(url).toContain('limit=10');
    expect(url).toContain('filter=');
    expect(fetchMock.mock.calls[0]![1].method).toBe('GET');
    vi.unstubAllGlobals();
  });

  it('POST: params + filter ride the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: {} }) });
    vi.stubGlobal('fetch', fetchMock);
    const postReq: RequestMeta = { ...getReq, method: 'POST' };
    const built = { endpoint: '/api/query/sample', method: 'POST', params: { limit: '10' }, filter: { logic: 'and', filters: [] } };
    await makeHttpFetcher(postReq)(built as never);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.limit).toBe('10');
    expect(body.filter).toEqual({ logic: 'and', filters: [] });
    vi.unstubAllGlobals();
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(makeHttpFetcher(getReq)({ endpoint: '/x', method: 'GET', params: {} } as never)).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});
