import { describe, it, expect } from "vitest";
import { esQueryEngine } from "./es-query";
import type { FilterGroupLike } from "../compile";
import type { CompileContext } from "./types";

const ctx: CompileContext = { fields: [] };

describe("esQueryEngine", () => {
  it("declares operators per data type", () => {
    const stringOps = esQueryEngine.operators("string").map((s) => s.op);
    expect(stringOps).toContain("contains");
    expect(stringOps).not.toContain("gt");
    const numOps = esQueryEngine.operators("numeric").map((s) => s.op);
    expect(numOps).toContain("gt");
    expect(numOps).toContain("range");
  });

  it("compiles an and-group to a bool/must query", () => {
    const group: FilterGroupLike = {
      logic: "and",
      filters: [
        { field: "status", dataType: "string", operator: "eq", value: "open" },
        { field: "age", dataType: "numeric", operator: "gt", value: 18 },
      ],
    };
    const out = esQueryEngine.compile(group, ctx);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(JSON.parse(out.primary)).toEqual({
        bool: { must: [{ term: { status: "open" } }, { range: { age: { gt: 18 } } }] },
      });
    }
  });

  it("maps canonical operators (range→between, terms→in, isnotnull→exists)", () => {
    const group: FilterGroupLike = {
      logic: "or",
      filters: [
        { field: "score", dataType: "numeric", operator: "range", value: [1, 10] },
        { field: "tag", dataType: "string", operator: "terms", value: ["a", "b"] },
        { field: "email", dataType: "string", operator: "isnotnull" },
      ],
    };
    const out = esQueryEngine.compile(group, ctx);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(JSON.parse(out.primary)).toEqual({
        bool: {
          should: [
            { range: { score: { gte: 1, lte: 10 } } },
            { terms: { tag: ["a", "b"] } },
            { exists: { field: "email" } },
          ],
          minimum_should_match: 1,
        },
      });
    }
  });

  it("supports not groups", () => {
    const group: FilterGroupLike = {
      logic: "not",
      filters: [{ field: "status", dataType: "string", operator: "eq", value: "archived" }],
    };
    const out = esQueryEngine.compile(group, ctx);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(JSON.parse(out.primary)).toEqual({
        bool: { must_not: [{ term: { status: "archived" } }] },
      });
    }
  });

  it("returns an error for an unsupported operator", () => {
    const group: FilterGroupLike = {
      logic: "and",
      filters: [{ field: "tags", dataType: "array", operator: "hasallkeys", value: ["x"] }],
    };
    const out = esQueryEngine.compile(group, ctx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("esUnsupportedOp");
  });
});
