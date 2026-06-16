import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "./compile";
import { filterGroupToTree } from "./reverse";
import type { FilterGroupLike } from "./compile";

const idGen = () => {
  let n = 0;
  return () => `id-${n++}`;
};

describe("filterGroupToTree", () => {
  it("round-trips through treeToFilterGroup (ids dropped on the way back)", () => {
    const g: FilterGroupLike = {
      logic: "and",
      filters: [
        { field: "age", dataType: "numeric", operator: "gt", value: 18 },
        {
          logic: "or",
          filters: [
            { field: "name", dataType: "string", operator: "eq", value: "Ada" },
            { field: "tags", dataType: "array", elementType: "string", operator: "contains", value: "ml" },
          ],
        },
      ],
    };
    expect(treeToFilterGroup(filterGroupToTree(g, idGen()))).toEqual(g);
  });

  it("maps an elemmatch leaf's filters into a nested BuilderGroup, not a group child", () => {
    const g: FilterGroupLike = {
      logic: "and",
      filters: [
        { field: "items", dataType: "array", elementType: "object", operator: "elemmatch", filters: { logic: "and", filters: [{ field: "sku", dataType: "string", operator: "eq", value: "x" }] } },
      ],
    };
    const tree = filterGroupToTree(g, idGen());
    const cond = tree.children[0];
    expect(cond.kind).toBe("condition");
    if (cond.kind === "condition") {
      expect(cond.operator).toBe("elemmatch");
      expect(cond.filters?.kind).toBe("group");
      expect(cond.filters?.children).toHaveLength(1);
    }
    expect(treeToFilterGroup(tree)).toEqual(g);
  });

  it("assigns an id to every node", () => {
    const g: FilterGroupLike = { logic: "and", filters: [{ field: "a", dataType: "string", operator: "eq", value: "1" }] };
    const tree = filterGroupToTree(g, idGen());
    expect(tree.id).toBe("id-0");
    expect(tree.children[0]?.id).toBe("id-1");
  });
});
