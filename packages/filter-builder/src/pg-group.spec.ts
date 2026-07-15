import { describe, it, expect } from "vitest";
import { treeToPgFilterGroup } from "./pg-group";
import type { BuilderGroup, FieldSchema } from "./types";

describe("treeToPgFilterGroup", () => {
  it("tags a column-kind leaf with target:'column'", () => {
    const schema: FieldSchema[] = [{ path: "name", dataType: "string", include: true, kind: "column" }];
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "name", dataType: "string", operator: "eq", value: "x" }],
    };
    expect(treeToPgFilterGroup(tree, schema)).toEqual({
      logic: "and",
      filters: [{ target: "column", column: "name", operator: "eq", value: "x" }],
    });
  });

  it("tags a jsonb-kind leaf with target:'jsonb' and carries dataType", () => {
    const schema: FieldSchema[] = [{ path: "score", dataType: "numeric", include: true, kind: "jsonb" }];
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "score", dataType: "numeric", operator: "gt", value: 5 }],
    };
    expect(treeToPgFilterGroup(tree, schema)).toEqual({
      logic: "and",
      filters: [{ target: "jsonb", field: "score", dataType: "numeric", operator: "gt", value: 5 }],
    });
  });

  it("handles nested groups mixing column + jsonb", () => {
    const schema: FieldSchema[] = [
      { path: "name", dataType: "string", include: true, kind: "column" },
      { path: "score", dataType: "numeric", include: true, kind: "jsonb" },
    ];
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [
        { kind: "condition", id: "c1", field: "name", dataType: "string", operator: "eq", value: "a" },
        {
          kind: "group", id: "g2", logic: "or",
          children: [
            { kind: "condition", id: "c2", field: "score", dataType: "numeric", operator: "gt", value: 1 },
            { kind: "condition", id: "c3", field: "name", dataType: "string", operator: "neq", value: "b" },
          ],
        },
      ],
    };
    expect(treeToPgFilterGroup(tree, schema)).toEqual({
      logic: "and",
      filters: [
        { target: "column", column: "name", operator: "eq", value: "a" },
        {
          logic: "or",
          filters: [
            { target: "jsonb", field: "score", dataType: "numeric", operator: "gt", value: 1 },
            { target: "column", column: "name", operator: "neq", value: "b" },
          ],
        },
      ],
    });
  });

  it("defaults an unknown field (not in schema) to a jsonb leaf", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "ghost", dataType: "string", operator: "eq", value: "z" }],
    };
    expect(treeToPgFilterGroup(tree, [])).toEqual({
      logic: "and",
      filters: [{ target: "jsonb", field: "ghost", dataType: "string", operator: "eq", value: "z" }],
    });
  });
});
