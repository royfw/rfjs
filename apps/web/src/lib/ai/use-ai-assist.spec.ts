import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveAiSettings } from './settings';
import { useAiAssist } from './use-ai-assist';

function okResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

beforeEach(() => {
  localStorage.clear();
  saveAiSettings({ baseUrl: 'http://ai.local/v1', apiKey: 'k', model: 'm' });
});
afterEach(() => vi.unstubAllGlobals());

describe('useAiAssist', () => {
  it('ready reflects configuration', () => {
    localStorage.clear();
    const { result } = renderHook(() => useAiAssist());
    expect(result.current.ready).toBe(false);
  });

  it('run: completes, parses, returns T, clears error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse('{"a":1}')));
    const { result } = renderHook(() => useAiAssist());
    let out: unknown;
    await act(async () => {
      out = await result.current.run({ system: 's', user: 'u', json: true }, (raw) => JSON.parse(raw));
    });
    expect(out).toEqual({ a: 1 });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('run: parse gate rejection lands in error and returns null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse('garbage')));
    const { result } = renderHook(() => useAiAssist());
    let out: unknown = 'sentinel';
    await act(async () => {
      out = await result.current.run({ system: 's', user: 'u' }, () => {
        throw new Error('invalid tree');
      });
    });
    expect(out).toBeNull();
    await waitFor(() => expect(result.current.error?.kind).toBe('parse'));
  });

  it('cancel: aborts without setting error', async () => {
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
    const { result } = renderHook(() => useAiAssist());
    let p: Promise<unknown>;
    act(() => {
      p = result.current.run({ system: 's', user: 'u' }, (r) => r);
    });
    act(() => result.current.cancel());
    await act(async () => {
      expect(await p!).toBeNull();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('a superseded run does not clobber the surviving run loading state', async () => {
    let resolveSecond!: (r: Response) => void;
    const fetchMock = vi
      .fn()
      // 第一個 run:掛住直到被 abort
      .mockImplementationOnce((_u, init) =>
        new Promise((_res, rej) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            rej(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
      )
      // 第二個 run:等我們手動放行
      .mockImplementationOnce(() => new Promise((res) => (resolveSecond = res)));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAiAssist());
    let p1: Promise<unknown>, p2: Promise<unknown>;
    act(() => {
      p1 = result.current.run({ system: 's', user: 'a' }, (r) => r);
    });
    act(() => {
      p2 = result.current.run({ system: 's', user: 'b' }, (r) => r); // 取消 run1
    });
    await act(async () => {
      expect(await p1!).toBeNull(); // run1 被取代
    });
    expect(result.current.loading).toBe(true); // ← 沒有 fix 時這裡會是 false
    await act(async () => {
      resolveSecond(okResponse('done'));
      expect(await p2!).toBe('done');
    });
    expect(result.current.loading).toBe(false);
  });
});
