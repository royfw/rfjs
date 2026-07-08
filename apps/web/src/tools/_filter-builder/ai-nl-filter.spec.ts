import { describe, expect, it } from "vitest";

import { buildNlFilterPrompt, parseNlFilterResponse } from "./ai-nl-filter";

const SCHEMA = [
  { path: "amount", dataType: "numeric", include: true, kind: "jsonb" },
  { path: "dept", dataType: "string", include: true, kind: "jsonb" },
] as never;

describe("buildNlFilterPrompt", () => {
  it("embeds the field list and the user text", () => {
    const p = buildNlFilterPrompt("amount over 100", SCHEMA);
    expect(p.system).toContain("amount");
    expect(p.system).toContain("dept");
    expect(p.system).toContain("logic");
    expect(p.user).toBe("amount over 100");
  });
});

describe("parseNlFilterResponse (validation gate)", () => {
  it("accepts a valid filter group and returns pretty json", () => {
    // parseFilterGroup's leaf shape requires field + dataType + operator (packages/filter-builder/src/reverse.ts).
    const raw = JSON.stringify({
      logic: "and",
      filters: [{ field: "amount", dataType: "numeric", operator: "gt", value: 100 }],
    });
    const out = parseNlFilterResponse(raw);
    expect(JSON.parse(out)).toMatchObject({ logic: "and" });
    expect(out).toContain("\n"); // pretty-printed
  });

  it("rejects non-json input with a friendly message", () => {
    expect(() => parseNlFilterResponse("not json")).toThrow(SyntaxError);
  });

  it("rejects a structurally invalid group with a friendly message", () => {
    expect(() => parseNlFilterResponse('{"nope":true}')).toThrow("the AI response is not a valid filter group");
  });

  it("rejects a group whose leaf is missing dataType with a friendly message", () => {
    const raw = JSON.stringify({ logic: "and", filters: [{ field: "amount", operator: "gt", value: 100 }] });
    expect(() => parseNlFilterResponse(raw)).toThrow("the AI response is not a valid filter group");
  });
});
