import { describe, it, expect } from "vitest";
import { logicColor, dataTypeColor } from "./colors";

describe("colors", () => {
  it("returns a stable token class per logic operator", () => {
    expect(logicColor("and")).toBe(logicColor("and"));
    expect(logicColor("and")).not.toBe(logicColor("or"));
    expect(logicColor("and")).toMatch(/^text-/);
  });

  it("returns a token class per dataType and a fallback", () => {
    expect(dataTypeColor("string")).toMatch(/^text-/);
    expect(dataTypeColor("unknown")).toMatch(/^text-/);
  });
});
