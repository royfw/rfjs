import { beforeEach, describe, expect, it } from "vitest";

import { addCondition, addGroup, emptyGroup, removeNode, setLogic, updateNode } from "./tree-ops";
import type { BuilderCondition, BuilderGroup } from "./types";

let counter = 0;
const id = () => `id-${counter++}`;

describe("tree-ops", () => {
  beforeEach(() => {
    counter = 0;
  });

  it("emptyGroup creates an and-group with no children", () => {
    const g = emptyGroup(id);
    expect(g.kind).toBe("group");
    expect(g.logic).toBe("and");
    expect(g.children).toEqual([]);
  });

  it("addCondition appends a blank condition to the target group", () => {
    const root = emptyGroup(id);
    const next = addCondition(root, root.id, id);
    expect(next.children).toHaveLength(1);
    expect((next.children[0] as BuilderCondition).kind).toBe("condition");
  });

  it("addGroup appends a nested group", () => {
    const root = emptyGroup(id);
    const next = addGroup(root, root.id, id);
    expect((next.children[0] as BuilderGroup).kind).toBe("group");
  });

  it("addCondition targets a nested group by id", () => {
    const base = emptyGroup(id);
    const root = addGroup(base, base.id, id);
    const nested = root.children[0] as BuilderGroup;
    const next = addCondition(root, nested.id, id);
    expect((next.children[0] as BuilderGroup).children).toHaveLength(1);
  });

  it("setLogic changes a group's logic immutably", () => {
    const root = emptyGroup(id);
    const next = setLogic(root, root.id, "or");
    expect(next.logic).toBe("or");
    expect(root.logic).toBe("and"); // original untouched
  });

  it("updateNode patches a condition by id", () => {
    let root = emptyGroup(id);
    root = addCondition(root, root.id, id);
    const cid = (root.children[0] as BuilderCondition).id;
    const next = updateNode(root, cid, { field: "age", dataType: "numeric", operator: "gt", value: 18 });
    expect(root.children[0]).not.toBe(next.children[0]); // immutable
    expect((next.children[0] as BuilderCondition).field).toBe("age");
  });

  it("removeNode deletes a child by id", () => {
    let root = emptyGroup(id);
    root = addCondition(root, root.id, id);
    const cid = (root.children[0] as BuilderCondition).id;
    expect(removeNode(root, cid).children).toHaveLength(0);
  });
});
