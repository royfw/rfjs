import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "../compile";
import type { BuilderGroup } from "../types";
import { jsonbEngine } from "./jsonb";

describe("jsonbEngine.operators", () => {
  it("offers case-insensitive + substring ops for string", () => {
    const ops = jsonbEngine.operators("string").map((o) => o.op);
    expect(ops).toContain("icontains");
    expect(ops).toContain("contains");
    expect(ops).not.toContain("gt"); // strings don't get comparisons
  });

  it("offers comparison ops for numeric, with correct arity", () => {
    const ops = jsonbEngine.operators("numeric");
    expect(ops.map((o) => o.op)).toEqual(
      expect.arrayContaining(["eq", "gt", "gte", "lt", "lte", "range", "terms"]),
    );
    expect(ops.find((o) => o.op === "range")?.arity).toBe("two");
    expect(ops.find((o) => o.op === "terms")?.arity).toBe("list");
  });

  it("offers haskey family for object", () => {
    const ops = jsonbEngine.operators("object").map((o) => o.op);
    expect(ops).toEqual(expect.arrayContaining(["haskey", "hasanykey", "hasallkeys", "contains"]));
  });

  it("offers only elemmatch for arrays of objects", () => {
    expect(jsonbEngine.operators("array", "object").map((o) => o.op)).toEqual(["elemmatch"]);
  });

  it("offers isempty/isnotempty for scalar arrays", () => {
    const ops = jsonbEngine.operators("array", "string").map((o) => o.op);
    expect(ops).toEqual(expect.arrayContaining(["contains", "containsall", "isempty", "isnotempty"]));
  });
});

describe("jsonbEngine.compile", () => {
  const tree: BuilderGroup = {
    kind: "group", id: "g", logic: "and",
    children: [{ kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 18 }],
  };

  it("produces a parameterized where + values", () => {
    const out = jsonbEngine.compile(treeToFilterGroup(tree), { fields: [] });
    expect(out).toEqual({
      ok: true,
      primary: '(("data" #>> $1)::numeric > $2)',
      secondary: '[\n  [\n    "age"\n  ],\n  18\n]',
    });
  });

  it("reports a build failure as an error result", () => {
    const out = jsonbEngine.compile({ logic: "and", filters: [{ field: "x" } as never] }, { fields: [] });
    expect(out.ok).toBe(false);
  });
});
