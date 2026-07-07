import { describe, expect, it } from "vitest";

import { convertType, CONVERT_TYPES } from "./type-converter";

describe("convertType", () => {
  it("converts a numeric string to number", () => {
    expect(convertType("42", "number")).toEqual({ ok: true, output: "42", runtimeType: "number" });
  });
  it("flags a non-numeric string as nan", () => {
    expect(convertType("abc", "number")).toEqual({ ok: false, error: "nan" });
  });
  it("converts to boolean", () => {
    expect(convertType("true", "boolean")).toEqual({ ok: true, output: "true", runtimeType: "boolean" });
  });
  it("converts a valid date to ISO", () => {
    const r = convertType("2020-01-01", "date");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.runtimeType).toBe("Date");
      expect(r.output).toContain("2020-01-01");
    }
  });
  it("flags an invalid date", () => {
    expect(convertType("nope", "date")).toEqual({ ok: false, error: "invalidDate" });
  });
  it("passes a string through", () => {
    expect(convertType("hi", "string")).toEqual({ ok: true, output: "hi", runtimeType: "string" });
  });
  it("exposes the selectable types", () => {
    expect(CONVERT_TYPES).toEqual(["string", "number", "integer", "boolean", "date", "any"]);
  });
});
