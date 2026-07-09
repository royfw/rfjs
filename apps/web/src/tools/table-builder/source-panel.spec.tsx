import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SourcePanel } from "./source-panel";

const LABELS = {
  title: "Data source",
  rows: "Static rows",
  fetcher: "Fake fetcher",
  offset: "Offset",
  page: "Page",
  cursor: "Cursor",
};

const IMPORT_LABELS = {
  paste: "Paste JSON or CSV…",
  upload: "Upload .json/.csv",
  load: "Load",
  json: "JSON",
  csv: "CSV",
};

describe("SourcePanel", () => {
  it("switching from rows to fetcher reports the default offset strategy", () => {
    const onModeChange = vi.fn();
    render(<SourcePanel mode="rows" onModeChange={onModeChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: LABELS.fetcher }));

    expect(onModeChange).toHaveBeenCalledWith("offset");
  });

  it("does not render the strategy switch in rows mode", () => {
    render(<SourcePanel mode="rows" onModeChange={vi.fn()} labels={LABELS} />);

    expect(screen.queryByRole("button", { name: LABELS.offset })).toBeNull();
    expect(screen.queryByRole("button", { name: LABELS.page })).toBeNull();
    expect(screen.queryByRole("button", { name: LABELS.cursor })).toBeNull();
  });

  it("shows the strategy switch in fetcher mode and reports the selected strategy", () => {
    const onModeChange = vi.fn();
    render(<SourcePanel mode="offset" onModeChange={onModeChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: LABELS.page }));

    expect(onModeChange).toHaveBeenCalledWith("page");
  });

  it("clicking static rows switches back to rows mode from any strategy", () => {
    const onModeChange = vi.fn();
    render(<SourcePanel mode="cursor" onModeChange={onModeChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: LABELS.rows }));

    expect(onModeChange).toHaveBeenCalledWith("rows");
  });

  it("does not render the import UI in fetcher mode", () => {
    render(
      <SourcePanel mode="offset" onModeChange={vi.fn()} labels={LABELS} onImport={vi.fn()} importLabels={IMPORT_LABELS} />,
    );

    expect(screen.queryByPlaceholderText(IMPORT_LABELS.paste)).toBeNull();
    expect(screen.queryByRole("button", { name: IMPORT_LABELS.load })).toBeNull();
  });

  it("renders a label-wrapped file input for upload, not a button (no accessible-name collision with Load)", () => {
    render(
      <SourcePanel mode="rows" onModeChange={vi.fn()} labels={LABELS} onImport={vi.fn()} importLabels={IMPORT_LABELS} />,
    );

    expect(screen.getByRole("button", { name: IMPORT_LABELS.load })).not.toBeNull();
    expect(screen.queryByRole("button", { name: IMPORT_LABELS.upload })).toBeNull();
    const fileInput = screen.getByText(IMPORT_LABELS.upload).closest("label")?.querySelector('input[type="file"]');
    expect(fileInput).toBeInstanceOf(HTMLInputElement);
  });

  it("loading valid pasted JSON reports the parsed rows", () => {
    const onImport = vi.fn();
    render(
      <SourcePanel mode="rows" onModeChange={vi.fn()} labels={LABELS} onImport={onImport} importLabels={IMPORT_LABELS} />,
    );

    fireEvent.change(screen.getByPlaceholderText(IMPORT_LABELS.paste), { target: { value: '[{"a":1}]' } });
    fireEvent.click(screen.getByRole("button", { name: IMPORT_LABELS.load }));

    expect(onImport).toHaveBeenCalledWith([{ a: 1 }]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("loading invalid pasted content shows an error and does not call onImport", () => {
    const onImport = vi.fn();
    render(
      <SourcePanel mode="rows" onModeChange={vi.fn()} labels={LABELS} onImport={onImport} importLabels={IMPORT_LABELS} />,
    );

    fireEvent.change(screen.getByPlaceholderText(IMPORT_LABELS.paste), { target: { value: "not json" } });
    fireEvent.click(screen.getByRole("button", { name: IMPORT_LABELS.load }));

    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).not.toBeNull();
  });

  it("switching to CSV and loading valid pasted CSV reports typed rows", () => {
    const onImport = vi.fn();
    render(
      <SourcePanel mode="rows" onModeChange={vi.fn()} labels={LABELS} onImport={onImport} importLabels={IMPORT_LABELS} />,
    );

    fireEvent.click(screen.getByRole("button", { name: IMPORT_LABELS.csv }));
    fireEvent.change(screen.getByPlaceholderText(IMPORT_LABELS.paste), { target: { value: "a,b\n1,x" } });
    fireEvent.click(screen.getByRole("button", { name: IMPORT_LABELS.load }));

    expect(onImport).toHaveBeenCalledWith([{ a: 1, b: "x" }]);
  });
});
