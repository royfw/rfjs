import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "./compile";
import { filterGroupToTree, mergeFieldsFromTree, parseFilterGroup } from "./reverse";
import type { FilterGroupLike } from "./compile";
import type { FieldSchema } from "./types";

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

describe("parseFilterGroup", () => {
  it("accepts a valid filter group", () => {
    const text = JSON.stringify({ logic: "and", filters: [{ field: "age", dataType: "numeric", operator: "gt", value: 18 }] });
    const r = parseFilterGroup(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.group.filters).toHaveLength(1);
  });

  it("accepts nested groups and elemmatch", () => {
    const text = JSON.stringify({
      logic: "or",
      filters: [
        { logic: "and", filters: [{ field: "a", dataType: "string", operator: "eq", value: "x" }] },
        { field: "items", dataType: "array", elementType: "object", operator: "elemmatch", filters: { logic: "and", filters: [{ field: "sku", dataType: "string", operator: "eq", value: "1" }] } },
      ],
    });
    expect(parseFilterGroup(text).ok).toBe(true);
  });

  it("rejects invalid JSON", () => {
    const r = parseFilterGroup("{ not json");
    expect(r).toEqual({ ok: false, error: "invalidJson" });
  });

  it("rejects a bad logic operator", () => {
    const r = parseFilterGroup(JSON.stringify({ logic: "xor", filters: [] }));
    expect(r).toEqual({ ok: false, error: "invalidShape" });
  });

  it("rejects filters that is not an array", () => {
    const r = parseFilterGroup(JSON.stringify({ logic: "and", filters: {} }));
    expect(r).toEqual({ ok: false, error: "invalidShape" });
  });

  it("rejects a leaf missing field/operator", () => {
    const r = parseFilterGroup(JSON.stringify({ logic: "and", filters: [{ field: "", dataType: "string", operator: "eq" }] }));
    expect(r).toEqual({ ok: false, error: "invalidShape" });
  });
});

describe("mergeFieldsFromTree", () => {
  const base: FieldSchema[] = [{ path: "age", dataType: "numeric", include: true, kind: "column" }];

  it("appends missing fields with kind jsonb and the condition's dataType/elementType", () => {
    const group: FilterGroupLike = { logic: "and", filters: [
      { field: "age", dataType: "numeric", operator: "gt", value: 1 },
      { field: "tags", dataType: "array", elementType: "string", operator: "contains", value: "x" },
    ] };
    const out = mergeFieldsFromTree(base, group);
    expect(out).toHaveLength(2);
    expect(out.find((f) => f.path === "tags")).toEqual({ path: "tags", dataType: "array", elementType: "string", include: true, kind: "jsonb" });
  });

  it("does not touch existing fields (keeps their kind)", () => {
    const group: FilterGroupLike = { logic: "and", filters: [{ field: "age", dataType: "numeric", operator: "gt", value: 1 }] };
    const out = mergeFieldsFromTree(base, group);
    expect(out).toBe(base); // no additions → same reference
    expect(out[0]?.kind).toBe("column");
  });

  it("includes fields nested in groups and elemmatch", () => {
    const group: FilterGroupLike = { logic: "and", filters: [
      { logic: "or", filters: [{ field: "name", dataType: "string", operator: "eq", value: "a" }] },
      { field: "items", dataType: "array", elementType: "object", operator: "elemmatch", filters: { logic: "and", filters: [{ field: "sku", dataType: "string", operator: "eq", value: "1" }] } },
    ] };
    const out = mergeFieldsFromTree([], group);
    expect(out.map((f) => f.path).sort()).toEqual(["items", "name", "sku"]);
  });
});
