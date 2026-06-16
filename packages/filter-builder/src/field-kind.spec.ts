import { describe, it, expect } from "vitest";
import { canBeColumn, mapColumnType } from "./field-kind";

describe("field-kind", () => {
  it("maps scalar dataTypes to SQL column types", () => {
    expect(mapColumnType("string")).toBe("text");
    expect(mapColumnType("numeric")).toBe("numeric");
    expect(mapColumnType("date")).toBe("timestamp");
    expect(mapColumnType("boolean")).toBe("boolean");
  });

  it("allows only scalar dataTypes as columns", () => {
    expect(canBeColumn("string")).toBe(true);
    expect(canBeColumn("numeric")).toBe(true);
    expect(canBeColumn("date")).toBe(true);
    expect(canBeColumn("boolean")).toBe(true);
    expect(canBeColumn("object")).toBe(false);
    expect(canBeColumn("array")).toBe(false);
  });

  it("throws when mapping a non-column dataType", () => {
    expect(() => mapColumnType("object")).toThrow();
    expect(() => mapColumnType("array")).toThrow();
  });
});
