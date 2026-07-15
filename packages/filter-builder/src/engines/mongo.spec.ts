import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "../compile";
import type { BuilderGroup } from "../types";
import { mongoEngine } from "./mongo";

const ctx = { fields: [] };

describe("mongoEngine.operators", () => {
  it("offers regex-style + membership ops for string", () => {
    const ops = mongoEngine.operators("string").map((o) => o.op);
    expect(ops).toEqual(expect.arrayContaining(["eq", "neq", "contains", "startswith", "terms", "nin"]));
  });

  it("offers comparison ops for numeric", () => {
    expect(mongoEngine.operators("numeric").map((o) => o.op)).toEqual(
      expect.arrayContaining(["gt", "gte", "lt", "lte", "range", "terms"]),
    );
  });

  it("marks nin (and terms) as list arity", () => {
    expect(mongoEngine.operators("string").find((o) => o.op === "nin")?.arity).toBe("list");
    expect(mongoEngine.operators("numeric").find((o) => o.op === "terms")?.arity).toBe("list");
  });
});

describe("mongoEngine.compile", () => {
  it("compiles nested and/or into $and/$or with field conditions", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [
        { kind: "condition", id: "c1", field: "name", dataType: "string", operator: "eq", value: "test" },
        {
          kind: "group", id: "g2", logic: "or",
          children: [
            { kind: "condition", id: "c2", field: "age", dataType: "numeric", operator: "gt", value: 18 },
          ],
        },
      ],
    };
    const out = mongoEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const q = JSON.parse(out.primary);
    expect(q).toEqual({
      $and: [{ name: { $eq: "test" } }, { $or: [{ age: { $gt: 18 } }] }],
    });
  });

  it("maps contains to a $regex (rendered as a regex literal string)", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "name", dataType: "string", operator: "contains", value: "ab" }],
    };
    const out = mongoEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.primary).toContain("/ab/");
  });

  it("maps isnull to $eq null", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "addr", dataType: "string", operator: "isnull" }],
    };
    const out = mongoEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(JSON.parse(out.primary)).toEqual({ $and: [{ addr: { $eq: null } }] });
  });

  it("rejects NOT groups (MongoDB has no top-level NOT here)", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "not",
      children: [{ kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 1 }],
    };
    const out = mongoEngine.compile(treeToFilterGroup(tree), ctx);
    expect(out).toEqual({ ok: false, error: "mongoNoNot" });
  });
});
