import { describe, it, expect } from "vitest";
import { GET, POST } from "./route";

const ctx = (resource: string) => ({ params: Promise.resolve({ resource }) });

describe("GET /api/query/[resource]", () => {
  it("returns { data:{items,total} } from querystring params", async () => {
    const res = await GET(new Request("http://t/api/query/sample?limit=5&offset=0"), ctx("sample"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { items: unknown[]; total: number } };
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(json.data.total).toBeGreaterThan(0);
  });

  it("applies a filter passed on the querystring", async () => {
    const filter = encodeURIComponent(JSON.stringify({ logic: "and", filters: [{ target: "column", column: "status", operator: "eq", value: "published" }] }));
    const res = await GET(new Request(`http://t/api/query/sample?limit=50&filter=${filter}`), ctx("sample"));
    const json = (await res.json()) as { data: { items: { status: string }[]; total: number } };
    expect(json.data.items.every((r) => r.status === "published")).toBe(true);
  });

  it("404 unknown resource; ?error=500 → 500; ?empty=1 → 0 items", async () => {
    expect((await GET(new Request("http://t/api/query/nope"), ctx("nope"))).status).toBe(404);
    expect((await GET(new Request("http://t/api/query/sample?error=500"), ctx("sample"))).status).toBe(500);
    const empty = await GET(new Request("http://t/api/query/sample?empty=1"), ctx("sample"));
    expect(((await empty.json()) as { data: { total: number } }).data.total).toBe(0);
  });

  it("400 on a malformed ?filter", async () => {
    const res = await GET(new Request("http://t/api/query/sample?filter=not-json"), ctx("sample"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/query/[resource]", () => {
  it("reads params + filter from the body", async () => {
    const req = new Request("http://t/api/query/sample", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: "5", offset: "0", filter: { logic: "and", filters: [] } }),
    });
    const res = await POST(req, ctx("sample"));
    const json = (await res.json()) as { data: { items: unknown[] } };
    expect(json.data.items.length).toBeLessThanOrEqual(5);
  });
});
