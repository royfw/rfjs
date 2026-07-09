import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAiClient, listAiModels } from './client';
import { AiError } from './types';

const SETTINGS = { baseUrl: 'http://ai.local/v1', apiKey: 'sk-t', model: 'm1' };

function okResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('createAiClient.complete', () => {
  it('posts an openai-compatible chat body and returns the content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('hello'));
    vi.stubGlobal('fetch', fetchMock);
    const out = await createAiClient(SETTINGS).complete({ system: 'sys', user: 'usr' });
    expect(out).toBe('hello');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://ai.local/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer sk-t' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('m1');
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ]);
    expect(body.response_format).toBeUndefined();
  });

  it('json:true adds response_format json_object', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await createAiClient(SETTINGS).complete({ system: 's', user: 'u', json: true });
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('http error → AiError kind http with status detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    await expect(createAiClient(SETTINGS).complete({ system: 's', user: 'u' })).rejects.toMatchObject({
      name: 'AiError',
      kind: 'http',
    });
  });

  it('malformed success payload → AiError kind parse', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"weird":true}', { status: 200 })));
    await expect(createAiClient(SETTINGS).complete({ system: 's', user: 'u' })).rejects.toMatchObject({
      kind: 'parse',
    });
  });

  it('external abort → AiError kind abort', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_u, init) =>
        new Promise((_res, rej) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            rej(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
      ),
    );
    const ctl = new AbortController();
    const p = createAiClient(SETTINGS).complete({ system: 's', user: 'u', signal: ctl.signal });
    ctl.abort();
    await expect(p).rejects.toMatchObject({ kind: 'abort' });
  });

  it('timeout → AiError kind timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_u, init) =>
        new Promise((_res, rej) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            rej(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
      ),
    );
    const p = createAiClient(SETTINGS).complete({ system: 's', user: 'u', timeoutMs: 1000 });
    const assertion = expect(p).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    vi.useRealTimers();
  });

  it('missing settings fields → AiError kind config (no fetch)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      createAiClient({ baseUrl: '', apiKey: '', model: '' }).complete({ system: 's', user: 'u' }),
    ).rejects.toMatchObject({ kind: 'config' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(new AiError('config', 'x')).toBeInstanceOf(Error);
  });
});

describe('listAiModels', () => {
  it('GETs {baseUrl}/models with bearer auth and returns sorted ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'zeta' }, { id: 'alpha' }, { id: 42 }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const ids = await listAiModels({ baseUrl: 'http://ai.local/v1/', apiKey: 'sk-t' });
    expect(ids).toEqual(['alpha', 'zeta']); // sorted, non-string ids dropped
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://ai.local/v1/models'); // trailing slash stripped
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-t');
  });

  it('omits the auth header when apiKey is empty (keyless local endpoints)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await listAiModels({ baseUrl: 'http://ai.local/v1', apiKey: '' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('http error → AiError kind http with response body as detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('invalid key', { status: 401 })),
    );
    await expect(listAiModels({ baseUrl: 'http://ai.local/v1', apiKey: 'bad' })).rejects.toMatchObject(
      { kind: 'http', detail: 'invalid key' },
    );
  });

  it('unexpected payload shape → AiError kind parse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [] }), { status: 200 })),
    );
    await expect(listAiModels({ baseUrl: 'http://ai.local/v1', apiKey: 'k' })).rejects.toMatchObject(
      { kind: 'parse' },
    );
  });

  it('empty baseUrl → AiError kind config (no fetch)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(listAiModels({ baseUrl: '', apiKey: 'k' })).rejects.toMatchObject({
      kind: 'config',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/** 造一個假的 SSE Response:body.getReader() 逐塊吐出 UTF-8 bytes。 */
function sseResponse(chunks: string[]) {
  const enc = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true, value: undefined },
      }),
    },
  } as unknown as Response;
}

describe('createAiClient.stream', () => {
  it('parses SSE content deltas, forwards reasoning, returns the full text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n',
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: [DONE]\n',
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const deltas: { content?: string; reasoning?: string }[] = [];
    const full = await createAiClient(SETTINGS).stream({ system: 's', user: 'u' }, (d) => deltas.push(d));
    expect(full).toBe('Hello');
    expect(deltas).toEqual([{ content: undefined, reasoning: 'think' }, { content: 'Hel', reasoning: undefined }, { content: 'lo', reasoning: undefined }]);
    // 請求體帶 stream:true
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.stream).toBe(true);
  });

  it('tolerates a malformed chunk and keeps reading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(sseResponse(['data: {bad json\n', 'data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n'])),
    );
    const full = await createAiClient(SETTINGS).stream({ system: 's', user: 'u' }, () => {});
    expect(full).toBe('ok');
  });

  it('http error → AiError kind http', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    await expect(createAiClient(SETTINGS).stream({ system: 's', user: 'u' }, () => {})).rejects.toMatchObject({ kind: 'http' });
  });
});
