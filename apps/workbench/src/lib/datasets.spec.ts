import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchDatasets } from "./datasets";

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
