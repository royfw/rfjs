import { describe, expect, it } from "vitest";

import { runFilterTest } from "./data-filter-tester";

const DATA = '[{"name":"Ada","age":30},{"name":"Bo","age":15}]';
const FILTER = '{"logic":"and","filters":[{"field":"age","dataType":"numeric","operator":"gte","value":18}]}';

describe("runFilterTest", () => {
  it("returns the matched subset and count", () => {
    const r = runFilterTest(DATA, FILTER);
    expect(r).toEqual({ ok: true, output: '[\n  {\n    "name": "Ada",\n    "age": 30\n  }\n]', count: 1 });
  });
  it("rejects invalid JSON in data", () => {
    expect(runFilterTest("nope", FILTER)).toEqual({ ok: false, error: "invalidJson" });
  });
  it("rejects invalid JSON in filter", () => {
    expect(runFilterTest(DATA, "nope")).toEqual({ ok: false, error: "invalidJson" });
  });
  it("rejects non-array data", () => {
    expect(runFilterTest('{"name":"Ada"}', FILTER)).toEqual({ ok: false, error: "notArray" });
  });
  it("reports a filter that throws (missing dataType) as queryFailed", () => {
    const bad = '{"logic":"and","filters":[{"field":"age","operator":"gte","value":18}]}';
    expect(runFilterTest(DATA, bad)).toEqual({ ok: false, error: "queryFailed" });
  });
});
