import { describe, expect, it } from "vitest";

import { inferSchema } from "./schema-infer";

describe("inferSchema", () => {
  it("infers scalar types from the first non-null value", () => {
    const s = inferSchema([{ name: "a", age: 30, active: true }]);
    expect(s).toEqual([
      { path: "name", dataType: "string", include: true },
      { path: "age", dataType: "numeric", include: true },
      { path: "active", dataType: "boolean", include: true },
    ]);
  });

  it("detects ISO date strings as date", () => {
    expect(inferSchema([{ created: "2020-01-15" }])).toEqual([
      { path: "created", dataType: "date", include: true },
    ]);
  });

  it("emits both the object field and its leaf paths", () => {
    expect(inferSchema([{ address: { city: "TP" } }])).toEqual([
      { path: "address", dataType: "object", include: true },
      { path: "address.city", dataType: "string", include: true },
    ]);
  });

  it("infers arrays of scalars with elementType", () => {
    expect(inferSchema([{ tags: ["a", "b"] }])).toEqual([
      { path: "tags", dataType: "array", elementType: "string", include: true },
    ]);
  });

  it("infers arrays of objects as elementType object", () => {
    expect(inferSchema([{ items: [{ sku: "x" }] }])).toEqual([
      { path: "items", dataType: "array", elementType: "object", include: true },
    ]);
  });

  it("falls back to string on conflicting types across rows", () => {
    expect(inferSchema([{ v: 1 }, { v: "x" }])).toEqual([
      { path: "v", dataType: "string", include: true },
    ]);
  });

  it("throws when input is not an array of objects", () => {
    expect(() => inferSchema(42 as unknown)).toThrow();
    expect(() => inferSchema([1, 2] as unknown)).toThrow();
  });

  // Fix A: ISO date regex must be anchored
  it("does not classify a date-prefixed string with trailing text as date", () => {
    expect(inferSchema([{ note: "2020-01-15 follow up" }])).toEqual([
      { path: "note", dataType: "string", include: true },
    ]);
  });

  it("classifies YYYY-MM-DDThh:mm as date", () => {
    expect(inferSchema([{ ts: "2020-01-15T10:30" }])).toEqual([
      { path: "ts", dataType: "date", include: true },
    ]);
  });

  // Fix B: orphaned dotted paths under a non-object parent must be dropped
  it("does not emit leaf paths when an object field conflicts with a scalar in another row", () => {
    const s = inferSchema([{ a: { b: 1 } }, { a: "x" }]);
    expect(s).toEqual([{ path: "a", dataType: "string", include: true }]);
  });
});
