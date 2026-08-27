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

  it("flags uncoverable when an operator data-filter cannot cover is present", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "name", dataType: "string", operator: "nin", value: "x" }],
    };
    const r = runLiveMatch([{ name: "X" }], tree);
    expect(r.uncoverable).toBe(true);
  });

  it("empty group matches everything (identity)", () => {
    const empty: BuilderGroup = { kind: "group", id: "g", logic: "and", children: [] };
    expect(runLiveMatch(rows, empty).count).toBe(3);
  });

  it("flags uncoverable for an uncoverable op nested inside a group", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "outer", logic: "and",
      children: [{
        kind: "group", id: "inner", logic: "or",
        children: [{ kind: "condition", id: "c", field: "name", dataType: "string", operator: "nin", value: "x" }],
      }],
    };
    expect(runLiveMatch([{ name: "X" }], tree).uncoverable).toBe(true);
  });

  it("surfaces a malformed condition as `invalid`, distinct from no-match (issue #266)", () => {
    // an `array` condition missing `elementType` makes ArrayMatch throw at match time
    const malformed: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "roles", dataType: "array", operator: "eq", value: "admin" }],
    };
    const r = runLiveMatch([{ roles: ["staff"] }], malformed);
    expect(r.invalid).toBe(true);
    expect(r.uncoverable).toBe(false); // NOT swallowed into uncoverable
    expect(r.count).toBe(0);
    expect(r.error).toBeTruthy();
  });

  it("a genuine zero-match is distinguishable from a malformed rule (issue #266)", () => {
    const noMatch: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 999 }],
    };
    const r = runLiveMatch(rows, noMatch);
    expect(r.count).toBe(0);
    expect(r.invalid).toBe(false); // nobody matched, but the rule is fine
    expect(r.uncoverable).toBe(false);
  });

  it("a covered match reports invalid=false", () => {
    expect(runLiveMatch(rows, adults).invalid).toBe(false);
  });

  it("an uncoverable op is not flagged invalid", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "name", dataType: "string", operator: "nin", value: "x" }],
    };
    const r = runLiveMatch([{ name: "X" }], tree);
    expect(r.uncoverable).toBe(true);
    expect(r.invalid).toBe(false);
  });

  it("flags uncoverable for an uncoverable op inside an elemmatch filter", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{
        kind: "condition", id: "c", field: "tags", dataType: "array", elementType: "object",
        operator: "elemmatch",
        filters: {
          kind: "group", id: "fg", logic: "and",
          children: [{ kind: "condition", id: "fc", field: "name", dataType: "string", operator: "nin", value: "x" }],
        },
      }],
    };
    expect(runLiveMatch([{ tags: [{ name: "X" }] }], tree).uncoverable).toBe(true);
  });
});
