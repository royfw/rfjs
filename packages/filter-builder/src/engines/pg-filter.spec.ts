import { describe, it, expect } from "vitest";
import { pgFilterEngine } from "./pg-filter";
import type { CompileContext } from "./types";

const ctx = (fields: CompileContext["fields"]): CompileContext => ({ fields });

describe("pgFilterEngine.operators", () => {
  it("returns column operators for column-kind fields", () => {
    const ops = pgFilterEngine.operators("string", undefined, "column").map((o) => o.op);
    expect(ops).toContain("contains");
    expect(ops).toContain("startswith");
    expect(ops).toContain("eq");
    expect(ops).not.toContain("icontains");
  });

  it("returns jsonb operators for jsonb-kind fields", () => {
    const ops = pgFilterEngine.operators("string", undefined, "jsonb").map((o) => o.op);
    expect(ops).toContain("icontains");
  });
});

describe("pgFilterEngine.compile", () => {
  it("renders a pure column condition", () => {
    const group = { logic: "and", filters: [{ field: "name", dataType: "string", operator: "contains", value: "ab" }] };
    const out = pgFilterEngine.compile(group, ctx([{ path: "name", kind: "column", dataType: "string" }]));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.primary).toContain("name");
      expect(out.primary).toContain("$1");
      expect(out.secondary).toContain("ab");
    }
  });

  it("renders a pure jsonb condition against the data column", () => {
    const group = { logic: "and", filters: [{ field: "score", dataType: "numeric", operator: "gt", value: 80 }] };
    const out = pgFilterEngine.compile(group, ctx([{ path: "score", kind: "jsonb", dataType: "numeric" }]));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.primary).toContain("data");
  });

  it("mixes column + jsonb leaves with contiguous params", () => {
    const group = {
      logic: "and",
      filters: [
        { field: "name", dataType: "string", operator: "eq", value: "x" },
        { field: "score", dataType: "numeric", operator: "gt", value: 5 },
      ],
    };
    const out = pgFilterEngine.compile(
      group,
      ctx([
        { path: "name", kind: "column", dataType: "string" },
        { path: "score", kind: "jsonb", dataType: "numeric" },
      ]),
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.primary).toContain("name");
      expect(out.primary).toContain("data");
      expect(out.primary).toContain("$1");
      expect(out.primary).toContain("$2");
    }
  });

  it("returns ok:false when a column gets an unsupported operator", () => {
    const group = { logic: "and", filters: [{ field: "n", dataType: "numeric", operator: "contains", value: "x" }] };
    const out = pgFilterEngine.compile(group, ctx([{ path: "n", kind: "column", dataType: "numeric" }]));
    expect(out.ok).toBe(false);
  });

  it("renders a nested group mixing column + jsonb with contiguous params", () => {
    const group = {
      logic: "and",
      filters: [
        { field: "name", dataType: "string", operator: "eq", value: "a" },
        {
          logic: "or",
          filters: [
            { field: "score", dataType: "numeric", operator: "gt", value: 1 },
            { field: "age", dataType: "numeric", operator: "lt", value: 9 },
          ],
        },
      ],
    };
    const out = pgFilterEngine.compile(
      group,
      ctx([
        { path: "name", kind: "column", dataType: "string" },
        { path: "score", kind: "jsonb", dataType: "numeric" },
        { path: "age", kind: "column", dataType: "numeric" },
      ]),
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.primary).toContain("name");
      expect(out.primary).toContain("data");
      expect(out.primary).toContain("age");
      expect(out.primary).toContain("$1");
      expect(out.primary).toContain("$2");
      expect(out.primary).toContain("$3");
    }
  });

  it("passes an elemmatch jsonb leaf (nested filters) through to buildPgFilter", () => {
    const group = {
      logic: "and",
      filters: [
        {
          field: "tags",
          dataType: "array",
          elementType: "object",
          operator: "elemmatch",
          filters: {
            logic: "and",
            filters: [{ field: "k", dataType: "string", operator: "eq", value: "v" }],
          },
        },
      ],
    };
    const out = pgFilterEngine.compile(group, ctx([{ path: "tags", kind: "jsonb", dataType: "array", elementType: "object" }]));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.primary).toContain("data");
  });
});
