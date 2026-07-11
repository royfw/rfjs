import { describe, it, expect } from "vitest";
import { POST } from "./route";

function post(resource: string, body: unknown, search = ""): Promise<Response> {
  const req = new Request(`http://t/api/query/${resource}${search}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req, { params: Promise.resolve({ resource }) });
}

describe("POST /api/query/[resource]", () => {
  it("returns { data: { items, total } } for the sample resource", async () => {
    const res = await post("sample", { params: {} });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { items: unknown[]; total: number } };
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(json.data.total).toBeGreaterThan(0);
  });

  it("404 for unknown resource", async () => {
    const res = await post("nope", { params: {} });
    expect(res.status).toBe(404);
  });

  it("?error=500 → 500", async () => {
    const res = await post("sample", { params: {} }, "?error=500");
    expect(res.status).toBe(500);
  });

  it("?empty=1 → 0 items", async () => {
    const res = await post("sample", { params: {} }, "?empty=1");
    const json = (await res.json()) as { data: { items: unknown[]; total: number } };
    expect(json.data.items).toHaveLength(0);
    expect(json.data.total).toBe(0);
  });
});
