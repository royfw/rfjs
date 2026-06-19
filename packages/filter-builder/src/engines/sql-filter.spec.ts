import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "../compile";
import type { BuilderGroup } from "../types";
import { sqlFilterEngine } from "./sql-filter";

describe("sqlFilterEngine.operators", () => {
  it("offers text ops (incl. contains/startswith) for string columns", () => {
    const ops = sqlFilterEngine.operators("string").map((o) => o.op);
    expect(ops).toEqual(
      expect.arrayContaining(["eq", "neq", "contains", "startswith", "gt", "lt", "isnull"]),
    );
    expect(ops).not.toContain("terms"); // sql-filter column layer has no IN list
  });

  it("offers comparison ops for numeric/date columns", () => {
    expect(sqlFilterEngine.operators("numeric").map((o) => o.op)).toEqual(
      expect.arrayContaining(["eq", "neq", "gt", "gte", "lt", "lte"]),
    );
    expect(sqlFilterEngine.operators("numeric").map((o) => o.op)).not.toContain("contains");
  });

  it("offers only equality + null for boolean", () => {
    expect(sqlFilterEngine.operators("boolean").map((o) => o.op)).toEqual([
      "eq", "neq", "isnull", "isnotnull",
    ]);
  });
});

describe("sqlFilterEngine.compile", () => {
  const ctx = {
    fields: [
      { path: "name", kind: "column" as const, dataType: "string" as const },
      { path: "age", kind: "column" as const, dataType: "numeric" as const },
    ],
  };

  it("compiles a flat AND group to parameterized SQL", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [
        { kind: "condition", id: "c1", field: "name", dataType: "string", operator: "contains", value: "sa" },
        { kind: "condition", id: "c2", field: "age", dataType: "numeric", operator: "gte", value: 18 },
      ],
    };
    const out = sqlFilterEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.primary).toContain("$1");
    expect(out.primary.toLowerCase()).toContain("and");
    expect(JSON.parse(out.secondary ?? "[]")).toEqual(["sa", 18]);
  });

  it("returns ok:false with a message on an unknown column", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "ghost", dataType: "string", operator: "eq", value: "x" }],
    };
    const out = sqlFilterEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out.ok).toBe(false);
  });
});
