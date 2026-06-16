import { describe, expect, it } from "vitest";

import { coerceInput } from "./value-coerce";

describe("coerceInput", () => {
  it("coerces numeric one-arity to a number", () => {
    expect(coerceInput("numeric", "one", "18")).toBe(18);
  });

  it("returns NaN-free fallback: non-numeric string stays string", () => {
    expect(coerceInput("numeric", "one", "abc")).toBe("abc");
  });

  it("coerces boolean to a real boolean", () => {
    expect(coerceInput("boolean", "one", "true")).toBe(true);
    expect(coerceInput("boolean", "one", "false")).toBe(false);
  });

  it("keeps string/date one-arity as a string", () => {
    expect(coerceInput("string", "one", "hello")).toBe("hello");
    expect(coerceInput("date", "one", "2020-01-01")).toBe("2020-01-01");
  });

  it("splits list arity on comma/newline, trimming and dropping empties", () => {
    expect(coerceInput("string", "list", "a, b\n c ")).toEqual(["a", "b", "c"]);
  });

  it("coerces each list element by dataType for numeric", () => {
    expect(coerceInput("numeric", "list", "1, 2, 3")).toEqual([1, 2, 3]);
  });

  it("parses two-arity range into a typed pair", () => {
    expect(coerceInput("numeric", "two", "1, 9")).toEqual([1, 9]);
  });

  it("returns undefined for none arity", () => {
    expect(coerceInput("string", "none", "ignored")).toBeUndefined();
  });
});
