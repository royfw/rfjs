import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFilterTree } from "./use-filter-tree";

describe("useFilterTree", () => {
  it("starts with an empty group and given schema", () => {
    const { result } = renderHook(() => useFilterTree({ schema: [{ path: "a", dataType: "string", include: true, kind: "jsonb" }] }));
    expect(result.current.tree.kind).toBe("group");
    expect(result.current.schema).toHaveLength(1);
  });

  it("createField appends an inferred jsonb field", () => {
    const { result } = renderHook(() => useFilterTree());
    act(() => result.current.createField("newKey"));
    expect(result.current.schema.some((f) => f.path === "newKey")).toBe(true);
  });
});
