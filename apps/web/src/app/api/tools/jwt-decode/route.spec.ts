import { describe, it, expect } from "vitest";
import { Jwt } from "@rfjs/jwt";

import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://test/api/tools/jwt-decode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/tools/jwt-decode", () => {
  it("decodes a valid token", async () => {
    const token = Jwt.initial("secret").createToken({ id: 1 });
    const res = await post({ token });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.header).toMatchObject({ alg: "HS256" });
    expect(json.payload).toMatchObject({ id: 1 });
    expect(typeof json.signature).toBe("string");
  });

  it("returns ok:false for a malformed token", async () => {
    const res = await post({ token: "not-a-jwt" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: "invalidJwt" });
  });

  it("returns 400 for a bad body", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "badRequest" });
  });

  it("returns 400 for a non-JSON body", async () => {
    const res = await POST(
      new Request("http://test/api/tools/jwt-decode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
