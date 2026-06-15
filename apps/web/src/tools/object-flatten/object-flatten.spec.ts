import { describe, expect, it } from "vitest";

import { flattenJson } from "./object-flatten";

describe("flattenJson", () => {
  it("flattens a nested object to dot-path keys", () => {
    const r = flattenJson('{"a":{"b":1},"c":true}');
    expect(r).toEqual({ ok: true, output: '{\n  "a.b": 1,\n  "c": true\n}' });
  });
  it("rejects invalid JSON", () => {
    expect(flattenJson("not json")).toEqual({ ok: false, error: "invalidJson" });
  });
  it("rejects a top-level array", () => {
    expect(flattenJson("[1,2]")).toEqual({ ok: false, error: "notObject" });
  });
  it("rejects a top-level primitive", () => {
    expect(flattenJson("42")).toEqual({ ok: false, error: "notObject" });
  });
  it("rejects null", () => {
    expect(flattenJson("null")).toEqual({ ok: false, error: "notObject" });
  });
});
