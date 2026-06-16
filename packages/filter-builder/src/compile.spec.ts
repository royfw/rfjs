import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "./compile";
import type { BuilderGroup } from "./types";

const g = (over: Partial<BuilderGroup> = {}): BuilderGroup => ({
  kind: "group",
  id: "g",
  logic: "and",
  children: [],
  ...over,
});

describe("treeToFilterGroup", () => {
  it("strips ids and produces logic + filters", () => {
    const tree = g({
      children: [
        { kind: "condition", id: "c1", field: "age", dataType: "numeric", operator: "gt", value: 18 },
      ],
    });
    expect(treeToFilterGroup(tree)).toEqual({
      logic: "and",
      filters: [{ field: "age", dataType: "numeric", operator: "gt", value: 18 }],
    });
  });

  it("drops conditions missing field or operator", () => {
    const tree = g({
      children: [
        { kind: "condition", id: "c1", field: "", dataType: "string", operator: "eq", value: "x" },
        { kind: "condition", id: "c2", field: "name", dataType: "string", operator: "", value: "y" },
        { kind: "condition", id: "c3", field: "name", dataType: "string", operator: "eq", value: "z" },
      ],
    });
    expect(treeToFilterGroup(tree).filters).toEqual([
      { field: "name", dataType: "string", operator: "eq", value: "z" },
    ]);
  });

  it("recurses into nested groups", () => {
    const tree = g({
      logic: "or",
      children: [g({ id: "g2", logic: "nor", children: [] })],
    });
    expect(treeToFilterGroup(tree)).toEqual({
      logic: "or",
      filters: [{ logic: "nor", filters: [] }],
    });
  });

  it("preserves elemmatch nested filters and elementType", () => {
    const tree = g({
      children: [
        {
          kind: "condition", id: "c1", field: "items", dataType: "array", elementType: "object", operator: "elemmatch",
          filters: g({ id: "gi", logic: "and", children: [
            { kind: "condition", id: "ci", field: "sku", dataType: "string", operator: "eq", value: "x" },
          ] }),
        },
      ],
    });
    expect(treeToFilterGroup(tree)).toEqual({
      logic: "and",
      filters: [{
        field: "items", dataType: "array", elementType: "object", operator: "elemmatch",
        filters: { logic: "and", filters: [{ field: "sku", dataType: "string", operator: "eq", value: "x" }] },
      }],
    });
  });

  it("omits value for no-arity operators when value is undefined", () => {
    const tree = g({
      children: [{ kind: "condition", id: "c1", field: "name", dataType: "string", operator: "isnull" }],
    });
    expect(treeToFilterGroup(tree).filters).toEqual([
      { field: "name", dataType: "string", operator: "isnull" },
    ]);
  });
});
