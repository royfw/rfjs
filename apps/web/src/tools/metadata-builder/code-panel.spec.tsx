import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CodePanel } from "./code-panel";
import { DEFAULT_META } from "./model";

const LABELS = {
  metaTitle: "meta.json", schemaTitle: "schema", tryTitle: "try filter",
  emptySchema: "declare a field as filterable and pick its kind (column/jsonb) to try filtering here",
  copy: "Copy", copied: "Copied", download: "Download meta.json", reset: "Reset",
  collapse: "collapse code panel", expand: "expand code panel", showAll: "show all",
  collapseLabel: "collapse", viewingField: "viewing selected field",
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

function renderPanel(overrides: Partial<React.ComponentProps<typeof CodePanel>> = {}) {
  const props = {
    meta: DEFAULT_META,
    selectedFieldKey: null as string | null,
    onReset: vi.fn(),
    onCollapse: vi.fn(),
    labels: LABELS,
    treeLabels: TREE_LABELS,
    ...overrides,
  };
  function Harness() {
    const [tab, setTab] = React.useState<"meta" | "schema" | "try">("meta");
    return <CodePanel {...props} tab={tab} onTabChange={setTab} />;
  }
  return { ...render(<Harness />), props };
}

describe("CodePanel tabs", () => {
  it("defaults to the meta tab with the full normalized json; schema and try tabs swap content", () => {
    renderPanel();

    const metaJson = screen.getByTestId("meta-json");
    expect(metaJson.textContent).toContain('"fields"');
    expect(metaJson.textContent).toContain('"request"');

    fireEvent.click(screen.getByRole("button", { name: "schema" }));
    expect(screen.queryByTestId("meta-json")).toBeNull();
    expect(screen.getByTestId("schema-json").textContent).toContain('"author.name"');
    expect(screen.getByTestId("schema-json").textContent).not.toContain('"createdAt"');

    fireEvent.click(screen.getByRole("button", { name: "try filter" }));
    expect(screen.getByRole("button", { name: "+ condition" })).toBeTruthy();
  });

  it("shows the empty-schema hint on the try tab when nothing is filterable", () => {
    renderPanel({ meta: { fields: [{ key: "a", label: "A", dataType: "string" }] } });

    fireEvent.click(screen.getByRole("button", { name: "try filter" }));
    expect(screen.getByText(LABELS.emptySchema)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ condition" })).toBeNull();
  });
});

describe("CodePanel fragment mode", () => {
  it("shows only the selected field's json with a show-all escape", () => {
    renderPanel({ selectedFieldKey: "price" });

    const metaJson = screen.getByTestId("meta-json");
    expect(metaJson.textContent).toContain('"key": "price"');
    expect(metaJson.textContent).not.toContain('"key": "title"');
    expect(metaJson.textContent).not.toContain('"request"');

    // schema 頁籤同理(spec §3):只顯示選中欄位的 schema 項
    fireEvent.click(screen.getByRole("button", { name: "schema" }));
    expect(screen.getByTestId("schema-json").textContent).toContain('"path": "price"');
    expect(screen.getByTestId("schema-json").textContent).not.toContain('"author.name"');
    fireEvent.click(screen.getByRole("button", { name: "meta.json" }));

    fireEvent.click(screen.getByRole("button", { name: "show all" }));
    expect(screen.getByTestId("meta-json").textContent).toContain('"key": "title"');
  });

  it("falls back to the full json when the selected key is not in the meta", () => {
    renderPanel({ selectedFieldKey: "ghost" });
    expect(screen.getByTestId("meta-json").textContent).toContain('"request"');
  });

  it("coloring never alters the text content", () => {
    renderPanel();
    const txt = screen.getByTestId("meta-json").textContent!;
    expect(JSON.parse(txt)).toBeTruthy(); // 著色只包 span,textContent 仍是合法 JSON
  });
});

describe("CodePanel actions", () => {
  it("copy flips to copied (full json even in fragment mode); download and reset work", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { props } = renderPanel({ selectedFieldKey: "price" });

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"request"')); // Copy 一律整份

    fireEvent.click(screen.getByRole("button", { name: "Download meta.json" }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(props.onReset).toHaveBeenCalled();
    click.mockRestore();
  });

  it("collapse button reports through onCollapse", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "collapse code panel" }));
    expect(props.onCollapse).toHaveBeenCalled();
  });
});
