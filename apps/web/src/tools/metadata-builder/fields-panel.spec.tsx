import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as React from "react";

import { FieldsPanel } from "./fields-panel";
import type { FieldRow } from "./model";

const LABELS = {
  key: "key", labelEn: "Label (en)", labelZh: "Label (zh-TW)", dataType: "type", format: "format",
  formatNone: "—", sortable: "sortable", filterable: "filterable", kind: "kind", kindNone: "—",
  options: "options", addField: "+ field", addOption: "+ option", remove: "remove",
  dupKey: "duplicate key", blankKey: "key required",
  inspectorTitle: "INSPECTOR", inspectorEmpty: "select or add a field", fieldSummary: "3 fields",
};

function row(partial: Partial<FieldRow>): FieldRow {
  return {
    id: partial.key ?? "r", key: "k", labelEn: "K", labelZh: "", dataType: "string",
    sortable: false, filterable: false, options: [], ...partial,
  };
}

/** 受控 harness:管理 rows 與 selection,模擬 ui.tsx 的持有方式。 */
function Harness({ initial, onChangeSpy }: { initial: FieldRow[]; onChangeSpy?: (rows: FieldRow[]) => void }) {
  const [rows, setRows] = React.useState(initial);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  return (
    <FieldsPanel
      rows={rows}
      onChange={(next) => {
        setRows(next);
        onChangeSpy?.(next);
      }}
      selectedId={selectedId}
      onSelect={setSelectedId}
      labels={LABELS}
    />
  );
}

describe("FieldsPanel (studio)", () => {
  it("shows the empty inspector state until a row is selected, then highlights it", () => {
    render(<Harness initial={[row({ key: "price", id: "r1" })]} />);

    expect(screen.getByText("select or add a field")).toBeTruthy();

    const item = screen.getByRole("option", { name: /price/ });
    fireEvent.click(item);
    expect(item.getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText("select or add a field")).toBeNull();
  });

  it("edits the selected row's key through the inspector and reports full rows", () => {
    const spy = vi.fn();
    render(<Harness initial={[row({ key: "price", id: "r1" })]} onChangeSpy={spy} />);

    fireEvent.click(screen.getByRole("option", { name: /price/ }));
    fireEvent.change(screen.getByLabelText("key"), { target: { value: "cost" } });

    expect(spy.mock.calls[0]![0][0]).toMatchObject({ id: "r1", key: "cost" });
  });

  it("changing dataType via the segmented control clears an incompatible format", () => {
    const spy = vi.fn();
    render(<Harness initial={[row({ key: "price", dataType: "numeric", format: "currency" })]} onChangeSpy={spy} />);

    fireEvent.click(screen.getByRole("option", { name: /price/ }));
    const group = screen.getByRole("group", { name: "type" });
    fireEvent.click(within(group).getByRole("button", { name: "string" }));

    expect(spy.mock.calls[0]![0][0]).toMatchObject({ dataType: "string", format: undefined });
  });

  it("adds a field (auto-selecting it) and removes it (clearing selection)", () => {
    const spy = vi.fn();
    render(<Harness initial={[row({ key: "a", id: "r1" })]} onChangeSpy={spy} />);

    fireEvent.click(screen.getByRole("button", { name: "+ field" }));
    expect(spy.mock.calls[0]![0]).toHaveLength(2);
    // 新列自動選取 → inspector 顯示(空 key 的列可及名 = blankKey 文案)
    expect(screen.queryByText("select or add a field")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "remove" })[1]!);
    expect(spy.mock.calls.at(-1)![0]).toHaveLength(1);
    expect(screen.getByText("select or add a field")).toBeTruthy(); // 移除選中列 → 清選取
  });

  it("edits an enum option pair inside the inspector", () => {
    const spy = vi.fn();
    render(
      <Harness
        initial={[row({ key: "status", options: [{ id: "o1", value: "draft", labelEn: "Draft", labelZh: "" }] })]}
        onChangeSpy={spy}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: /status/ }));
    const box = screen.getByTestId("options-editor");
    fireEvent.change(within(box).getByDisplayValue("draft"), { target: { value: "d1" } });

    expect(spy.mock.calls[0]![0][0].options[0]).toMatchObject({ value: "d1" });
  });

  it("marks duplicate and blank keys on the list", () => {
    render(<Harness initial={[row({ key: "a", id: "r1" }), row({ key: "a", id: "r2" }), row({ key: "", id: "r3" })]} />);

    const items = screen.getAllByRole("option");
    expect(within(items[0]!).getByText("duplicate key")).toBeTruthy();
    expect(within(items[1]!).getByText("duplicate key")).toBeTruthy();
    expect(within(items[2]!).getByText("key required")).toBeTruthy();
  });

  it("renders kind pills and flag badges on list rows", () => {
    render(
      <Harness
        initial={[
          row({ key: "price", id: "r1", kind: "column", filterable: true }),
          row({ key: "author.name", id: "r2", kind: "jsonb" }),
          row({ key: "plain", id: "r3" }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("option");
    expect(within(rows[0]!).getByText("column")).toBeTruthy();
    expect(within(rows[0]!).getByText("filterable")).toBeTruthy();
    expect(within(rows[1]!).getByText("jsonb")).toBeTruthy();
    expect(within(rows[2]!).queryByText("column")).toBeNull();
  });

  it("keeps sortable/filterable checkboxes editable in the inspector", () => {
    const spy = vi.fn();
    render(<Harness initial={[row({ key: "a", id: "r1" })]} onChangeSpy={spy} />);

    fireEvent.click(screen.getByRole("option", { name: /a/ }));
    fireEvent.click(screen.getByLabelText("sortable"));

    expect(spy.mock.calls[0]![0][0]).toMatchObject({ sortable: true });
  });
});
