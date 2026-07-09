import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TableColumnConfig } from "@rfjs/table-builder";

import { ColumnsPanel } from "./columns-panel";

const LABELS = {
  title: "Columns",
  visible: "Visible",
  label: "Label",
  format: "Format",
  formatNone: "None",
  sortable: "Sortable",
  pin: "Pin",
  pinNone: "None",
  pinLeft: "Left",
  pinRight: "Right",
};

const ID_COLUMN: TableColumnConfig = { key: "id", label: "ID", dataType: "string", sortable: true };
const PRICE_COLUMN: TableColumnConfig = { key: "price", label: "Price", dataType: "numeric", format: "currency" };
const CREATED_AT_COLUMN: TableColumnConfig = { key: "createdAt", label: "Created", dataType: "date" };

const COLUMNS: TableColumnConfig[] = [ID_COLUMN, PRICE_COLUMN, CREATED_AT_COLUMN];

describe("ColumnsPanel", () => {
  it("unchecking visible reports visible: false for only the toggled column", () => {
    const onChange = vi.fn();
    render(<ColumnsPanel columns={COLUMNS} onChange={onChange} labels={LABELS} />);

    const row = screen.getByTestId("column-row-id");
    const checkbox = within(row).getByLabelText(new RegExp(LABELS.visible));
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith([{ ...ID_COLUMN, visible: false }, PRICE_COLUMN, CREATED_AT_COLUMN]);
  });

  it("format select for a string column has no currency option and is disabled", () => {
    render(<ColumnsPanel columns={COLUMNS} onChange={vi.fn()} labels={LABELS} />);

    const row = screen.getByTestId("column-row-id");
    const select = within(row).getByLabelText(new RegExp(LABELS.format)) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);

    expect(optionValues).not.toContain("currency");
    expect(select.disabled).toBe(true);
  });

  it("format select for a numeric column offers currency", () => {
    render(<ColumnsPanel columns={COLUMNS} onChange={vi.fn()} labels={LABELS} />);

    const row = screen.getByTestId("column-row-price");
    const select = within(row).getByLabelText(new RegExp(LABELS.format)) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);

    expect(optionValues).toContain("currency");
    expect(select.disabled).toBe(false);
  });

  it("format select for a date column offers date/datetime/time but not currency", () => {
    render(<ColumnsPanel columns={COLUMNS} onChange={vi.fn()} labels={LABELS} />);

    const row = screen.getByTestId("column-row-createdAt");
    const select = within(row).getByLabelText(new RegExp(LABELS.format)) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);

    expect(optionValues).toEqual(["", "date", "datetime", "time"]);
  });

  it("pin button cycles none -> left -> right -> none", () => {
    const onChangeFromNone = vi.fn();
    const { rerender } = render(<ColumnsPanel columns={COLUMNS} onChange={onChangeFromNone} labels={LABELS} />);
    fireEvent.click(within(screen.getByTestId("column-row-id")).getByLabelText(new RegExp(LABELS.pin)));
    expect(onChangeFromNone.mock.calls[0]?.[0][0].pin).toBe("left");

    const leftColumns: TableColumnConfig[] = [{ ...ID_COLUMN, pin: "left" }, PRICE_COLUMN, CREATED_AT_COLUMN];
    const onChangeFromLeft = vi.fn();
    rerender(<ColumnsPanel columns={leftColumns} onChange={onChangeFromLeft} labels={LABELS} />);
    fireEvent.click(within(screen.getByTestId("column-row-id")).getByLabelText(new RegExp(LABELS.pin)));
    expect(onChangeFromLeft.mock.calls[0]?.[0][0].pin).toBe("right");

    const rightColumns: TableColumnConfig[] = [{ ...ID_COLUMN, pin: "right" }, PRICE_COLUMN, CREATED_AT_COLUMN];
    const onChangeFromRight = vi.fn();
    rerender(<ColumnsPanel columns={rightColumns} onChange={onChangeFromRight} labels={LABELS} />);
    fireEvent.click(within(screen.getByTestId("column-row-id")).getByLabelText(new RegExp(LABELS.pin)));
    expect(onChangeFromRight.mock.calls[0]?.[0][0].pin).toBeUndefined();
  });

  it("dragging the first row and dropping it on the third moves it to that position", () => {
    const onChange = vi.fn();
    render(<ColumnsPanel columns={COLUMNS} onChange={onChange} labels={LABELS} />);

    const first = screen.getByTestId("column-row-id");
    const third = screen.getByTestId("column-row-createdAt");

    fireEvent.dragStart(first);
    fireEvent.dragOver(third);
    fireEvent.drop(third);

    expect(onChange).toHaveBeenCalledWith([PRICE_COLUMN, CREATED_AT_COLUMN, ID_COLUMN]);
  });

  it("editing the label input reports the new string label", () => {
    const onChange = vi.fn();
    render(<ColumnsPanel columns={COLUMNS} onChange={onChange} labels={LABELS} />);

    const row = screen.getByTestId("column-row-id");
    const labelInput = within(row).getByLabelText(new RegExp(LABELS.label));
    fireEvent.change(labelInput, { target: { value: "Identifier" } });

    expect(onChange).toHaveBeenCalledWith([{ ...ID_COLUMN, label: "Identifier" }, PRICE_COLUMN, CREATED_AT_COLUMN]);
  });

  it("checking sortable reports sortable: true for that column", () => {
    const onChange = vi.fn();
    render(<ColumnsPanel columns={COLUMNS} onChange={onChange} labels={LABELS} />);

    const row = screen.getByTestId("column-row-price");
    const checkbox = within(row).getByLabelText(new RegExp(LABELS.sortable));
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith([ID_COLUMN, { ...PRICE_COLUMN, sortable: true }, CREATED_AT_COLUMN]);
  });
});
