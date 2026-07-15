import { describe, expect, it } from "vitest";

import { buildNlFormPrompt, parseNlFormResponse } from "./ai-nl-form";

describe("buildNlFormPrompt", () => {
  it("describes the formconfig shape and component whitelist", () => {
    const p = buildNlFormPrompt("a leave request form");
    expect(p.system).toContain('"version"');
    expect(p.system).toContain("Input");
    expect(p.user).toBe("a leave request form");
  });
});

describe("parseNlFormResponse (gate = jsonToCards/parseFormConfig)", () => {
  it("accepts a minimal valid formconfig", () => {
    const raw = JSON.stringify({
      version: 1,
      fields: [{ key: "name", label: "Name", component: "Input", dataType: "string" }],
    });
    const out = parseNlFormResponse(raw);
    expect(JSON.parse(out).version).toBe(1);
  });

  it("rejects non-json and invalid configs", () => {
    expect(() => parseNlFormResponse("nope")).toThrow();
    expect(() => parseNlFormResponse('{"version":99,"fields":"x"}')).toThrow();
  });
});
