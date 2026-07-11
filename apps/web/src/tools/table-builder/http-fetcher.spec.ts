import { describe, it, expect, vi } from "vitest";
import { makeHttpFetcher } from "./http-fetcher";

describe("makeHttpFetcher", () => {
  it("POSTs the built request as JSON and returns parsed json", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { items: [], total: 0 } }) });
    vi.stubGlobal("fetch", fetchMock);
    const fetcher = makeHttpFetcher("/api/query/sample");
    const built = { endpoint: "/api/query/sample", method: "POST", params: { page: "1" }, filter: undefined };
    const out = await fetcher(built as never);
    expect(fetchMock).toHaveBeenCalledWith("/api/query/sample", expect.objectContaining({ method: "POST" }));
    const sentBody = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sentBody.params).toEqual({ page: "1" });
    expect(out).toEqual({ data: { items: [], total: 0 } });
    vi.unstubAllGlobals();
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const fetcher = makeHttpFetcher("/api/query/sample");
    await expect(fetcher({ params: {} } as never)).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});
