import { addCondition, emptyGroup, updateNode } from "@rfjs/filter-builder";
import { describe, expect, it } from "vitest";

import { buildQueryBody } from "./dataset-query";
import { DATASET_FIELD_SCHEMA } from "./dataset-schema";

const id = () => crypto.randomUUID();

describe("buildQueryBody", () => {
  it("maps an empty tree to a body with an empty-and filter group", () => {
    const body = buildQueryBody(emptyGroup(id), DATASET_FIELD_SCHEMA, 1, 20);
    expect(body).toMatchObject({ page: 1, pageSize: 20 });
    expect(body.filter).toEqual({ logic: "and", filters: [] });
  });

  it("tags a column condition with target 'column' and carries paging", () => {
    let tree = emptyGroup(id);
    tree = addCondition(tree, tree.id, id);
    const condId = tree.children[0]!.id;
    tree = updateNode(tree, condId, { field: "name", dataType: "string", operator: "eq", value: "x" });
    const body = buildQueryBody(tree, DATASET_FIELD_SCHEMA, 2, 50);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(50);
    const leaf = body.filter!.filters[0] as { target: string; column?: string };
    expect(leaf.target).toBe("column");
    expect(leaf.column).toBe("name");
  });
});
