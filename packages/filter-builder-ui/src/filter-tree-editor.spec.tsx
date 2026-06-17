import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterTreeEditor, type FilterTreeLabels } from "./filter-tree-editor";
import { emptyGroup } from "@rfjs/filter-builder";
import type { BuilderGroup } from "@rfjs/filter-builder";

const labels: FilterTreeLabels = {
  logic: { and: "AND", or: "OR", nor: "NOR", not: "NOT" },
  addCondition: "+cond",
  addGroup: "+group",
  removeGroup: "rm group",
  removeCondition: "rm cond",
  elemMatch: "elemmatch",
};

let nid = 0;
const mkId = () => `n${++nid}`;

describe("FilterTreeEditor", () => {
  it("renders logic options from labels and adds a condition", () => {
    const tree = emptyGroup(mkId) as BuilderGroup;
    const onChange = vi.fn();
    render(
      <FilterTreeEditor
        group={tree}
        engineId="pg-filter"
        schema={[]}
        onChange={onChange}
        onCreateField={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByText("AND")).toBeDefined();
    fireEvent.click(screen.getByText("+cond"));
    expect(onChange).toHaveBeenCalled();
  });
});
