import { describe, it, expect } from "vitest";
import { getResource } from "./query-resources";

describe("getResource", () => {
  it("returns the sample resource with rows/columns/fields", () => {
    const r = getResource("sample");
    expect(r).toBeDefined();
    expect(r!.rows.length).toBeGreaterThan(0);
    expect(r!.columns.length).toBeGreaterThan(0);
    expect(r!.fields.length).toBeGreaterThan(0);
  });
  it("returns undefined for an unknown resource", () => {
    expect(getResource("nope")).toBeUndefined();
  });
});
