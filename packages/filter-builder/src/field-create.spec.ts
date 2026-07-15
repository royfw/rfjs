import { describe, it, expect } from "vitest";
import { addInferredField } from "./field-create";
import type { FieldSchema } from "./types";

const base: FieldSchema[] = [{ path: "name", dataType: "string", include: true, kind: "jsonb" }];

describe("addInferredField", () => {
  it("appends a new jsonb string field when the path is unknown", () => {
    const next = addInferredField(base, "newKey");
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ path: "newKey", dataType: "string", include: true, kind: "jsonb" });
  });

  it("returns the same array when the path already exists", () => {
    const next = addInferredField(base, "name");
    expect(next).toBe(base);
  });

  it("ignores empty paths", () => {
    expect(addInferredField(base, "")).toBe(base);
  });
});
