import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchDatasets, queryDatasets } from "./datasets";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDatasets", () => {
  it("returns ok with datasets on a 2xx response", async () => {
    const rows = [{ id: "1", name: "A", description: null }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(rows) }),
    );
    expect(await fetchDatasets()).toEqual({ ok: true, datasets: rows });
  });

  it("returns ok with an empty array when the API has no datasets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }),
    );
    expect(await fetchDatasets()).toEqual({ ok: true, datasets: [] });
  });

  it("returns not-ok on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }),
    );
    expect(await fetchDatasets()).toEqual({ ok: false });
  });

  it("returns not-ok when fetch throws (API unreachable)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await fetchDatasets()).toEqual({ ok: false });
  });
});

describe("queryDatasets", () => {
  const body = { page: 1, pageSize: 20 } as const;

  it("returns ok with the query result on a 2xx response", async () => {
    const result = { items: [{ id: "1", name: "A", description: null, data: {}, createdAt: "x", updatedAt: "y" }], total: 1, page: 1, pageSize: 20 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(result) }));
    expect(await queryDatasets(body)).toEqual({ ok: true, result });
  });

  it("returns ok with empty items when nothing matches", async () => {
    const result = { items: [], total: 0, page: 1, pageSize: 20 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(result) }));
    expect(await queryDatasets(body)).toEqual({ ok: true, result });
  });

  it("returns not-ok on a non-2xx response (e.g. 400)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ message: "bad" }) }));
    expect(await queryDatasets(body)).toEqual({ ok: false });
  });

  it("returns not-ok when fetch throws (API unreachable)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await queryDatasets(body)).toEqual({ ok: false });
  });

  it("POSTs to /datasets/query with the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20 }) });
    vi.stubGlobal("fetch", fetchMock);
    await queryDatasets(body);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/datasets\/query$/);
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(init.body)).toEqual(body);
  });
});
