import { describe, expect, it } from "vitest";

import { runLiveMatch } from "./live-match";
import type { BuilderGroup } from "./types";

const rows = [{ age: 30 }, { age: 10 }, { age: 40 }];

const adults: BuilderGroup = {
  kind: "group", id: "g", logic: "and",
  children: [{ kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 18 }],
};

describe("runLiveMatch", () => {
  it("returns rows matching the tree with a count", () => {
    const r = runLiveMatch(rows, adults);
    expect(r.uncoverable).toBe(false);
    expect(r.count).toBe(2);
    expect(r.matched).toEqual([{ age: 30 }, { age: 40 }]);
  });

  it("flags uncoverable when a jsonb-only operator is present", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "name", dataType: "string", operator: "icontains", value: "x" }],
    };
    const r = runLiveMatch([{ name: "X" }], tree);
    expect(r.uncoverable).toBe(true);
  });

  it("empty group matches everything (identity)", () => {
    const empty: BuilderGroup = { kind: "group", id: "g", logic: "and", children: [] };
    expect(runLiveMatch(rows, empty).count).toBe(3);
  });

  it("flags uncoverable for a jsonb-only op nested inside a group", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "outer", logic: "and",
      children: [{
        kind: "group", id: "inner", logic: "or",
        children: [{ kind: "condition", id: "c", field: "name", dataType: "string", operator: "icontains", value: "x" }],
      }],
    };
    expect(runLiveMatch([{ name: "X" }], tree).uncoverable).toBe(true);
  });

  it("flags uncoverable for a jsonb-only op inside an elemmatch filter", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{
        kind: "condition", id: "c", field: "tags", dataType: "array", elementType: "object",
        operator: "elemmatch",
        filters: {
          kind: "group", id: "fg", logic: "and",
          children: [{ kind: "condition", id: "fc", field: "name", dataType: "string", operator: "icontains", value: "x" }],
        },
      }],
    };
    expect(runLiveMatch([{ tags: [{ name: "X" }] }], tree).uncoverable).toBe(true);
  });
});
