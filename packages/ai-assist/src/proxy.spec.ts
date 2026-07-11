import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAiProxyHandler } from './proxy';

const SETTINGS = {
  baseUrl: 'http://gw.local/v1',
  apiKey: 'sk-server',
  model: 'server-model',
};

function req(body: unknown) {
  return new Request('http://app.local/api/ai/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('createAiProxyHandler', () => {
  it('forwards to the gateway with server auth and overrides the model', async () => {
    const upstream = new Response(
      JSON.stringify({ choices: [{ message: { content: 'hi' } }] }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal('fetch', fetchMock);
    const handler = createAiProxyHandler({ getServerSettings: () => SETTINGS });
    const res = await handler(
      req({ model: 'client-suggested', messages: [{ role: 'system', content: 's' }] }),
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://gw.local/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-server',
    );
    const sent = JSON.parse(init.body as string);
    expect(sent.model).toBe('server-model'); // server wins over client suggestion
  });

  it('returns 501 (no fetch) when getServerSettings yields null', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const handler = createAiProxyHandler({ getServerSettings: () => null });
    const res = await handler(req({ messages: [] }));
    expect(res.status).toBe(501);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes upstream status and streaming content-type straight through', async () => {
    const upstream = new Response('data: {"choices":[{"delta":{"content":"x"}}]}\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream));
    const handler = createAiProxyHandler({ getServerSettings: () => SETTINGS });
    const res = await handler(req({ stream: true, messages: [] }));
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(await res.text()).toContain('delta');
  });
});
