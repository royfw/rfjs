import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DerivedPreview } from "./derived-preview";
import { DEFAULT_META } from "./model";

const LABELS = {
  metaTitle: "meta", schemaTitle: "schema", tryTitle: "try filter", emptySchema: "declare a filterable field first",
  copy: "Copy", copied: "Copied", download: "Download meta.json", reset: "Reset",
};
const TREE_LABELS = {
  logic: { and: "AND", or: "OR", nor: "NOR", not: "NOT" },
  addCondition: "+ condition", addGroup: "+ group", removeGroup: "remove group", removeCondition: "remove",
  elemMatch: "elemmatch",
};

const writeText = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("DerivedPreview", () => {
  it("renders the meta json and the derived FieldSchema for filterable+kind fields", () => {
    render(<DerivedPreview meta={DEFAULT_META} onReset={vi.fn()} labels={LABELS} treeLabels={TREE_LABELS} />);

    const metaJson = screen.getByTestId("meta-json");
    expect(metaJson.textContent).toContain('"fields"');
    expect(metaJson.textContent).toContain('"filter"');

    const schemaJson = screen.getByTestId("schema-json");
    expect(schemaJson.textContent).toContain('"author.name"');
    expect(schemaJson.textContent).not.toContain('"createdAt"'); // not filterable
  });

  it("mounts a filter tree editor fed by the derived schema", () => {
    render(<DerivedPreview meta={DEFAULT_META} onReset={vi.fn()} labels={LABELS} treeLabels={TREE_LABELS} />);
    expect(screen.getByRole("button", { name: "+ condition" })).toBeTruthy();
  });

  it("shows the empty-schema hint when no field is filterable with a kind", () => {
    render(
      <DerivedPreview
        meta={{ fields: [{ key: "a", label: "A", dataType: "string" }] }}
        onReset={vi.fn()}
        labels={LABELS}
        treeLabels={TREE_LABELS}
      />,
    );
    expect(screen.getByText("declare a filterable field first")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ condition" })).toBeNull();
  });

  it("copy flips to copied; download builds a blob and clicks an anchor; reset calls back", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const onReset = vi.fn();
    render(<DerivedPreview meta={DEFAULT_META} onReset={onReset} labels={LABELS} treeLabels={TREE_LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"fields"'));

    fireEvent.click(screen.getByRole("button", { name: "Download meta.json" }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalled();
    click.mockRestore();
  });
});
