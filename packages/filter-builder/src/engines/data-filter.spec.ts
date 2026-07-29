import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "../compile";
import type { BuilderGroup } from "../types";
import { dataFilterEngine, DATA_FILTER_OPS } from "./data-filter";

describe("dataFilterEngine.operators", () => {
  it("offers the full case-insensitive i-family for string (issues #268/#279)", () => {
    const ops = dataFilterEngine.operators("string").map((o) => o.op);
    expect(ops).toContain("contains");
    // data-filter now reaches cross-engine parity on the i-family
    expect(ops).toEqual(expect.arrayContaining(["icontains", "istartswith", "iendswith", "ieq", "ineq"]));
  });

  it("offers comparison ops for numeric", () => {
    expect(dataFilterEngine.operators("numeric").map((o) => o.op)).toEqual(
      expect.arrayContaining(["gt", "gte", "lt", "lte", "range"]),
    );
  });

  it("object ops exclude the haskey family", () => {
    const ops = dataFilterEngine.operators("object").map((o) => o.op);
    expect(ops).not.toContain("haskey");
    expect(ops).toContain("contains");
  });

  it("array of objects -> elemmatch only", () => {
    expect(dataFilterEngine.operators("array", "object").map((o) => o.op)).toEqual(["elemmatch"]);
  });

  it("exposes `contains` as a single-value (one) op on strings for cross-engine parity (issue #279)", () => {
    const contains = dataFilterEngine.operators("string").find((o) => o.op === "contains");
    expect(contains?.arity).toBe("one");
  });

  it("keeps `contains` single-value on object fields", () => {
    const contains = dataFilterEngine.operators("object").find((o) => o.op === "contains");
    expect(contains?.arity).toBe("one");
  });

  it("keeps `contains` single-value on string-element arrays (issue #279)", () => {
    const contains = dataFilterEngine.operators("array", "string").find((o) => o.op === "contains");
    expect(contains?.arity).toBe("one");
  });

  it("exposes `terms` as any-membership (list) on string/numeric arrays (issue #267)", () => {
    const strTerms = dataFilterEngine.operators("array", "string").find((o) => o.op === "terms");
    expect(strTerms?.arity).toBe("list");
    const numTerms = dataFilterEngine.operators("array", "numeric").find((o) => o.op === "terms");
    expect(numTerms?.arity).toBe("list");
    // membership operators are exact; substring `contains` is NOT membership
    expect(dataFilterEngine.operators("array", "string").map((o) => o.op)).not.toContain("containsany");
  });
});

describe("dataFilterEngine.compile", () => {
  it("emits the filter group as pretty JSON", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 18 }],
    };
    const out = dataFilterEngine.compile(treeToFilterGroup(tree), { fields: [] });
    expect(out).toEqual({
      ok: true,
      primary: JSON.stringify({ logic: "and", filters: [{ field: "age", dataType: "numeric", operator: "gt", value: 18 }] }, null, 2),
    });
  });
});

describe("DATA_FILTER_OPS coverage set", () => {
  it("contains data-filter operators including the i-family and excludes jsonb-only ones", () => {
    expect(DATA_FILTER_OPS.has("contains")).toBe(true);
    expect(DATA_FILTER_OPS.has("icontains")).toBe(true); // added in issue #268
    // full case-insensitive family reaches cross-engine parity (issue #279)
    for (const op of ["istartswith", "iendswith", "ieq", "ineq"]) {
      expect(DATA_FILTER_OPS.has(op)).toBe(true);
    }
    expect(DATA_FILTER_OPS.has("containsany")).toBe(false); // removed (use terms/containsall)
    expect(DATA_FILTER_OPS.has("haskey")).toBe(false);
  });
});
