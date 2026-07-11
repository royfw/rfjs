import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearAiSettings, saveAiSettings } from "@rfjs/ai-assist";
import { useAiAssist } from "./use-ai-assist";

function okResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
  });
}

beforeEach(() => {
  localStorage.clear();
  saveAiSettings({ baseUrl: "http://ai.local/v1", apiKey: "k", model: "m" });
});
afterEach(() => vi.unstubAllGlobals());

describe("useAiAssist", () => {
  it("ready reflects configuration", () => {
    localStorage.clear();
    const { result } = renderHook(() => useAiAssist());
    expect(result.current.ready).toBe(false);
  });

  it("ready flips live when settings are saved/cleared without a remount", async () => {
    localStorage.clear();
    const { result } = renderHook(() => useAiAssist());
    expect(result.current.ready).toBe(false);
    act(() =>
      saveAiSettings({
        baseUrl: "http://ai.local/v1",
        apiKey: "k",
        model: "m",
      }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => clearAiSettings());
    await waitFor(() => expect(result.current.ready).toBe(false));
  });

  it("run: completes, parses, returns T, clears error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse('{"a":1}')));
    const { result } = renderHook(() => useAiAssist());
    let out: unknown;
    await act(async () => {
      out = await result.current.run(
        { system: "s", user: "u", json: true },
        (raw) => JSON.parse(raw),
      );
    });
    expect(out).toEqual({ a: 1 });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("runStream: streams deltas into streamText and returns the full parsed text", async () => {
    const enc = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
      "data: [DONE]\n",
    ];
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: async () =>
              i < chunks.length
                ? { done: false, value: enc.encode(chunks[i++]) }
                : { done: true, value: undefined },
          }),
        },
      }),
    );
    const { result } = renderHook(() => useAiAssist());
    let out: unknown;
    await act(async () => {
      out = await result.current.runStream({ system: "s", user: "u" }, (raw) =>
        raw.trim(),
      );
    });
    expect(out).toBe("Hello");
    // 完成後 streamText 清空(內容已落入呼叫端的紀錄堆疊)
    expect(result.current.streamText).toBe("");
    expect(result.current.loading).toBe(false);
  });

  it("run: parse gate rejection lands in error and returns null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse("garbage")));
    const { result } = renderHook(() => useAiAssist());
    let out: unknown = "sentinel";
    await act(async () => {
      out = await result.current.run({ system: "s", user: "u" }, () => {
        throw new Error("invalid tree");
      });
    });
    expect(out).toBeNull();
    await waitFor(() => expect(result.current.error?.kind).toBe("parse"));
  });

  it("cancel: aborts without setting error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_u, init) =>
          new Promise((_res, rej) => {
            (init as RequestInit).signal?.addEventListener("abort", () =>
              rej(Object.assign(new Error("aborted"), { name: "AbortError" })),
            );
          }),
      ),
    );
    const { result } = renderHook(() => useAiAssist());
    let p: Promise<unknown>;
    act(() => {
      p = result.current.run({ system: "s", user: "u" }, (r) => r);
    });
    act(() => result.current.cancel());
    await act(async () => {
      expect(await p!).toBeNull();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("a superseded run does not clobber the surviving run loading state", async () => {
    let resolveSecond!: (r: Response) => void;
    const fetchMock = vi
      .fn()
      // 第一個 run:掛住直到被 abort
      .mockImplementationOnce(
        (_u, init) =>
          new Promise((_res, rej) => {
            (init as RequestInit).signal?.addEventListener("abort", () =>
              rej(Object.assign(new Error("aborted"), { name: "AbortError" })),
            );
          }),
      )
      // 第二個 run:等我們手動放行
      .mockImplementationOnce(
        () => new Promise((res) => (resolveSecond = res)),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAiAssist());
    let p1: Promise<unknown>, p2: Promise<unknown>;
    act(() => {
      p1 = result.current.run({ system: "s", user: "a" }, (r) => r);
    });
    // async auth adds a microtask before fetch(); let run1 reach its fetch (mock #1)
    // before run2 supersedes it, otherwise the pre-fetch abort guard skips run1's
    // fetch entirely and run2 would consume mock #1.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    act(() => {
      p2 = result.current.run({ system: "s", user: "b" }, (r) => r); // 取消 run1
    });
    await act(async () => {
      expect(await p1!).toBeNull(); // run1 被取代
    });
    expect(result.current.loading).toBe(true); // ← 沒有 fix 時這裡會是 false
    await act(async () => {
      resolveSecond(okResponse("done"));
      expect(await p2!).toBe("done");
    });
    expect(result.current.loading).toBe(false);
  });
});
