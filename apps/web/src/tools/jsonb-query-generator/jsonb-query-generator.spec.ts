import { describe, expect, it } from "vitest";

import { JSONB_DIALECTS, runJsonbQuery } from "./jsonb-query-generator";

const FILTER = '{"logic":"and","filters":[{"field":"age","dataType":"numeric","operator":"gt","value":18}]}';

describe("runJsonbQuery", () => {
  it("builds a parameterized where + values (legacy)", () => {
    const r = runJsonbQuery("data", FILTER, "legacy");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.where).toBe('(("data" #>> $1)::numeric > $2)');
      expect(r.values).toBe('[\n  [\n    "age"\n  ],\n  18\n]');
    }
  });
  it("rejects invalid JSON", () => {
    expect(runJsonbQuery("data", "nope", "legacy")).toEqual({ ok: false, error: "invalidJson" });
  });
  it("reports a build failure as queryFailed", () => {
    expect(runJsonbQuery("data", '{"logic":"and"}', "legacy")).toEqual({ ok: false, error: "queryFailed" });
  });
  it("exposes the two dialects", () => {
    expect(JSONB_DIALECTS).toEqual(["legacy", "jsonpath"]);
  });
});
