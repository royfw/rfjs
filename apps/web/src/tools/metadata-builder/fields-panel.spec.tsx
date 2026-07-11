import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FieldsPanel } from "./fields-panel";
import type { FieldRow } from "./model";

const LABELS = {
  key: "key", labelEn: "Label (en)", labelZh: "Label (zh-TW)", dataType: "type", format: "format",
  formatNone: "—", sortable: "sortable", filterable: "filterable", kind: "kind", kindNone: "—",
  options: "options", addField: "+ field", addOption: "+ option", remove: "remove",
  dupKey: "duplicate key", blankKey: "key required",
};

function row(partial: Partial<FieldRow>): FieldRow {
  return {
    id: partial.key ?? "r", key: "k", labelEn: "K", labelZh: "", dataType: "string",
    sortable: false, filterable: false, options: [], ...partial,
  };
}

describe("FieldsPanel", () => {
  it("edits a key and reports the full rows array through onChange", () => {
    const onChange = vi.fn();
    render(<FieldsPanel rows={[row({ key: "price", id: "r1" })]} onChange={onChange} labels={LABELS} />);

    fireEvent.change(screen.getByDisplayValue("price"), { target: { value: "cost" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0][0]).toMatchObject({ id: "r1", key: "cost" });
  });

  it("changing dataType clears an incompatible format", () => {
    const onChange = vi.fn();
    render(
      <FieldsPanel rows={[row({ key: "price", dataType: "numeric", format: "currency" })]} onChange={onChange} labels={LABELS} />,
    );

    fireEvent.change(screen.getByDisplayValue("numeric"), { target: { value: "string" } });

    expect(onChange.mock.calls[0]![0][0]).toMatchObject({ dataType: "string", format: undefined });
  });

  it("adds and removes a field row", () => {
    const onChange = vi.fn();
    render(<FieldsPanel rows={[row({ key: "a" })]} onChange={onChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "+ field" }));
    expect(onChange.mock.calls[0]![0]).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "remove" })[0]!);
    expect(onChange.mock.calls[1]![0]).toHaveLength(0);
  });

  it("toggles the options sub-editor and edits an option pair", () => {
    const onChange = vi.fn();
    render(
      <FieldsPanel
        rows={[row({ key: "status", options: [{ id: "o1", value: "draft", labelEn: "Draft", labelZh: "" }] })]}
        onChange={onChange}
        labels={LABELS}
      />,
    );

    // options 開合鈕以該列 options 數為可視文字(mockup:數字徽章)
    fireEvent.click(screen.getByRole("button", { name: /options/ }));
    const box = screen.getByTestId("options-editor");
    fireEvent.change(within(box).getByDisplayValue("draft"), { target: { value: "d1" } });

    expect(onChange.mock.calls[0]![0][0].options[0]).toMatchObject({ value: "d1" });
  });

  it("marks duplicate and blank keys", () => {
    render(<FieldsPanel rows={[row({ key: "a", id: "r1" }), row({ key: "a", id: "r2" }), row({ key: "", id: "r3" })]} onChange={vi.fn()} labels={LABELS} />);

    expect(screen.getAllByText("duplicate key")).toHaveLength(2);
    expect(screen.getByText("key required")).toBeTruthy();
  });
});
