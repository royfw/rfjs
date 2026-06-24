import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterTreeEditor, type FilterTreeLabels } from "./filter-tree-editor";
import { emptyGroup } from "@rfjs/filter-builder";
import type { BuilderGroup, FieldSchema } from "@rfjs/filter-builder";

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

const collapseLabels: FilterTreeLabels = {
  logic: { and: "ALL", or: "ANY", nor: "NONE", not: "NOT" },
  addCondition: "+ condition",
  addGroup: "+ group",
  removeGroup: "remove group",
  removeCondition: "remove condition",
  elemMatch: "elemmatch",
  toggleGroup: "toggle group",
  collapsedConditions: "cond",
  collapsedGroups: "grp",
  collapsedEmpty: "empty",
};

const schema: FieldSchema[] = [{ path: "age", dataType: "numeric", include: true, kind: "jsonb" }];

// root ALL { age>18, age<99, ANY { age=1 } }  → 2 conditions + 1 group
const tree: BuilderGroup = {
  kind: "group",
  id: "root",
  logic: "and",
  children: [
    { kind: "condition", id: "c1", field: "age", dataType: "numeric", operator: "gt", value: 18 },
    { kind: "condition", id: "c2", field: "age", dataType: "numeric", operator: "lt", value: 99 },
    {
      kind: "group",
      id: "g1",
      logic: "or",
      children: [
        { kind: "condition", id: "c3", field: "age", dataType: "numeric", operator: "eq", value: 1 },
      ],
    },
  ],
};

function setup(onChange = vi.fn()) {
  render(
    <FilterTreeEditor
      group={tree}
      engineId="data-filter"
      schema={schema}
      onChange={onChange}
      onCreateField={vi.fn()}
      labels={collapseLabels}
    />,
  );
  return onChange;
}

describe("FilterTreeEditor — operator labels", () => {
  it("shows the localized label for a condition's operator when operatorLabels is passed", () => {
    render(
      <FilterTreeEditor
        group={tree}
        engineId="data-filter"
        schema={schema}
        onChange={vi.fn()}
        onCreateField={vi.fn()}
        labels={{ ...collapseLabels, operatorLabels: { gt: "大於" } }}
      />,
    );
    // the c1 condition uses operator "gt" → its Select trigger shows the localized label
    expect(screen.getByText("大於")).toBeTruthy();
  });

  it("falls back to the raw op when operatorLabels is omitted", () => {
    render(
      <FilterTreeEditor
        group={tree}
        engineId="data-filter"
        schema={schema}
        onChange={vi.fn()}
        onCreateField={vi.fn()}
        labels={collapseLabels}
      />,
    );
    // no operatorLabels → trigger shows the raw op "gt"
    expect(screen.getByText("gt")).toBeTruthy();
    expect(screen.queryByText("大於")).toBeNull();
  });
});

describe("FilterTreeEditor — group collapse", () => {
  it("renders expanded by default (children visible, add buttons present)", () => {
    setup();
    expect(screen.getAllByLabelText("operator").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+ condition").length).toBeGreaterThan(0);
  });

  it("collapsing the root hides children and add buttons, shows summary", () => {
    setup();
    const [rootToggle] = screen.getAllByRole("button", { name: "toggle group" });
    fireEvent.click(rootToggle!); // root is the first group → first chevron
    expect(rootToggle!.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("operator")).toBeNull();
    expect(screen.queryByText("+ condition")).toBeNull();
    // non-zero summary: 2 conditions + 1 group, no "0 …"
    expect(screen.getByText("2 cond · 1 grp")).toBeTruthy();
  });

  it("summary omits the zero part (group with only conditions)", () => {
    const onlyConds: BuilderGroup = {
      kind: "group",
      id: "r",
      logic: "and",
      children: [
        { kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 1 },
      ],
    };
    render(
      <FilterTreeEditor
        group={onlyConds}
        engineId="data-filter"
        schema={schema}
        onChange={vi.fn()}
        onCreateField={vi.fn()}
        labels={collapseLabels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "toggle group" }));
    expect(screen.getByText("1 cond")).toBeTruthy();
  });

  it("collapsing does NOT call onChange (view-only, tree unchanged)", () => {
    const onChange = setup();
    fireEvent.click(screen.getAllByRole("button", { name: "toggle group" })[0]!);
    expect(onChange).not.toHaveBeenCalled();
  });
});
