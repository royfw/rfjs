import { describe, expect, it } from "vitest";

import type { DataResourceMeta } from "@rfjs/data-schema";

import { buildMetaAskPrompt, buildNlMetaPrompt, parseNlMetaResponse } from "./ai-nl-meta";

const META: DataResourceMeta = {
  fields: [{ key: "price", label: "Price", dataType: "numeric", filterable: true, kind: "column" }],
};
const VALID_JSON = JSON.stringify(META);

describe("buildNlMetaPrompt", () => {
  it("embeds the current meta, the kind semantics, and full-document instruction; user is the raw nl", () => {
    const p = buildNlMetaPrompt("add an order id field", META);
    expect(p.system).toContain('"price"'); // current meta embedded
    expect(p.system).toContain("column"); // kind semantics explained
    expect(p.system).toContain("jsonb");
    expect(p.system).toContain("FULL"); // full-document (not patch) instruction
    expect(p.user).toBe("add an order id field");
  });
});

describe("buildMetaAskPrompt", () => {
  it("embeds meta json and locale in system; user is the question", () => {
    const p = buildMetaAskPrompt({ metaJson: VALID_JSON, locale: "zh-TW" }, "這個資源有哪些欄位?");
    expect(p.system).toContain(VALID_JSON);
    expect(p.system).toContain("zh-TW");
    expect(p.user).toBe("這個資源有哪些欄位?");
  });
});

describe("parseNlMetaResponse", () => {
  it("accepts a valid meta and returns normalized json", () => {
    const out = parseNlMetaResponse(VALID_JSON);
    expect(JSON.parse(out)).toEqual(META);
  });

  it("strips a markdown code fence before parsing", () => {
    const out = parseNlMetaResponse("```json\n" + VALID_JSON + "\n```");
    expect(JSON.parse(out)).toEqual(META);
  });

  it("throws on malformed json", () => {
    expect(() => parseNlMetaResponse("not json {")).toThrow();
  });

  it("throws on schema-invalid meta (format incompatible with dataType)", () => {
    const bad = JSON.stringify({ fields: [{ key: "a", label: "A", dataType: "string", format: "currency" }] });
    expect(() => parseNlMetaResponse(bad)).toThrow();
  });

  it("accepts an optional request/response protocol", () => {
    const withProto = JSON.stringify({
      fields: [{ key: "a", label: "A", dataType: "string" }],
      request: { endpoint: "/api/x", pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" } },
      response: { rowsPath: "data.items" },
    });
    expect(JSON.parse(parseNlMetaResponse(withProto)).request.endpoint).toBe("/api/x");
  });
});
