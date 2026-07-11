import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_PROXY_BASE_URL;
  delete process.env.AI_PROXY_API_KEY;
  delete process.env.AI_PROXY_MODEL;
});

function req(body: unknown) {
  return new Request("http://web.local/api/ai/chat/completions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("ai proxy reference route", () => {
  it("returns 501 when AI_PROXY_* env is not configured (disabled by default)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ messages: [] }));
    expect(res.status).toBe(501);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards with server credentials when env is configured", async () => {
    process.env.AI_PROXY_BASE_URL = "http://gw.local/v1";
    process.env.AI_PROXY_API_KEY = "sk-server";
    process.env.AI_PROXY_MODEL = "server-model";
    const upstream = new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      req({ model: "client", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://gw.local/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-server",
    );
  });
});
