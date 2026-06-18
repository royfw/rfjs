import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "../compile";
import type { BuilderGroup } from "../types";
import { dataFilterEngine, DATA_FILTER_OPS } from "./data-filter";

describe("dataFilterEngine.operators", () => {
  it("offers substring ops but NOT case-insensitive ops for string", () => {
    const ops = dataFilterEngine.operators("string").map((o) => o.op);
    expect(ops).toContain("contains");
    expect(ops).not.toContain("icontains"); // data-filter has no case-insensitive
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

  it("exposes `contains` as a multi-value (list) op on strings (contains-any)", () => {
    const contains = dataFilterEngine.operators("string").find((o) => o.op === "contains");
    expect(contains?.arity).toBe("list");
  });

  it("keeps `contains` single-value on object fields", () => {
    const contains = dataFilterEngine.operators("object").find((o) => o.op === "contains");
    expect(contains?.arity).toBe("one");
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
  it("contains data-filter operators and excludes jsonb-only ones", () => {
    expect(DATA_FILTER_OPS.has("contains")).toBe(true);
    expect(DATA_FILTER_OPS.has("icontains")).toBe(false);
    expect(DATA_FILTER_OPS.has("haskey")).toBe(false);
  });
});
